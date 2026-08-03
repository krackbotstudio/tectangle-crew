import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CheckCircle2,
  Copy,
  ExternalLink,
  ImageIcon,
  Loader2,
  Network,
  Rocket,
  Send,
  Sparkles,
  Target,
} from "lucide-react";
import {
  api,
  getToken,
  type NetworkCampaign,
  type NetworkCampaignJob,
  type NetworkCollateralPack,
  type NetworkCommunity,
  type NetworkCreativeItem,
  type NetworkGtmProfile,
} from "../lib/api";
import { cn } from "../lib/utils";
import { PageHeader } from "../components/workspace/DashboardUI";

type Tab = "profile" | "communities" | "campaigns" | "track";

const STAGES = ["idea", "mvp", "launch", "growth", "first_customers"] as const;

const JOB_STATUS: Record<string, string> = {
  queued: "text-text-muted",
  ready: "text-amber-200",
  assisted_pending: "text-amber-200",
  published: "text-emerald-200",
  done: "text-emerald-200",
  failed: "text-red-300",
  skipped: "text-text-faint",
};

export function NetworksPage() {
  const [tab, setTab] = useState<Tab>("profile");
  const [banner, setBanner] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [recommendations, setRecommendations] = useState<NetworkCommunity[]>([]);
  const [collateral, setCollateral] = useState<NetworkCollateralPack | null>(null);
  const [activeCampaignId, setActiveCampaignId] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const { data: profileData, isLoading: profileLoading } = useQuery({
    queryKey: ["network-profile"],
    queryFn: () => api.getNetworkProfile(),
  });

  const { data: campaignsData } = useQuery({
    queryKey: ["network-campaigns"],
    queryFn: () => api.getNetworkCampaigns(),
  });

  const { data: campaignDetail, isLoading: detailLoading } = useQuery({
    queryKey: ["network-campaign", activeCampaignId],
    queryFn: () => api.getNetworkCampaign(activeCampaignId!),
    enabled: Boolean(activeCampaignId),
  });

  const profile = profileData?.profile ?? null;
  const campaigns = campaignsData?.campaigns ?? [];

  useEffect(() => {
    if (!activeCampaignId && campaigns[0]) {
      setActiveCampaignId(campaigns[0].id);
    }
  }, [campaigns, activeCampaignId]);

  function refresh() {
    queryClient.invalidateQueries({ queryKey: ["network-profile"] });
    queryClient.invalidateQueries({ queryKey: ["network-campaigns"] });
    if (activeCampaignId) {
      queryClient.invalidateQueries({ queryKey: ["network-campaign", activeCampaignId] });
    }
  }

  return (
    <div className="h-full overflow-y-auto p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-6xl">
        <PageHeader
          title="Networks"
          subtitle="Understand your product, find fit communities, generate collateral, and fan out launches — owned social live, communities assisted."
          action={
            <Link
              to="/social"
              className="inline-flex items-center gap-2 rounded-xl border border-border px-3 py-2 text-sm text-text-muted hover:bg-panel-hover"
            >
              <Send className="h-4 w-4" /> Social hub
            </Link>
          }
        />

        {banner && (
          <div className="mb-4 rounded-xl border border-border bg-panel px-4 py-3 text-sm text-text">
            {banner}
          </div>
        )}

        <div className="mb-6 flex flex-wrap items-center gap-3">
          <div className="flex gap-1 rounded-xl border border-border bg-panel p-1">
            {(
              [
                ["profile", "GTM profile"],
                ["communities", "Communities"],
                ["campaigns", "Launch"],
                ["track", "Track"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setTab(id)}
                className={cn(
                  "rounded-lg px-3 py-1.5 text-sm font-medium transition",
                  tab === id ? "bg-panel-elevated text-text-strong" : "text-text-muted hover:text-text"
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {tab === "profile" && (
          <ProfileTab
            profile={profile}
            loading={profileLoading}
            onSaved={() => {
              refresh();
              setBanner("GTM profile saved.");
              setTab("communities");
            }}
            onError={setBanner}
          />
        )}

        {tab === "communities" && (
          <CommunitiesTab
            profile={profile}
            recommendations={recommendations}
            selectedIds={selectedIds}
            onSelect={setSelectedIds}
            onRecommended={(list) => {
              setRecommendations(list);
              setSelectedIds(new Set(list.slice(0, 6).map((c) => c.id)));
              setBanner(`Found ${list.length} communities ranked for your product.`);
            }}
            onCollateral={(pack) => {
              setCollateral(pack);
              setBanner("Collateral pack ready.");
              setTab("campaigns");
            }}
            onError={setBanner}
          />
        )}

        {tab === "campaigns" && (
          <CampaignsTab
            profile={profile}
            selectedIds={selectedIds}
            recommendations={recommendations}
            collateral={collateral}
            onLaunched={(campaign) => {
              setActiveCampaignId(campaign.id);
              refresh();
              setBanner(`Campaign “${campaign.title}” created.`);
              setTab("track");
            }}
            onError={setBanner}
            onCollateral={setCollateral}
            onBanner={setBanner}
          />
        )}

        {tab === "track" && (
          <TrackTab
            campaigns={campaigns}
            activeCampaignId={activeCampaignId}
            onSelectCampaign={setActiveCampaignId}
            campaign={campaignDetail?.campaign ?? null}
            jobs={campaignDetail?.jobs ?? []}
            loading={detailLoading}
            onUpdated={refresh}
            onBanner={setBanner}
          />
        )}
      </div>
    </div>
  );
}

function ProfileTab({
  profile,
  loading,
  onSaved,
  onError,
}: {
  profile: NetworkGtmProfile | null;
  loading: boolean;
  onSaved: () => void;
  onError: (msg: string) => void;
}) {
  const [form, setForm] = useState({
    productName: "",
    productType: "",
    industry: "",
    icp: "",
    offer: "",
    stage: "launch",
    goals: "",
    interests: "",
    brandVoice: "",
    geography: "",
    notes: "",
  });

  useEffect(() => {
    if (!profile) return;
    setForm({
      productName: profile.productName ?? "",
      productType: profile.productType ?? "",
      industry: profile.industry ?? "",
      icp: profile.icp ?? "",
      offer: profile.offer ?? "",
      stage: profile.stage || "launch",
      goals: (profile.goals ?? []).join(", "),
      interests: (profile.interests ?? []).join(", "),
      brandVoice: profile.brandVoice ?? "",
      geography: profile.geography ?? "",
      notes: profile.notes ?? "",
    });
  }, [profile]);

  const save = useMutation({
    mutationFn: () =>
      api.saveNetworkProfile({
        productName: form.productName.trim(),
        productType: form.productType.trim() || undefined,
        industry: form.industry.trim(),
        icp: form.icp.trim(),
        offer: form.offer.trim(),
        stage: form.stage,
        goals: splitCsv(form.goals),
        interests: splitCsv(form.interests),
        brandVoice: form.brandVoice.trim() || undefined,
        geography: form.geography.trim() || undefined,
        notes: form.notes.trim() || undefined,
      }),
    onSuccess: onSaved,
    onError: (e) => onError((e as Error).message),
  });

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-text-muted">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading profile…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-border bg-panel p-5">
        <div className="mb-4 flex items-center gap-2 text-text-strong">
          <Target className="h-4 w-4" />
          <h2 className="text-sm font-semibold">What are you taking to market?</h2>
        </div>
        <p className="mb-5 text-sm text-text-muted">
          The engine uses this to score communities and write launch collateral. Be specific about who buys and what you offer.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Product name"
            value={form.productName}
            onChange={(v) => setForm((f) => ({ ...f, productName: v }))}
            required
          />
          <Field
            label="Product type"
            value={form.productType}
            onChange={(v) => setForm((f) => ({ ...f, productType: v }))}
            placeholder="SaaS, marketplace, agency…"
          />
          <Field
            label="Industry"
            value={form.industry}
            onChange={(v) => setForm((f) => ({ ...f, industry: v }))}
            placeholder="B2B SaaS, fintech, health…"
            required
          />
          <div>
            <label className="mb-1.5 block text-xs font-medium text-text-muted">Stage</label>
            <select
              value={form.stage}
              onChange={(e) => setForm((f) => ({ ...f, stage: e.target.value }))}
              className="w-full rounded-xl border border-border bg-panel-elevated px-3 py-2 text-sm text-text outline-none focus:border-neutral-500"
            >
              {STAGES.map((s) => (
                <option key={s} value={s}>
                  {s.replace(/_/g, " ")}
                </option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-2">
            <Field
              label="ICP (who buys)"
              value={form.icp}
              onChange={(v) => setForm((f) => ({ ...f, icp: v }))}
              placeholder="Founders of seed-stage B2B SaaS…"
              required
            />
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1.5 block text-xs font-medium text-text-muted">Offer / value prop</label>
            <textarea
              value={form.offer}
              onChange={(e) => setForm((f) => ({ ...f, offer: e.target.value }))}
              rows={3}
              className="w-full rounded-xl border border-border bg-panel-elevated px-3 py-2 text-sm text-text outline-none focus:border-neutral-500"
              placeholder="What problem you solve and why now"
            />
          </div>
          <Field
            label="Goals (comma-separated)"
            value={form.goals}
            onChange={(v) => setForm((f) => ({ ...f, goals: v }))}
            placeholder="first customers, waitlist, feedback"
          />
          <Field
            label="Interests / themes"
            value={form.interests}
            onChange={(v) => setForm((f) => ({ ...f, interests: v }))}
            placeholder="indie hackers, AI agents, GTM"
          />
          <Field
            label="Brand voice"
            value={form.brandVoice}
            onChange={(v) => setForm((f) => ({ ...f, brandVoice: v }))}
            placeholder="Direct, practical, no hype"
          />
          <Field
            label="Geography"
            value={form.geography}
            onChange={(v) => setForm((f) => ({ ...f, geography: v }))}
            placeholder="Global, US, India…"
          />
        </div>
        <div className="mt-4">
          <label className="mb-1.5 block text-xs font-medium text-text-muted">Notes</label>
          <textarea
            value={form.notes}
            onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            rows={2}
            className="w-full rounded-xl border border-border bg-panel-elevated px-3 py-2 text-sm text-text outline-none focus:border-neutral-500"
          />
        </div>
        <div className="mt-5 flex justify-end">
          <button
            type="button"
            disabled={
              save.isPending || !form.productName.trim() || !form.industry.trim() || !form.icp.trim()
            }
            onClick={() => save.mutate()}
            className="inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2 text-sm font-medium text-accent-muted-fg hover:bg-accent-hover disabled:opacity-50"
          >
            {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            Save & find communities
          </button>
        </div>
      </div>
    </div>
  );
}

function CommunitiesTab({
  profile,
  recommendations,
  selectedIds,
  onSelect,
  onRecommended,
  onCollateral,
  onError,
}: {
  profile: NetworkGtmProfile | null;
  recommendations: NetworkCommunity[];
  selectedIds: Set<string>;
  onSelect: (ids: Set<string>) => void;
  onRecommended: (list: NetworkCommunity[]) => void;
  onCollateral: (pack: NetworkCollateralPack) => void;
  onError: (msg: string) => void;
}) {
  const recommend = useMutation({
    mutationFn: () => api.recommendNetworkCommunities({ limit: 12 }),
    onSuccess: (data) => onRecommended(data.recommendations),
    onError: (e) => onError((e as Error).message),
  });

  const collateral = useMutation({
    mutationFn: () => api.generateNetworkCollateral(),
    onSuccess: (data) => onCollateral(data.collateral),
    onError: (e) => onError((e as Error).message),
  });

  function toggle(id: string) {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onSelect(next);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-panel p-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-sm font-medium text-text-strong">
            <Network className="h-4 w-4" /> Recommended communities
          </div>
          <p className="mt-1 text-xs text-text-muted">
            {profile
              ? `Scored for ${profile.productName || "your product"} in ${profile.industry || "your industry"}.`
              : "Save a GTM profile first."}
          </p>
        </div>
        <button
          type="button"
          disabled={!profile || recommend.isPending}
          onClick={() => recommend.mutate()}
          className="inline-flex items-center gap-2 rounded-xl bg-accent px-3 py-2 text-sm font-medium text-accent-muted-fg hover:bg-accent-hover disabled:opacity-50"
        >
          {recommend.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          Recommend
        </button>
        <button
          type="button"
          disabled={!profile || collateral.isPending || selectedIds.size === 0}
          onClick={() => collateral.mutate()}
          className="inline-flex items-center gap-2 rounded-xl border border-border px-3 py-2 text-sm text-text-muted hover:bg-panel-hover disabled:opacity-50"
        >
          {collateral.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Rocket className="h-4 w-4" />}
          Generate collateral ({selectedIds.size})
        </button>
      </div>

      {recommendations.length === 0 ? (
        <Empty hint="Run Recommend to score Reddit, Discord, Product Hunt, Indie Hackers, and owned social channels." />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {recommendations.map((c) => {
            const selected = selectedIds.has(c.id);
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => toggle(c.id)}
                className={cn(
                  "rounded-2xl border p-4 text-left transition",
                  selected
                    ? "border-accent/50 bg-accent-light/20"
                    : "border-border bg-panel hover:bg-panel-hover"
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-sm font-medium text-text-strong">{c.name}</div>
                    <div className="mt-0.5 text-xs text-text-faint">
                      {c.platform}
                      {c.joinType === "owned_social" ? " · owned social" : " · assisted"}
                      {typeof c.fitScore === "number" ? ` · fit ${c.fitScore}` : ""}
                    </div>
                  </div>
                  {selected && <CheckCircle2 className="h-4 w-4 shrink-0 text-accent-fg" />}
                </div>
                {c.description && (
                  <p className="mt-2 line-clamp-2 text-xs text-text-muted">{c.description}</p>
                )}
                {c.fitReasons?.length ? (
                  <p className="mt-2 text-[11px] text-text-faint">{c.fitReasons[0]}</p>
                ) : null}
                {c.rulesNotes && (
                  <p className="mt-1 text-[11px] text-amber-200/80">Rules: {c.rulesNotes}</p>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function CampaignsTab({
  profile,
  selectedIds,
  recommendations,
  collateral,
  onLaunched,
  onError,
  onCollateral,
  onBanner,
}: {
  profile: NetworkGtmProfile | null;
  selectedIds: Set<string>;
  recommendations: NetworkCommunity[];
  collateral: NetworkCollateralPack | null;
  onLaunched: (c: NetworkCampaign) => void;
  onError: (msg: string) => void;
  onCollateral: (pack: NetworkCollateralPack) => void;
  onBanner: (msg: string) => void;
}) {
  const [title, setTitle] = useState("");
  const [goal, setGoal] = useState("");
  const [publishOwnedNow, setPublishOwnedNow] = useState(false);
  const [creativeMode, setCreativeMode] = useState<"none" | "shared" | "individual">("shared");
  const [creatives, setCreatives] = useState<NetworkCreativeItem[]>([]);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [statusTick, setStatusTick] = useState(0);

  useEffect(() => {
    if (!title && profile?.productName) {
      setTitle(`${profile.productName} network launch`);
    }
    if (!goal && profile?.goals?.[0]) setGoal(profile.goals[0]);
  }, [profile, title, goal]);

  const selected = useMemo(
    () => recommendations.filter((c) => selectedIds.has(c.id)),
    [recommendations, selectedIds]
  );

  const placeholderCount =
    creativeMode === "individual" ? Math.min(Math.max(selectedIds.size, 1), 8) : 1;

  const genCollateral = useMutation({
    mutationFn: () => api.generateNetworkCollateral(),
    onSuccess: (data) => onCollateral(data.collateral),
    onError: (e) => onError((e as Error).message),
  });

  const genCreatives = useMutation({
    mutationFn: async () => {
      let pack = collateral;
      if (!pack) {
        const generated = await api.generateNetworkCollateral();
        pack = generated.collateral;
        onCollateral(pack);
      }
      if (creativeMode === "none") {
        throw new Error("Choose shared or individual creatives first.");
      }
      if (selectedIds.size === 0) {
        throw new Error("Select at least one community on the Communities tab first.");
      }
      return api.generateNetworkCreatives({
        mode: creativeMode,
        communityIds: [...selectedIds],
        collateral: pack,
      });
    },
    onMutate: () => {
      setGenerateError(null);
      setCreatives([]);
    },
    onSuccess: (data) => {
      setCreatives(data.creatives);
      setGenerateError(null);
      onBanner(
        data.mode === "shared"
          ? "Generated one launch creative for all channels."
          : `Generated ${data.creatives.length} channel-specific creatives.`
      );
    },
    onError: (e) => {
      const message = (e as Error).message || "Image generation failed.";
      setGenerateError(message);
      onError(message);
    },
  });

  useEffect(() => {
    if (!genCreatives.isPending) return;
    const id = window.setInterval(() => setStatusTick((n) => n + 1), 2200);
    return () => window.clearInterval(id);
  }, [genCreatives.isPending]);

  const generatingMessages =
    creativeMode === "individual"
      ? [
          "Writing channel-specific visual briefs…",
          "Generating images one channel at a time…",
          "Sizing for LinkedIn, X, Instagram & communities…",
          "Still working — individual mode can take a minute…",
        ]
      : [
          "Building a visual brief from your GTM profile…",
          "Composing a launch creative…",
          "Rendering your post image…",
          "Almost there — polishing the final frame…",
        ];
  const generatingMessage = generatingMessages[statusTick % generatingMessages.length];

  const launch = useMutation({
    mutationFn: () =>
      api.createNetworkCampaign({
        title: title.trim(),
        goal: goal.trim() || undefined,
        communityIds: [...selectedIds],
        publishOwnedNow,
        collateral: collateral ?? undefined,
        creativeMode: creatives.length ? creativeMode : "none",
        sharedCreativeId:
          creativeMode === "shared" ? creatives[0]?.creativeId ?? null : null,
        creatives: creatives.map((c) => ({
          communityId: c.communityId,
          creativeId: c.creativeId,
        })),
      }),
    onSuccess: (data) => onLaunched(data.campaign),
    onError: (e) => onError((e as Error).message),
  });

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border bg-panel p-5">
        <h2 className="mb-1 text-sm font-semibold text-text-strong">Launch campaign</h2>
        <p className="mb-4 text-xs text-text-muted">
          Owned social channels publish via Social (draft or now). Community channels get copy + URL for assisted posting — we never spam groups silently.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Campaign title" value={title} onChange={setTitle} required />
          <Field label="Goal" value={goal} onChange={setGoal} placeholder="first customers" />
        </div>
        <label className="mt-4 flex items-center gap-2 text-sm text-text-muted">
          <input
            type="checkbox"
            checked={publishOwnedNow}
            onChange={(e) => setPublishOwnedNow(e.target.checked)}
            className="rounded border-border"
          />
          Publish owned social jobs immediately (requires connected accounts)
        </label>
        <div className="mt-4 text-xs text-text-faint">
          Selected: {selected.length ? selected.map((c) => c.name).join(", ") : "none — go back to Communities"}
        </div>
        <div className="mt-5 flex flex-wrap gap-2">
          {!collateral && (
            <button
              type="button"
              disabled={!profile || genCollateral.isPending}
              onClick={() => genCollateral.mutate()}
              className="inline-flex items-center gap-2 rounded-xl border border-border px-3 py-2 text-sm text-text-muted hover:bg-panel-hover disabled:opacity-50"
            >
              {genCollateral.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              Generate collateral
            </button>
          )}
          <button
            type="button"
            disabled={launch.isPending || !title.trim() || selectedIds.size === 0}
            onClick={() => launch.mutate()}
            className="inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2 text-sm font-medium text-accent-muted-fg hover:bg-accent-hover disabled:opacity-50"
          >
            {launch.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Rocket className="h-4 w-4" />}
            Create campaign
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-panel p-5">
        <div className="mb-1 flex items-center gap-2 text-sm font-semibold text-text-strong">
          <ImageIcon className="h-4 w-4" /> Post images
        </div>
        <p className="mb-4 text-xs text-text-muted">
          Generate a relevant visual from your GTM brief and{" "}
          <Link to="/brand" className="text-text underline-offset-2 hover:underline">
            Brand guidelines
          </Link>
          . Your uploaded logo is stamped on a brand-color footer; the AI generates a text-free scene only. Requires OpenAI or Google AI under Settings → AI models.
        </p>
        <BrandActiveHint />
        <div className="flex flex-wrap gap-2">
          {(
            [
              ["none", "No images"],
              ["shared", "One creative for all"],
              ["individual", "Individual per channel"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              disabled={genCreatives.isPending}
              onClick={() => {
                setCreativeMode(id);
                setGenerateError(null);
                if (id === "none") setCreatives([]);
              }}
              className={cn(
                "rounded-xl border px-3 py-1.5 text-sm disabled:opacity-50",
                creativeMode === id
                  ? "border-accent/50 bg-accent-light/20 text-text-strong"
                  : "border-border text-text-muted hover:bg-panel-hover"
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {creativeMode !== "none" && (
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              type="button"
              disabled={!profile || selectedIds.size === 0 || genCreatives.isPending}
              onClick={() => genCreatives.mutate()}
              className="inline-flex items-center gap-2 rounded-xl bg-accent px-3 py-2 text-sm font-medium text-accent-muted-fg hover:bg-accent-hover disabled:opacity-50"
            >
              {genCreatives.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ImageIcon className="h-4 w-4" />
              )}
              {genCreatives.isPending
                ? "Generating…"
                : creatives.length
                  ? "Regenerate images"
                  : "Create relevant images"}
            </button>
            {!profile && (
              <span className="text-xs text-amber-200/90">Save a GTM profile first.</span>
            )}
            {profile && selectedIds.size === 0 && (
              <span className="text-xs text-amber-200/90">Select communities first.</span>
            )}
          </div>
        )}

        {generateError && (
          <div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {generateError}
          </div>
        )}

        {genCreatives.isPending && (
          <div className="mt-4 space-y-3">
            <div className="overflow-hidden rounded-xl border border-border bg-panel-elevated px-4 py-3">
              <div className="mb-2 flex items-center gap-2 text-sm text-text-strong">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-60" />
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-accent" />
                </span>
                {generatingMessage}
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-panel">
                <div className="network-gen-progress h-full rounded-full bg-accent" />
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: placeholderCount }).map((_, i) => (
                <div
                  key={i}
                  className="overflow-hidden rounded-xl border border-border bg-panel-elevated"
                  style={{ animationDelay: `${i * 120}ms` }}
                >
                  <div className="network-gen-shimmer aspect-square" />
                  <div className="space-y-2 p-3">
                    <div className="network-gen-shimmer h-3 w-2/3 rounded" />
                    <div className="network-gen-shimmer h-2.5 w-1/3 rounded" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {!genCreatives.isPending && creatives.length > 0 && (
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {creatives.map((c) => (
              <div key={c.creativeId} className="overflow-hidden rounded-xl border border-border bg-panel-elevated">
                <CreativeThumb downloadUrl={c.downloadUrl} alt={c.label} />
                <div className="space-y-0.5 p-3">
                  <div className="text-xs font-medium text-text-strong">{c.label}</div>
                  <div className="text-[11px] text-text-faint">
                    {c.purpose}
                    {c.width && c.height ? ` · ${c.width}×${c.height}` : ""}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {collateral && <CollateralPreview pack={collateral} />}
    </div>
  );
}

function TrackTab({
  campaigns,
  activeCampaignId,
  onSelectCampaign,
  campaign,
  jobs,
  loading,
  onUpdated,
  onBanner,
}: {
  campaigns: NetworkCampaign[];
  activeCampaignId: string | null;
  onSelectCampaign: (id: string) => void;
  campaign: NetworkCampaign | null;
  jobs: NetworkCampaignJob[];
  loading: boolean;
  onUpdated: () => void;
  onBanner: (msg: string) => void;
}) {
  const markDone = useMutation({
    mutationFn: (jobId: string) =>
      api.updateNetworkJobStatus(jobId, { status: "done", outcome: "posted_manually" }),
    onSuccess: () => {
      onUpdated();
      onBanner("Marked assisted job done.");
    },
    onError: (e) => onBanner((e as Error).message),
  });

  const publish = useMutation({
    mutationFn: (jobId: string) => api.publishNetworkJob(jobId),
    onSuccess: (data) => {
      onUpdated();
      onBanner(data.message || "Published.");
    },
    onError: (e) => onBanner((e as Error).message),
  });

  if (!campaigns.length) {
    return <Empty hint="No campaigns yet. Complete GTM → communities → launch." />;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {campaigns.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => onSelectCampaign(c.id)}
            className={cn(
              "rounded-xl border px-3 py-1.5 text-sm",
              activeCampaignId === c.id
                ? "border-accent/50 bg-accent-light/20 text-text-strong"
                : "border-border text-text-muted hover:bg-panel-hover"
            )}
          >
            {c.title}
            <span className="ml-2 text-[11px] text-text-faint">{c.status}</span>
          </button>
        ))}
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-sm text-text-muted">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading jobs…
        </div>
      )}

      {campaign && (
        <div className="rounded-2xl border border-border bg-panel p-4">
          <div className="text-sm font-medium text-text-strong">{campaign.title}</div>
          {campaign.goal && <div className="mt-1 text-xs text-text-muted">Goal: {campaign.goal}</div>}
          {campaign.collateral && typeof campaign.collateral === "object" && "summary" in campaign.collateral && (
            <p className="mt-2 text-xs text-text-faint">{String(campaign.collateral.summary)}</p>
          )}
        </div>
      )}

      <div className="space-y-3">
        {jobs.map((job) => (
          <div key={job.id} className="rounded-2xl border border-border bg-panel p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="text-sm font-medium text-text-strong">
                  {job.destinationLabel || job.platform}
                </div>
                <div className="mt-0.5 text-xs text-text-faint">
                  {job.channelType.replace(/_/g, " ")} · {job.platform} ·{" "}
                  <span className={JOB_STATUS[job.status] ?? "text-text-muted"}>{job.status}</span>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {job.destinationUrl && (
                  <a
                    href={job.destinationUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 rounded-lg border border-border px-2 py-1 text-xs text-text-muted hover:bg-panel-hover"
                  >
                    <ExternalLink className="h-3 w-3" /> Open
                  </a>
                )}
                <button
                  type="button"
                  onClick={() => void navigator.clipboard.writeText(job.content)}
                  className="inline-flex items-center gap-1 rounded-lg border border-border px-2 py-1 text-xs text-text-muted hover:bg-panel-hover"
                >
                  <Copy className="h-3 w-3" /> Copy
                </button>
                {job.channelType === "assisted_community" && job.status === "assisted_pending" && (
                  <button
                    type="button"
                    disabled={markDone.isPending}
                    onClick={() => markDone.mutate(job.id)}
                    className="inline-flex items-center gap-1 rounded-lg bg-accent px-2 py-1 text-xs font-medium text-accent-muted-fg"
                  >
                    Mark posted
                  </button>
                )}
                {job.channelType === "owned_social" &&
                  (job.status === "ready" || job.status === "queued" || job.status === "failed") && (
                    <button
                      type="button"
                      disabled={publish.isPending}
                      onClick={() => publish.mutate(job.id)}
                      className="inline-flex items-center gap-1 rounded-lg bg-accent px-2 py-1 text-xs font-medium text-accent-muted-fg"
                    >
                      Publish
                    </button>
                  )}
              </div>
            </div>
            <div className="mt-3 flex flex-col gap-3 sm:flex-row">
              {job.creativeDownloadUrl && (
                <div className="w-full shrink-0 overflow-hidden rounded-xl border border-border sm:w-40">
                  <CreativeThumb downloadUrl={job.creativeDownloadUrl} alt="Post creative" />
                </div>
              )}
              <pre className="max-h-40 min-w-0 flex-1 overflow-auto whitespace-pre-wrap rounded-xl bg-panel-elevated p-3 text-xs text-text">
                {job.content}
              </pre>
            </div>
            {job.errorDetail && (
              <p className="mt-2 text-xs text-red-300">{job.errorDetail}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function CollateralPreview({ pack }: { pack: NetworkCollateralPack }) {
  const blocks: [string, string][] = [
    ["Summary", pack.summary],
    ["Launch / community post", pack.launchPost],
    ["LinkedIn", pack.linkedinPost],
    ["X", pack.xPost],
    ["Short DM", pack.shortDm],
    ["Waitlist CTA", pack.waitlistCta],
    ["Comment reply", pack.commentReply],
  ];
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-text-strong">Collateral pack</h3>
      {blocks.map(([label, body]) => (
        <div key={label} className="rounded-2xl border border-border bg-panel p-4">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-medium text-text-muted">{label}</span>
            <button
              type="button"
              onClick={() => void navigator.clipboard.writeText(body)}
              className="text-xs text-text-faint hover:text-text"
            >
              Copy
            </button>
          </div>
          <pre className="whitespace-pre-wrap text-xs text-text">{body}</pre>
        </div>
      ))}
    </div>
  );
}

function BrandActiveHint() {
  const { data } = useQuery({
    queryKey: ["brand-guidelines"],
    queryFn: () => api.getBrandGuidelines(),
  });
  const brand = data?.brand;
  if (!brand?.companyName && !brand?.primaryColor) {
    return (
      <p className="mb-4 text-xs text-amber-200/90">
        No brand kit saved yet — set logo and colors on the Brand page for consistent creatives.
      </p>
    );
  }
  return (
    <div className="mb-4 flex flex-wrap items-center gap-2 text-xs text-text-muted">
      <span>Using brand:</span>
      <span className="font-medium text-text-strong">{brand.companyName || "Untitled"}</span>
      {brand.primaryColor && (
        <span
          className="inline-flex items-center gap-1 rounded-md border border-border px-1.5 py-0.5"
          title="Primary"
        >
          <span className="h-2.5 w-2.5 rounded-sm" style={{ background: brand.primaryColor }} />
          {brand.primaryColor}
        </span>
      )}
      {brand.secondaryColor && (
        <span
          className="inline-flex items-center gap-1 rounded-md border border-border px-1.5 py-0.5"
          title="Secondary"
        >
          <span className="h-2.5 w-2.5 rounded-sm" style={{ background: brand.secondaryColor }} />
          {brand.secondaryColor}
        </span>
      )}
      {brand.imageStyle && <span className="text-text-faint">{brand.imageStyle.replace(/_/g, " ")}</span>}
      {brand.logoFileName ? (
        <span className="text-emerald-200/90">logo file will be stamped</span>
      ) : (
        <span className="text-amber-200/90">no logo file — upload on Brand</span>
      )}
    </div>
  );
}

function CreativeThumb({ downloadUrl, alt }: { downloadUrl: string; alt: string }) {
  const { url, error } = useAuthenticatedImageUrl(downloadUrl);
  if (error) {
    return (
      <div className="flex aspect-square items-center justify-center bg-panel text-[11px] text-text-faint">
        Image unavailable
      </div>
    );
  }
  if (!url) {
    return (
      <div className="flex aspect-square items-center justify-center bg-panel">
        <Loader2 className="h-4 w-4 animate-spin text-text-faint" />
      </div>
    );
  }
  return <img src={url} alt={alt} className="aspect-square w-full object-cover" />;
}

function useAuthenticatedImageUrl(downloadPath: string) {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let objectUrl: string | null = null;
    let cancelled = false;

    async function load() {
      try {
        const token = getToken();
        const path = downloadPath.startsWith("/api/")
          ? downloadPath
          : `/api${downloadPath.startsWith("/") ? downloadPath : `/${downloadPath}`}`;
        const res = await fetch(path, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!res.ok) throw new Error("Failed to load image");
        const blob = await res.blob();
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      } catch {
        if (!cancelled) setError(true);
      }
    }

    void load();
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [downloadPath]);

  return { url, error };
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium text-text-muted">
        {label}
        {required ? " *" : ""}
      </label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-xl border border-border bg-panel-elevated px-3 py-2 text-sm text-text outline-none placeholder:text-text-faint focus:border-neutral-500"
      />
    </div>
  );
}

function Empty({ hint }: { hint: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-border px-6 py-12 text-center text-sm text-text-muted">
      {hint}
    </div>
  );
}

function splitCsv(value: string) {
  return value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}
