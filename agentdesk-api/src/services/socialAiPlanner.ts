import { loadAiConfig, listConfiguredProviders } from "./aiSettings.js";
import { generateDirectAgentReply } from "./llmClient.js";

export interface PlannedPost {
  platform: string;
  content: string;
  scheduledAt: string;
  contentType: string;
  rationale: string;
}

export interface ContentPlan {
  theme: string;
  posts: PlannedPost[];
  summary: string;
}

const PLAN_SYSTEM = `You are a social media strategist for Tangent workspaces.
Return ONLY valid JSON (no markdown) with this shape:
{
  "theme": "campaign theme",
  "summary": "1-2 sentence plan overview",
  "posts": [
    {
      "platform": "instagram|facebook|linkedin|x-twitter|tiktok",
      "content": "full post copy with hashtags where appropriate",
      "scheduledAt": "ISO-8601 datetime in the future",
      "contentType": "announcement|tip|story|promo|engagement|thread",
      "rationale": "why this post/time/platform"
    }
  ]
}
Rules:
- Respect each platform's tone (LinkedIn professional, X concise <=280, Instagram caption-friendly).
- Space posts across the requested days.
- Do not invent that publishing already happened — this is a plan only.
- Generate between 3 and 14 posts depending on days and platforms.`;

export async function generateSocialContentPlan(input: {
  brief: string;
  platforms: string[];
  days: number;
  postsPerWeek?: number;
  brandVoice?: string;
}): Promise<ContentPlan> {
  const aiConfig = await loadAiConfig();
  const providers = listConfiguredProviders(aiConfig);
  if (providers.length === 0) {
    throw new Error("No AI provider configured. Add an API key in Settings → AI models.");
  }

  const platforms = input.platforms.length ? input.platforms : ["linkedin", "instagram", "x-twitter"];
  const days = Math.min(30, Math.max(3, input.days || 7));
  const countHint = input.postsPerWeek
    ? Math.round((input.postsPerWeek * days) / 7)
    : Math.min(12, Math.max(3, platforms.length * Math.ceil(days / 3)));

  const userPrompt = `Create a ${days}-day social content plan.

Brief: ${input.brief}
Platforms: ${platforms.join(", ")}
Target about ${countHint} posts total.
Brand voice: ${input.brandVoice?.trim() || "clear, confident, helpful"}
Start scheduling from tomorrow (use UTC ISO timestamps spaced sensibly morning/afternoon).`;

  const result = await generateDirectAgentReply({
    aiConfig,
    agent: {
      llm_provider: null,
      llm_model: null,
      llm_temperature: 0.7,
    },
    systemPrompt: PLAN_SYSTEM,
    history: [],
    userMessage: userPrompt,
  });

  const parsed = extractJson(result.reply);
  if (!parsed?.posts?.length) {
    throw new Error("AI did not return a usable content plan. Try again with a clearer brief.");
  }

  return {
    theme: String(parsed.theme ?? "Social campaign"),
    summary: String(parsed.summary ?? ""),
    posts: parsed.posts
      .map((p) => ({
        platform: String(p.platform ?? platforms[0]),
        content: String(p.content ?? "").trim(),
        scheduledAt: String(p.scheduledAt ?? new Date(Date.now() + 86400000).toISOString()),
        contentType: String(p.contentType ?? "post"),
        rationale: String(p.rationale ?? ""),
      }))
      .filter((p) => p.content),
  };
}

function extractJson(text: string): ContentPlan | null {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = fenced?.[1]?.trim() ?? text.trim();
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end < start) return null;
  try {
    return JSON.parse(raw.slice(start, end + 1)) as ContentPlan;
  } catch {
    return null;
  }
}
