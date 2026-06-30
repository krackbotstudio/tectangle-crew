import fs from "fs/promises";
import path from "path";
import crypto from "crypto";
import { config } from "../config.js";
import { loadAiConfig, resolveProviderApiKey, type AiConfig } from "./aiSettings.js";

export interface ImageGenerateInput {
  prompt: string;
  width?: number;
  height?: number;
  purpose?: string;
}

export interface GeneratedImageResult {
  fileName: string;
  filePath: string;
  mimeType: string;
  width: number;
  height: number;
  provider: string;
  publicUrl: string;
}

const PURPOSE_PRESETS: Record<string, { width: number; height: number; label: string }> = {
  instagram_feed: { width: 1080, height: 1080, label: "Instagram feed" },
  instagram_story: { width: 1080, height: 1920, label: "Instagram story" },
  instagram_reel: { width: 1080, height: 1920, label: "Instagram reel cover" },
  facebook: { width: 1200, height: 630, label: "Facebook post" },
  facebook_cover: { width: 820, height: 312, label: "Facebook cover" },
  linkedin: { width: 1200, height: 627, label: "LinkedIn post" },
  x_twitter: { width: 1600, height: 900, label: "X (Twitter) post" },
  youtube_thumb: { width: 1280, height: 720, label: "YouTube thumbnail" },
  pinterest: { width: 1000, height: 1500, label: "Pinterest pin" },
  banner: { width: 1920, height: 1080, label: "Web banner" },
  square: { width: 1080, height: 1080, label: "Square" },
};

export function resolveImageDimensions(input: ImageGenerateInput): { width: number; height: number; purposeLabel: string } {
  const purposeKey = input.purpose?.toLowerCase().replace(/[\s-]+/g, "_") ?? "";
  const preset = PURPOSE_PRESETS[purposeKey];
  if (preset) {
    return { width: preset.width, height: preset.height, purposeLabel: preset.label };
  }
  return {
    width: input.width && input.width > 0 ? input.width : 1024,
    height: input.height && input.height > 0 ? input.height : 1024,
    purposeLabel: input.purpose ?? "Custom",
  };
}

function dallE3Size(width: number, height: number): "1024x1024" | "1792x1024" | "1024x1792" {
  const ratio = width / height;
  if (ratio > 1.2) return "1792x1024";
  if (ratio < 0.85) return "1024x1792";
  return "1024x1024";
}

function gptImageSize(width: number, height: number): "1024x1024" | "1536x1024" | "1024x1536" {
  const ratio = width / height;
  if (ratio > 1.15) return "1536x1024";
  if (ratio < 0.87) return "1024x1536";
  return "1024x1024";
}

type OpenAIImagePayload = Record<string, unknown>;

interface OpenAIImageAttempt {
  model: string;
  size: string;
  /** Only valid for dall-e-2 / dall-e-3 — gpt-image models reject this parameter. */
  responseFormat?: "b64_json" | "url";
  quality?: string;
}

async function extractOpenAIImageBuffer(
  data: { data?: Array<{ b64_json?: string; url?: string }> },
  fallbackWidth: number,
  fallbackHeight: number
): Promise<{ buffer: Buffer; mimeType: string; width: number; height: number }> {
  const item = data.data?.[0];
  if (!item) throw new Error("OpenAI returned no image data");

  if (item.b64_json) {
    return {
      buffer: Buffer.from(item.b64_json, "base64"),
      mimeType: "image/png",
      width: fallbackWidth,
      height: fallbackHeight,
    };
  }

  if (item.url) {
    const imgRes = await fetch(item.url);
    if (!imgRes.ok) {
      throw new Error(`Failed to download OpenAI image (${imgRes.status})`);
    }
    const buffer = Buffer.from(await imgRes.arrayBuffer());
    const mimeType = imgRes.headers.get("content-type") ?? "image/png";
    return { buffer, mimeType, width: fallbackWidth, height: fallbackHeight };
  }

  throw new Error("OpenAI returned no image data");
}

async function requestOpenAIImage(
  apiKey: string,
  body: OpenAIImagePayload
): Promise<{ data?: Array<{ b64_json?: string; url?: string }> }> {
  const response = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`OpenAI image generation failed: ${err.slice(0, 300)}`);
  }

  return (await response.json()) as { data?: Array<{ b64_json?: string; url?: string }> };
}

async function ensureCreativesDir(): Promise<string> {
  const dir = path.join(config.uploadDir, "creatives");
  await fs.mkdir(dir, { recursive: true });
  return dir;
}

