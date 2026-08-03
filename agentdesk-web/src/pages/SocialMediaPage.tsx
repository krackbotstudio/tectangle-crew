import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Calendar,
  CheckCircle2,
  Loader2,
  Plus,
  Send,
  Share2,
  Sparkles,
  Trash2,
  UserPlus,
  X,
  Zap,
} from "lucide-react";
import { api, type SocialAccount, type SocialPost } from "../lib/api";
import { cn, formatRelativeTime } from "../lib/utils";
import { PageHeader } from "../components/workspace/DashboardUI";
import { ToolLogo } from "../components/console/ToolLogo";

type Tab = "connect" | "planner" | "calendar" | "posts";

const STATUS_STYLE: Record<string, string> = {
  draft: "text-text-muted",
  scheduled: "text-amber-200",
  published: "text-emerald-200",
  failed: "text-red-300",
  publishing: "text-text-muted",
};

export function SocialMediaPage() {
  const [tab, setTab] = useState<Tab>("connect");
  const [composeOpen, setComposeOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();

  const { data: platformsData } = useQuery({
    queryKey: ["social-platforms"],
    queryFn: () => api.getSocialPlatforms(),
  });

  const { data: accountsData, isLoading: accountsLoading } = useQuery({
    queryKey: ["social-accounts"],
    queryFn: () => api.getSocialAccounts(),
  });

  const { data: postsData, isLoading: postsLoading } = useQuery({
    queryKey: ["social-posts"],
    queryFn: () => api.getSocialPosts(),
  });

  const accounts = accountsData?.accounts ?? [];
  const posts = postsData?.posts ?? [];
  const platforms = platformsData?.platforms ?? [];
  const oauthProviders = platformsData?.oauthProviders ?? [];

  useEffect(() => {
    const oauth = searchParams.get("oauth");
    if (!oauth) return;
    if (oauth === "connected") {
      setBanner(`Connected ${searchParams.get("provider") ?? "platform"} successfully.`);
      setTab("connect");
      queryClient.invalidateQueries({ queryKey: ["social-platforms"] });
      queryClient.invalidateQueries({ queryKey: ["social-accounts"] });
      queryClient.invalidateQueries({ queryKey: ["console"] });
    } else if (oauth === "error") {
      setBanner(searchParams.get("message") || "OAuth connection failed.");
    }
    setSearchParams({}, { replace: true });
  }, [searchParams, setSearchParams, queryClient]);

  function refresh() {
    queryClient.invalidateQueries({ queryKey: ["social-accounts"] });
    queryClient.invalidateQueries({ queryKey: ["social-posts"] });
    queryClient.invalidateQueries({ queryKey: ["social-platforms"] });
  }

  return (
    <div className="h-full overflow-y-auto p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-6xl">
        <PageHeader
          title="Social"
          subtitle="Connect platforms, plan with AI, and let your Social Media Manager run strategy through publish."
          action={
            <button
              type="button"
              onClick={() => setComposeOpen(true)}
              className="inline-flex items-center gap-2 rounded-xl bg-accent px-3 py-2 text-sm font-medium text-accent-muted-fg hover:bg-accent-hover"
            >
              <Plus className="h-4 w-4" /> New post
            </button>
          }
        />

        {banner && (
          <div className="mb-4 flex items-start justify-between gap-3 rounded-xl border border-border bg-panel px-4 py-3 text-sm text-text">
            <span>{banner}</span>
            <button type="button" onClick={() => setBanner(null)} className="text-text-faint hover:text-text">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        <div className="mb-6 flex flex-wrap items-center gap-3">
          <div className="flex gap-1 rounded-xl border border-border bg-panel p-1">
            {(
              [
                ["connect", "Connect"],
                ["planner", "AI Planner"],
                ["calendar", "Calendar"],
                ["posts", "Posts"],
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
          <div className="flex-1" />
          <Link
            to="/agents/social-media-manager"
            className="inline-flex items-center gap-2 rounded-xl border border-border px-3 py-2 text-sm text-text-muted hover:bg-panel-hover"
          >
            <Sparkles className="h-4 w-4" /> Ask Social Media Manager
          </Link>
        </div>

        {tab === "connect" && (
          <ConnectTab
            oauthProviders={oauthProviders}
            platforms={platforms}
            accounts={accounts}
            accountsLoading={accountsLoading}
            onAddHandle={() => setAddOpen(true)}
            onUpdated={refresh}
            onBanner={setBanner}
          />
        )}

        {tab === "planner" && (
          <PlannerTab platforms={platforms} onScheduled={refresh} onBanner={setBanner} />
        )}

        {tab === "calendar" && (
          <CalendarTab posts={posts} loading={postsLoading} onUpdated={refresh} />
        )}

        {tab === "posts" && (
          <PostsTab posts={posts} loading={postsLoading} onUpdated={refresh} />
        )}
      </div>

      {addOpen && (
        <AddAccountModal platforms={platforms} onClose={() => setAddOpen(false)} onSaved={refresh} />
      )}
      {composeOpen && (
        <ComposePostModal
          accounts={accounts}
          platforms={platforms}
          onClose={() => setComposeOpen(false)}
          onSaved={refresh}
        />
      )}
    </div>
  );
}

function ConnectTab({
  oauthProviders,
  platforms,
  accounts,
  accountsLoading,
  onAddHandle,
  onUpdated,
  onBanner,
}: {
  oauthProviders: {
    id: string;
    label: string;
    platforms: string[];
    configured: boolean;
    description: string;
  }[];
  platforms: { id: string; label: string; workspaceConnected: boolean }[];
  accounts: SocialAccount[];
  accountsLoading: boolean;
  onAddHandle: () => void;
  onUpdated: () => void;
  onBanner: (msg: string) => void;
}) {
  const connectMutation = useMutation({
    mutationFn: (platform: string) => api.startSocialOauth(platform),
    onSuccess: (data) => {
      window.location.href = data.url;
    },
    onError: (e: Error) => onBanner(e.message),
  });

  return (
    <div className="space-y-8">
      <section>
        <h2 className="mb-2 text-sm font-semibold text-text-strong">Connect with OAuth</h2>
        <p className="mb-4 text-sm text-text-muted">
          One-click native login for Meta (Instagram + Facebook), LinkedIn, X, and TikTok. Add app
          credentials in the API <code className="text-xs">.env</code> first.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          {oauthProviders.map((provider) => (
            <div key={provider.id} className="rounded-2xl border border-border bg-panel p-4">
              <div className="flex items-start gap-3">
                <ToolLogo
                  slug={provider.id === "meta" ? "meta-business" : provider.id}
                  name={provider.label}
                  className="h-8 w-8"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-text-strong">{provider.label}</p>
                    {provider.platforms.some((p) => platforms.find((x) => x.id === p)?.workspaceConnected) && (
                      <span className="inline-flex items-center gap-1 text-xs text-emerald-300">
                        <CheckCircle2 className="h-3 w-3" /> Connected
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-text-muted">{provider.description}</p>
                  {!provider.configured && (
                    <p className="mt-2 text-xs text-amber-200">
                      Not configured on server — set OAuth env vars, then restart the API.
                    </p>
                  )}
                </div>
              </div>
              <button
                type="button"
                disabled={!provider.configured || connectMutation.isPending}
                onClick={() => connectMutation.mutate(provider.id)}
                className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-3 py-2 text-sm font-medium text-accent-muted-fg hover:bg-accent-hover disabled:opacity-50"
              >
                {connectMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Zap className="h-4 w-4" />
                )}
                {provider.configured ? "Connect" : "Needs .env setup"}
              </button>
            </div>
          ))}
        </div>
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-text-strong">Connected handles</h2>
          <button
            type="button"
            onClick={onAddHandle}
            className="inline-flex items-center gap-1 text-sm text-text-muted hover:text-text-strong"
          >
            <UserPlus className="h-4 w-4" /> Add manually
          </button>
        </div>
        {accountsLoading && <p className="text-sm text-text-muted">Loading…</p>}
        {!accountsLoading && accounts.length === 0 && (
          <div className="rounded-2xl border border-border bg-panel p-8 text-center text-sm text-text-muted">
            No handles yet. Use OAuth connect above — accounts are created automatically.
          </div>
        )}
        <div className="grid gap-3 sm:grid-cols-2">
          {accounts.map((account) => (
            <AccountCard key={account.id} account={account} onUpdated={onUpdated} />
          ))}
        </div>
      </section>
    </div>
  );
}

function PlannerTab({
  platforms,
  onScheduled,
  onBanner,
}: {
  platforms: { id: string; label: string; workspaceConnected: boolean }[];
  onScheduled: () => void;
  onBanner: (msg: string) => void;
}) {
  const [brief, setBrief] = useState("");
  const [days, setDays] = useState(7);
  const [selected, setSelected] = useState<string[]>(["linkedin", "instagram", "x-twitter"]);
  const [plan, setPlan] = useState<Awaited<ReturnType<typeof api.planSocialContent>>["plan"] | null>(
    null
  );

  const planMutation = useMutation({
    mutationFn: () =>
      api.planSocialContent({
        brief,
        platforms: selected,
        days,
      }),
    onSuccess: (data) => setPlan(data.plan),
    onError: (e: Error) => onBanner(e.message),
  });

  const scheduleMutation = useMutation({
    mutationFn: () =>
      api.scheduleSocialPlan({
        posts: (plan?.posts ?? []).map((p) => ({
          platform: p.platform,
          content: p.content,
          scheduledAt: p.scheduledAt,
        })),
      }),
    onSuccess: (data) => {
      onBanner(data.message);
      onScheduled();
      setPlan(null);
    },
    onError: (e: Error) => onBanner(e.message),
  });

  function togglePlatform(id: string) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]));
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-border bg-panel p-5">
        <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-text-strong">
          <Sparkles className="h-4 w-4 text-brand-purple" />
          AI content planner
        </div>
        <label className="mb-3 block space-y-1">
          <span className="text-xs text-text-muted">Campaign brief</span>
          <textarea
            value={brief}
            onChange={(e) => setBrief(e.target.value)}
            rows={4}
            placeholder="e.g. Launch Tangent for small businesses — focus on time saved, multi-agent crews, and social workflows."
            className="w-full rounded-xl border border-border bg-panel-elevated px-3 py-2 text-sm"
          />
        </label>
        <div className="mb-3 flex flex-wrap gap-2">
          {platforms
            .filter((p) => p.id !== "buffer")
            .map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => togglePlatform(p.id)}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs",
                  selected.includes(p.id)
                    ? "border-neutral-500 bg-panel-elevated text-text-strong"
                    : "border-border text-text-muted"
                )}
              >
                {p.label}
              </button>
            ))}
        </div>
        <label className="mb-4 inline-flex items-center gap-2 text-sm text-text-muted">
          Days
          <input
            type="number"
            min={3}
            max={30}
            value={days}
            onChange={(e) => setDays(Number(e.target.value) || 7)}
            className="w-16 rounded-lg border border-border bg-panel-elevated px-2 py-1 text-sm"
          />
        </label>
        <button
          type="button"
          disabled={!brief.trim() || selected.length === 0 || planMutation.isPending}
          onClick={() => planMutation.mutate()}
          className="inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2 text-sm font-medium text-accent-muted-fg disabled:opacity-50"
        >
          {planMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          Generate plan
        </button>
      </div>

      {plan && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h3 className="font-semibold text-text-strong">{plan.theme}</h3>
              <p className="text-sm text-text-muted">{plan.summary}</p>
            </div>
            <button
              type="button"
              disabled={scheduleMutation.isPending}
              onClick={() => scheduleMutation.mutate()}
              className="inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2 text-sm font-medium text-accent-muted-fg disabled:opacity-50"
            >
              {scheduleMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Calendar className="h-4 w-4" />
              )}
              Schedule all ({plan.posts.length})
            </button>
          </div>
          {plan.posts.map((post, i) => (
            <div key={`${post.platform}-${i}`} className="rounded-2xl border border-border bg-panel p-4">
              <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-text-muted">
                <ToolLogo slug={post.platform} name={post.platform} className="h-4 w-4" />
                <span className="capitalize">{post.platform.replace("-", " ")}</span>
                <span className="rounded bg-panel-elevated px-2 py-0.5">{post.contentType}</span>
                <span>{new Date(post.scheduledAt).toLocaleString()}</span>
              </div>
              <p className="whitespace-pre-wrap text-sm text-text">{post.content}</p>
              {post.rationale && <p className="mt-2 text-xs text-text-faint">{post.rationale}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function CalendarTab({
  posts,
  loading,
  onUpdated,
}: {
  posts: SocialPost[];
  loading: boolean;
  onUpdated: () => void;
}) {
  const byDay = useMemo(() => {
    const map = new Map<string, SocialPost[]>();
    for (const post of posts) {
      const key = (post.scheduledAt || post.publishedAt || post.createdAt).slice(0, 10);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(post);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [posts]);

  if (loading) return <p className="text-sm text-text-muted">Loading calendar…</p>;
  if (byDay.length === 0) {
    return (
      <div className="rounded-2xl border border-border bg-panel p-8 text-center text-sm text-text-muted">
        No scheduled posts yet. Use AI Planner or compose a post with a schedule time.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {byDay.map(([day, dayPosts]) => (
        <div key={day} className="rounded-2xl border border-border bg-panel p-4">
          <h3 className="mb-3 text-sm font-semibold text-text-strong">
            {new Date(day + "T12:00:00").toLocaleDateString(undefined, {
              weekday: "long",
              month: "short",
              day: "numeric",
            })}
          </h3>
          <div className="space-y-2">
            {dayPosts.map((post) => (
              <div
                key={post.id}
                className="flex items-start justify-between gap-3 rounded-xl border border-border-subtle bg-panel-elevated px-3 py-2"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-text-muted">
                    <ToolLogo slug={post.platform} name={post.platform} className="h-3.5 w-3.5" />
                    <span className="capitalize">{post.platform.replace("-", " ")}</span>
                    <span className={cn("capitalize", STATUS_STYLE[post.status])}>{post.status}</span>
                    {post.scheduledAt && <span>{new Date(post.scheduledAt).toLocaleTimeString()}</span>}
                  </div>
                  <p className="mt-1 line-clamp-2 text-sm text-text">{post.content}</p>
                </div>
                {(post.status === "draft" || post.status === "scheduled") && (
                  <PublishButton postId={post.id} onDone={onUpdated} />
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function PostsTab({
  posts,
  loading,
  onUpdated,
}: {
  posts: SocialPost[];
  loading: boolean;
  onUpdated: () => void;
}) {
  if (loading) return <p className="text-sm text-text-muted">Loading posts…</p>;
  if (posts.length === 0) {
    return (
      <div className="rounded-2xl border border-border bg-panel p-8 text-center text-sm text-text-muted">
        No posts yet. Compose a post, run the AI planner, or ask the Social Media Manager agent.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {posts.map((post) => (
        <div key={post.id} className="rounded-2xl border border-border bg-panel p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2 text-xs text-text-muted">
                <ToolLogo slug={post.platform} name={post.platform} className="h-4 w-4" />
                <span className="capitalize">{post.platform.replace("-", " ")}</span>
                {post.handle && <span>@{post.handle}</span>}
                <span className={cn("font-medium capitalize", STATUS_STYLE[post.status] ?? "")}>
                  {post.status}
                </span>
                {post.scheduledAt && (
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {new Date(post.scheduledAt).toLocaleString()}
                  </span>
                )}
                {post.publishedAt && <span>Published {formatRelativeTime(post.publishedAt)}</span>}
              </div>
              <p className="mt-2 whitespace-pre-wrap text-sm text-text">{post.content}</p>
              {post.errorDetail && <p className="mt-2 text-xs text-red-300">{post.errorDetail}</p>}
            </div>
            {(post.status === "draft" || post.status === "scheduled") && (
              <PublishButton postId={post.id} onDone={onUpdated} />
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function AccountCard({ account, onUpdated }: { account: SocialAccount; onUpdated: () => void }) {
  const deleteMutation = useMutation({
    mutationFn: () => api.deleteSocialAccount(account.id),
    onSuccess: onUpdated,
  });

  return (
    <div className="rounded-2xl border border-border bg-panel p-4">
      <div className="flex items-start gap-3">
        <ToolLogo slug={account.platform} name={account.displayName || account.handle} className="h-8 w-8" />
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-text-strong">@{account.handle}</p>
          {account.displayName && <p className="text-sm text-text-muted">{account.displayName}</p>}
          <p className="mt-1 text-xs capitalize text-text-faint">{account.platform.replace("-", " ")}</p>
        </div>
        <button
          type="button"
          onClick={() => {
            if (confirm(`Remove @${account.handle}?`)) deleteMutation.mutate();
          }}
          className="rounded p-1 text-text-faint hover:bg-panel-hover hover:text-red-300"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function PublishButton({ postId, onDone }: { postId: string; onDone: () => void }) {
  const mutation = useMutation({
    mutationFn: () => api.publishSocialPost(postId),
    onSuccess: onDone,
  });
  return (
    <button
      type="button"
      onClick={() => mutation.mutate()}
      disabled={mutation.isPending}
      className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-border px-2 py-1 text-xs hover:bg-panel-hover"
    >
      {mutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
      Publish
    </button>
  );
}

function AddAccountModal({
  platforms,
  onClose,
  onSaved,
}: {
  platforms: { id: string; label: string; workspaceConnected: boolean }[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [platform, setPlatform] = useState(platforms[0]?.id ?? "instagram");
  const [handle, setHandle] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () =>
      api.createSocialAccount({
        platform,
        handle,
        displayName: displayName.trim() || undefined,
      }),
    onSuccess: () => {
      onSaved();
      onClose();
    },
    onError: (e: Error) => setError(e.message),
  });

  return (
    <Modal title="Add handle manually" onClose={onClose}>
      {error && <p className="mb-3 text-sm text-red-300">{error}</p>}
      <label className="mb-3 block space-y-1">
        <span className="text-xs text-text-muted">Platform</span>
        <select
          value={platform}
          onChange={(e) => setPlatform(e.target.value)}
          className="w-full rounded-xl border border-border bg-panel-elevated px-3 py-2 text-sm"
        >
          {platforms.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </select>
      </label>
      <label className="mb-3 block space-y-1">
        <span className="text-xs text-text-muted">Handle</span>
        <input
          value={handle}
          onChange={(e) => setHandle(e.target.value)}
          placeholder="@yourbrand"
          className="w-full rounded-xl border border-border bg-panel-elevated px-3 py-2 text-sm"
        />
      </label>
      <label className="mb-4 block space-y-1">
        <span className="text-xs text-text-muted">Display name (optional)</span>
        <input
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          className="w-full rounded-xl border border-border bg-panel-elevated px-3 py-2 text-sm"
        />
      </label>
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onClose} className="rounded-xl border border-border px-4 py-2 text-sm">
          Cancel
        </button>
        <button
          type="button"
          disabled={!handle.trim() || mutation.isPending}
          onClick={() => mutation.mutate()}
          className="rounded-xl bg-accent px-4 py-2 text-sm font-medium text-accent-muted-fg disabled:opacity-50"
        >
          Save
        </button>
      </div>
    </Modal>
  );
}

function ComposePostModal({
  accounts,
  platforms,
  onClose,
  onSaved,
}: {
  accounts: SocialAccount[];
  platforms: { id: string; label: string; workspaceConnected?: boolean }[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [selected, setSelected] = useState<string[]>([
    accounts[0]?.platform ?? platforms[0]?.id ?? "linkedin",
  ]);
  const [content, setContent] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [publishNow, setPublishNow] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () =>
      api.createSocialPost({
        platforms: selected,
        content,
        scheduledAt: !publishNow && scheduledAt ? new Date(scheduledAt).toISOString() : undefined,
        publishNow,
      }),
    onSuccess: () => {
      onSaved();
      onClose();
    },
    onError: (e: Error) => setError(e.message),
  });

  function toggle(id: string) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]));
  }

  return (
    <Modal title="Compose post" onClose={onClose}>
      {error && <p className="mb-3 text-sm text-red-300">{error}</p>}
      <p className="mb-2 text-xs text-text-muted">Publish to one or more platforms</p>
      <div className="mb-3 flex flex-wrap gap-2">
        {platforms.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => toggle(p.id)}
            className={cn(
              "rounded-full border px-3 py-1 text-xs",
              selected.includes(p.id)
                ? "border-neutral-500 bg-panel-elevated text-text-strong"
                : "border-border text-text-muted"
            )}
          >
            {p.label}
            {p.workspaceConnected ? "" : " · offline"}
          </button>
        ))}
      </div>
      <label className="mb-3 block space-y-1">
        <span className="text-xs text-text-muted">Content</span>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={5}
          className="w-full rounded-xl border border-border bg-panel-elevated px-3 py-2 text-sm"
          placeholder="Write your post…"
        />
      </label>
      {!publishNow && (
        <label className="mb-3 block space-y-1">
          <span className="text-xs text-text-muted">Schedule for (optional)</span>
          <input
            type="datetime-local"
            value={scheduledAt}
            onChange={(e) => setScheduledAt(e.target.value)}
            className="w-full rounded-xl border border-border bg-panel-elevated px-3 py-2 text-sm"
          />
        </label>
      )}
      <label className="mb-4 flex items-center gap-2 text-sm text-text-muted">
        <input type="checkbox" checked={publishNow} onChange={(e) => setPublishNow(e.target.checked)} />
        Publish immediately (auto-publish uses the scheduler for scheduled times)
      </label>
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onClose} className="rounded-xl border border-border px-4 py-2 text-sm">
          Cancel
        </button>
        <button
          type="button"
          disabled={!content.trim() || selected.length === 0 || mutation.isPending}
          onClick={() => mutation.mutate()}
          className="inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2 text-sm font-medium text-accent-muted-fg disabled:opacity-50"
        >
          {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Share2 className="h-4 w-4" />}
          {publishNow ? "Publish" : scheduledAt ? "Schedule" : "Save draft"}
        </button>
      </div>
    </Modal>
  );
}

function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-border bg-panel p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-semibold text-text-strong">{title}</h2>
          <button type="button" onClick={onClose} className="rounded p-1 hover:bg-panel-hover">
            <X className="h-4 w-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
