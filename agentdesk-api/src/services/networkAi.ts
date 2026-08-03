import { loadAiConfig, listConfiguredProviders } from "./aiSettings.js";
import { generateDirectAgentReply } from "./llmClient.js";
import { listNetworkCommunities, scoreCommunityFit } from "./networkCatalog.js";
import { formatGtmBrief, mapGtmProfile } from "./networkGtm.js";

type Profile = ReturnType<typeof mapGtmProfile>;

export interface CollateralPack {
  launchPost: string;
  shortDm: string;
  commentReply: string;
  waitlistCta: string;
  linkedinPost: string;
  xPost: string;
  summary: string;
}

export async function recommendCommunities(profile: Profile, limit = 12) {
  const all = await listNetworkCommunities();
  const ranked = all
    .map((c) => {
      const { score, reasons } = scoreCommunityFit(c, {
        industry: profile.industry,
        productType: profile.productType,
        interests: profile.interests,
        goals: profile.goals,
        stage: profile.stage,
      });
      return { community: c, score, reasons };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  // Optional AI re-rank / explain when providers exist
  try {
    const aiConfig = await loadAiConfig();
    if (listConfiguredProviders(aiConfig).length === 0) return ranked;

    const result = await generateDirectAgentReply({
      aiConfig,
      agent: { llm_provider: null, llm_model: null, llm_temperature: 0.4 },
      systemPrompt: `You refine community recommendations for GTM.
Return ONLY JSON: { "orderedSlugs": ["slug1","slug2"], "notes": { "slug": "one-line why" } }
Use only slugs from the provided list. Prefer communities that help first customers or launches based on the profile.`,
      history: [],
      userMessage: `Profile:\n${formatGtmBrief(profile)}\n\nCandidates:\n${ranked
        .map((r) => `- ${r.community.slug}: ${r.community.name} (${r.community.platform}) score=${r.score}`)
        .join("\n")}`,
    });

    const parsed = extractJson<{ orderedSlugs?: string[]; notes?: Record<string, string> }>(result.reply);
    if (parsed?.orderedSlugs?.length) {
      const bySlug = new Map(ranked.map((r) => [r.community.slug, r]));
      const reordered: typeof ranked = [];
      for (const slug of parsed.orderedSlugs) {
        const item = bySlug.get(slug);
        if (item) {
          if (parsed.notes?.[slug]) item.reasons = [parsed.notes[slug], ...item.reasons];
          reordered.push(item);
          bySlug.delete(slug);
        }
      }
      for (const rest of bySlug.values()) reordered.push(rest);
      return reordered.slice(0, limit);
    }
  } catch {
    /* catalog scoring is enough */
  }

  return ranked;
}

export async function generateCollateralPack(profile: Profile): Promise<CollateralPack> {
  const fallback: CollateralPack = {
    summary: `GTM pack for ${profile.productName || "your product"}`,
    launchPost: buildFallbackLaunch(profile),
    shortDm: buildFallbackDm(profile),
    commentReply: `Happy to share more about how ${profile.productName || "we"} help ${profile.icp || "teams"} — happy to answer questions.`,
    waitlistCta: `If you're tackling ${profile.industry || "this"} problems, join the waitlist for ${profile.productName || "our product"}.`,
    linkedinPost: buildFallbackLinkedIn(profile),
    xPost: buildFallbackX(profile),
  };

  const aiConfig = await loadAiConfig();
  if (listConfiguredProviders(aiConfig).length === 0) return fallback;

  try {
    const result = await generateDirectAgentReply({
      aiConfig,
      agent: { llm_provider: null, llm_model: null, llm_temperature: 0.7 },
      systemPrompt: `You write GTM communication collateral for community outreach and owned social.
Return ONLY JSON with keys: summary, launchPost, shortDm, commentReply, waitlistCta, linkedinPost, xPost.
Rules:
- Ground every claim in the profile; do not invent fake metrics.
- launchPost: Reddit/Indie Hackers style value-first (no spam).
- shortDm: under 500 chars, personal.
- xPost: <=280 chars.
- linkedinPost: professional insight + soft CTA.
- Tailor tone to brandVoice when provided.`,
      history: [],
      userMessage: formatGtmBrief(profile),
    });

    const parsed = extractJson<Partial<CollateralPack>>(result.reply);
    if (!parsed) return fallback;
    return {
      summary: parsed.summary || fallback.summary,
      launchPost: parsed.launchPost || fallback.launchPost,
      shortDm: parsed.shortDm || fallback.shortDm,
      commentReply: parsed.commentReply || fallback.commentReply,
      waitlistCta: parsed.waitlistCta || fallback.waitlistCta,
      linkedinPost: parsed.linkedinPost || fallback.linkedinPost,
      xPost: parsed.xPost || fallback.xPost,
    };
  } catch {
    return fallback;
  }
}

function buildFallbackLaunch(p: Profile) {
  return [
    `Building in public: ${p.productName || "our product"}`,
    "",
    p.offer || "We're solving a painful workflow for our audience.",
    p.icp ? `Built for: ${p.icp}` : "",
    "",
    "Would love feedback from people in this space — what's the hardest part of this problem for you today?",
  ]
    .filter(Boolean)
    .join("\n");
}

function buildFallbackDm(p: Profile) {
  return `Hey — I'm working on ${p.productName || "a product"} for ${p.icp || "teams"} in ${p.industry || "this space"}. ${p.offer || "Curious if this problem resonates."} Open to a quick chat?`;
}

function buildFallbackLinkedIn(p: Profile) {
  return [
    `${p.productName || "We're"} focused on ${p.industry || "this market"}.`,
    "",
    p.offer || "The goal: help customers move faster with less busywork.",
    "",
    "If this is your world, I'd value your take — what's broken in your current workflow?",
  ].join("\n");
}

function buildFallbackX(p: Profile) {
  const text = `${p.productName || "Building"} for ${p.icp || "founders"} in ${p.industry || "SaaS"}. ${p.offer || "Looking for early feedback."}`;
  return text.slice(0, 280);
}

function extractJson<T>(text: string): T | null {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = fenced?.[1]?.trim() ?? text.trim();
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(raw.slice(start, end + 1)) as T;
  } catch {
    return null;
  }
}