async function saveImageBuffer(buffer: Buffer, mimeType: string): Promise<{ fileName: string; filePath: string }> {
  const dir = await ensureCreativesDir();
  const ext = mimeType.includes("jpeg") || mimeType.includes("jpg") ? "jpg" : "png";
  const fileName = `${crypto.randomUUID()}.${ext}`;
  const filePath = path.join(dir, fileName);
  await fs.writeFile(filePath, buffer);
  return { fileName, filePath };
}

async function generateWithOpenAI(
  apiKey: string,
  prompt: string,
  width: number,
  height: number
): Promise<GeneratedImageResult> {
  const enhancedPrompt = `${prompt}. Professional quality, suitable for social media marketing.`.slice(0, 32000);
  const dalleSize = dallE3Size(width, height);
  const gptSize = gptImageSize(width, height);
  const [dalleW, dalleH] = dalleSize.split("x").map(Number);
  const [gptW, gptH] = gptSize.split("x").map(Number);

  const attempts: OpenAIImageAttempt[] = [
    { model: "gpt-image-1.5", size: gptSize, quality: "medium" },
    { model: "gpt-image-1", size: gptSize, quality: "medium" },
    { model: "dall-e-3", size: dalleSize, responseFormat: "b64_json", quality: "standard" },
    { model: "dall-e-3", size: dalleSize, responseFormat: "url", quality: "standard" },
  ];

  let lastError = "";

  for (const attempt of attempts) {
    try {
      const body: OpenAIImagePayload = {
        model: attempt.model,
        prompt: attempt.model.startsWith("gpt-image")
          ? enhancedPrompt
          : enhancedPrompt.slice(0, 4000),
        n: 1,
        size: attempt.size,
      };

      if (attempt.quality) body.quality = attempt.quality;
      if (attempt.responseFormat) body.response_format = attempt.responseFormat;

      const data = await requestOpenAIImage(apiKey, body);
      const isGpt = attempt.model.startsWith("gpt-image");
      const { buffer, mimeType, width: outW, height: outH } = await extractOpenAIImageBuffer(
        data,
        isGpt ? gptW : dalleW,
        isGpt ? gptH : dalleH
      );
      const { fileName, filePath } = await saveImageBuffer(buffer, mimeType);

      return {
        fileName,
        filePath,
        mimeType,
        width: outW,
        height: outH,
        provider: "openai",
        publicUrl: `/creatives/files/${fileName}`,
      };
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
      const lower = lastError.toLowerCase();
      if (lower.includes("unknown parameter") && lower.includes("response_format")) {
        continue;
      }
      if (lower.includes("invalid_value") && lower.includes("model")) {
        continue;
      }
      if (lower.includes("does not exist") || lower.includes("not found") || lower.includes("404")) {
        continue;
      }
      if (lower.includes("billing") || lower.includes("insufficient_quota")) {
        throw err;
      }
    }
  }

  throw new Error(
    lastError ||
      "OpenAI image generation failed. Ensure your API key has access to gpt-image-1.5 or DALL·E 3."
  );
}

async function generateWithGoogle(
  apiKey: string,
  prompt: string,
  width: number,
  height: number
): Promise<GeneratedImageResult> {
  const staticModels = [
    "gemini-2.5-flash-image",
    "gemini-2.0-flash-preview-image-generation",
    "gemini-3.1-flash-image",
  ];

  let models = staticModels;
  try {
    const listRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}`
    );
    if (listRes.ok) {
      const listData = (await listRes.json()) as {
        models?: Array<{ name?: string; supportedGenerationMethods?: string[] }>;
      };
      const discovered = (listData.models ?? [])
        .filter(
          (m) =>
            m.name?.includes("image") &&
            (m.supportedGenerationMethods?.includes("generateContent") ?? true)
        )
        .map((m) => m.name!.replace(/^models\//, ""));
      if (discovered.length > 0) {
        models = [...new Set([...discovered, ...staticModels])];
      }
    }
  } catch {
    // use static list
  }

  let lastError = "";
  for (const model of models) {
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  {
                    text: `Generate an image (${width}x${height}px) for social media: ${prompt}. High quality, professional marketing creative.`,
                  },
                ],
              },
            ],
            generationConfig: {
              responseModalities: ["TEXT", "IMAGE"],
            },
          }),
        }
      );

      if (!response.ok) {
        lastError = await response.text();
        continue;
      }

      const data = (await response.json()) as {
        candidates?: Array<{
          content?: { parts?: Array<{ inlineData?: { mimeType?: string; data?: string } }> };
        }>;
      };

      for (const part of data.candidates?.[0]?.content?.parts ?? []) {
        if (part.inlineData?.data) {
          const mimeType = part.inlineData.mimeType ?? "image/png";
          const buffer = Buffer.from(part.inlineData.data, "base64");
          const { fileName, filePath } = await saveImageBuffer(buffer, mimeType);
          return {
            fileName,
            filePath,
            mimeType,
            width,
            height,
            provider: "google",
            publicUrl: `/creatives/files/${fileName}`,
          };
        }
      }
      lastError = "No image in Google response";
    } catch (e) {
      lastError = e instanceof Error ? e.message : String(e);
    }
  }

  throw new Error(
    `Google image generation failed. Try adding OpenAI (DALL·E 3) under Workspace settings → AI models. Details: ${lastError.slice(0, 180)}`
  );
}

export async function generateAgentImage(
  aiConfig: AiConfig,
  input: ImageGenerateInput
): Promise<GeneratedImageResult & { purposeLabel: string }> {
  const { width, height, purposeLabel } = resolveImageDimensions(input);
  const openaiKey = resolveProviderApiKey(aiConfig, "openai");
  const googleKey = resolveProviderApiKey(aiConfig, "google");

  if (openaiKey && aiConfig.providers.openai.enabled) {
    try {
      const result = await generateWithOpenAI(openaiKey, input.prompt, width, height);
      return { ...result, purposeLabel };
    } catch (openaiErr) {
      if (googleKey && aiConfig.providers.google.enabled) {
        try {
          const result = await generateWithGoogle(googleKey, input.prompt, width, height);
          return { ...result, purposeLabel };
        } catch (googleErr) {
          const o = openaiErr instanceof Error ? openaiErr.message : String(openaiErr);
          const g = googleErr instanceof Error ? googleErr.message : String(googleErr);
          throw new Error(`OpenAI: ${o.slice(0, 100)}. Google: ${g.slice(0, 150)}`);
        }
      }
      throw openaiErr;
    }
  }

  if (googleKey && aiConfig.providers.google.enabled) {
    const result = await generateWithGoogle(googleKey, input.prompt, width, height);
    return { ...result, purposeLabel };
  }

  throw new Error(
    "No image generation provider available. Enable OpenAI or Google AI under Workspace settings → AI models and save an API key."
  );
}

export function isImageGenerationRequest(message: string): boolean {
  const lower = message.toLowerCase();
  if (
    /\b(create|generate|make|design|produce|render|draw|build|try)\b/.test(lower) &&
    /\b(image|graphic|visual|creative|banner|thumbnail|carousel|photo|picture|asset|post|flyer|poster)\b/.test(
      lower
    )
  ) {
    return true;
  }
  if (/\b(image|graphic|visual|creative|banner)\b/.test(lower) && /\b(for|of|about)\b/.test(lower)) {
    return true;
  }
  return false;
}

/** Detect image tasks including follow-ups like "try again" when recent chat was about visuals. */
export function isImageGenerationRequestWithContext(message: string, recentMessages: string[]): boolean {
  if (isImageGenerationRequest(message)) return true;

  const lower = message.toLowerCase();
  const isFollowUp =
    /\b(try again|create again|generate again|regenerate|redo|another one|do it again|make it again|now try|please try|create it again|make the image|generate the image|try to create)\b/i.test(
      lower
    ) ||
    (/\btry\b/i.test(lower) && /\bagain\b/i.test(lower));

  if (!isFollowUp) return false;

  const context = recentMessages.join(" ").toLowerCase();
  return /\b(image|graphic|visual|creative|banner|thumbnail|photo|picture|design|canva|figma|instagram|social post|layout|mockup|flyer|poster)\b/.test(
    context
  );
}

export function buildImagePromptFromContext(
  message: string,
  recentMessages: string[],
  options?: { projectBrief?: string; maxConversationChars?: number }
): string {
  const direct = extractImagePromptFromMessage(message);
  let core = direct;

  if (isImageGenerationRequest(message) && direct.length > 15) {
    core = direct;
  } else {
    for (let i = recentMessages.length - 1; i >= 0; i--) {
      const msg = recentMessages[i];
      if (isImageGenerationRequest(msg) || /\b(image|graphic|visual|creative|banner|post)\b/i.test(msg)) {
        const extracted = extractImagePromptFromMessage(msg);
        if (extracted.length > 10) {
          core = extracted;
          break;
        }
      }
    }
    if (!core || core.length < 10) {
      core = direct || message.replace(/@\S+/g, "").trim() || "Social media marketing creative";
    }
  }

  const maxChars = options?.maxConversationChars ?? 4500;
  const conversation = recentMessages.slice(-20).join("\n").slice(-maxChars);

  const sections: string[] = [];
  if (options?.projectBrief?.trim()) {
    sections.push(
      `PROJECT (must match this brand/product — do not invent unrelated businesses):\n${options.projectBrief.trim()}`
    );
  }
  if (conversation.trim()) {
    sections.push(
      `GROUP CONVERSATION (follow requirements, copy, taglines, and feedback from all agents and the user):\n${conversation}`
    );
  }
  sections.push(`VISUAL TO GENERATE:\n${core}`);

  return sections.join("\n\n");
}

export function extractImagePromptFromMessage(message: string): string {
  return message
    .replace(/@\w[\w-]*/gi, "")
    .replace(/\b(design|content|development)\s+agent\b/gi, "")
    .trim();
}

export function parseDimensionsFromMessage(message: string): {
  width?: number;
  height?: number;
  purpose?: string;
} {
  const dimMatch = message.match(/(\d{3,4})\s*[x×]\s*(\d{3,4})/i);
  if (dimMatch) {
    return { width: parseInt(dimMatch[1], 10), height: parseInt(dimMatch[2], 10) };
  }
  const lower = message.toLowerCase();
  if (/instagram story|ig story/.test(lower)) return { purpose: "instagram_story" };
  if (/instagram reel|ig reel/.test(lower)) return { purpose: "instagram_reel" };
  if (/instagram|ig feed|ig post/.test(lower)) return { purpose: "instagram_feed" };
  if (/linkedin/.test(lower)) return { purpose: "linkedin" };
  if (/facebook/.test(lower)) return { purpose: "facebook" };
  if (/\bx\b|twitter/.test(lower)) return { purpose: "x_twitter" };
  if (/youtube/.test(lower)) return { purpose: "youtube_thumb" };
  if (/pinterest/.test(lower)) return { purpose: "pinterest" };
  return {};
}

/** Match @Design Agent, @design, @Content Agent, etc. */
export function resolveMentionedAgents(
  message: string,
  agents: { id: string; slug: string; name: string }[]
) {
  const lower = message.toLowerCase();
  const matched: { id: string; slug: string; name: string }[] = [];

  const sorted = [...agents].sort((a, b) => b.name.length - a.name.length);

  for (const agent of sorted) {
    const name = agent.name.toLowerCase();
    const slug = agent.slug.toLowerCase();
    const firstWord = name.split(/\s+/)[0];
    const variants = [
      `@${name}`,
      `@${name.replace(/\s+/g, "")}`,
      `@${slug}`,
      `@${slug.replace(/-/g, " ")}`,
      `@${firstWord}`,
      `@${firstWord} agent`,
    ];

    const hit = variants.some((v) => {
      const idx = lower.indexOf(v);
      if (idx === -1) return false;
      const nextChar = lower[idx + v.length];
      return nextChar === undefined || /[\s,.\!?]/.test(nextChar);
    });

    if (hit && !matched.some((m) => m.id === agent.id)) {
      matched.push(agent);
    }
  }

  return matched;
}

export function resolveGroupResponders(input: {
  message: string;
  activeAgent: { id: string; slug: string; name: string; skills?: string[] };
  groupAgents: { id: string; slug: string; name: string; skills?: string[] }[];
  recentMessages: string[];
}): { id: string; slug: string; name: string; skills?: string[] }[] {
  const { message, activeAgent, groupAgents, recentMessages } = input;
  const trimmed = message.trim();

  const mentioned = resolveMentionedAgents(trimmed, groupAgents);
  if (mentioned.length > 0) {
    return groupAgents.filter((a) => mentioned.some((m) => m.id === a.id));
  }

  if (isImageGenerationRequestWithContext(trimmed, recentMessages)) {
    const designAgents = groupAgents.filter((a) => isDesignAgent(a));
    if (designAgents.length > 0) return designAgents;
  }

  return [activeAgent];
}

export function isDesignAgent(agent: { slug: string; name: string; skills?: string[] }): boolean {
  if (agent.slug.includes("design")) return true;
  if (/design/i.test(agent.name)) return true;
  const skills = agent.skills ?? [];
  return skills.some((s) => /design|creative|visual|ui\/ux|figma|canva/i.test(s));
}

export const SOCIAL_PLATFORMS = [
  { id: "instagram", label: "Instagram", requiresTools: ["instagram", "meta-business"] },
  { id: "facebook", label: "Facebook", requiresTools: ["facebook", "meta-business"] },
  { id: "linkedin", label: "LinkedIn", requiresTools: ["linkedin"] },
  { id: "x-twitter", label: "X (Twitter)", requiresTools: ["x-twitter"] },
  { id: "buffer", label: "Buffer (schedule)", requiresTools: ["buffer"] },
] as const;
