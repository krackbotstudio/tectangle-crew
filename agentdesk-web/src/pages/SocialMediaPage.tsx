import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Calendar,
  Globe,
  Loader2,
  Plus,
  Send,
  Share2,
  Trash2,
  UserPlus,
  X,
} from "lucide-react";
import { api, type SocialAccount } from "../lib/api";
import { cn, formatRelativeTime } from "../lib/utils";
import { PageHeader } from "../components/workspace/DashboardUI";
import { ToolLogo } from "../components/console/ToolLogo";

type Tab = "accounts" | "posts";

const STATUS_STYLE: Record<string, string> = {
  draft: "text-text-muted",
  scheduled: "text-amber-200",
  published: "text-emerald-200",
  failed: "text-red-300",
  publishing: "text-text-muted",
};

export function SocialMediaPage() {
  const [tab, setTab] = useState<Tab>("accounts");
  const [addOpen, setAddOpen] = useState(false);
  const [composeOpen, setComposeOpen] = useState(false);
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

  function refresh() {
    queryClient.invalidateQueries({ queryKey: ["social-accounts"] });
    queryClient.invalidateQueries({ queryKey: ["social-posts"] });
  }

  return (
    <div className="h-full overflow-y-auto p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-5xl">
        <PageHeader
          title="Social"
          subtitle="Connect your handles, compose posts, schedule, and publish across platforms."
        />

        <div className="mb-6 flex flex-wrap items-center gap-3">
          <div className="flex gap-1 rounded-xl border border-border bg-panel p-1">
            {(["accounts", "posts"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className={cn(
                  "rounded-lg px-3 py-1.5 text-sm font-medium capitalize transition",
                  tab === t ? "bg-panel-elevated text-text-strong" : "text-text-muted hover:text-text"
                )}
              >
                {t}
              </button>
            ))}
          </div>
          <div className="flex-1" />
          {tab === "accounts" ? (
            <button
              type="button"
              onClick={() => setAddOpen(true)}
              className="inline-flex items-center gap-2 rounded-xl bg-accent px-3 py-2 text-sm font-medium text-accent-muted-fg hover:bg-accent-hover"
            >
              <UserPlus className="h-4 w-4" /> Connect handle
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setComposeOpen(true)}
              className="inline-flex items-center gap-2 rounded-xl bg-accent px-3 py-2 text-sm font-medium text-accent-muted-fg hover:bg-accent-hover"
            >
              <Plus className="h-4 w-4" /> New post
            </button>
          )}
          <Link
            to="/app-store"
            className="inline-flex items-center gap-2 rounded-xl border border-border px-3 py-2 text-sm text-text-muted hover:bg-panel-hover"
          >
            <Globe className="h-4 w-4" /> App Store
          </Link>
        </div>

        {tab === "accounts" && (
          <>
            <p className="mb-4 text-sm text-text-muted">
              Add your @handles for each platform. Connect the platform app in{" "}
              <Link to="/app-store" className="text-accent-fg hover:underline">
                App Store
              </Link>{" "}
              so the Social Media Manager agent can schedule and publish.
            </p>
            {accountsLoading && <p className="text-sm text-text-muted">Loading accounts…</p>}
            {!accountsLoading && accounts.length === 0 && (
              <div className="rounded-2xl border border-border bg-panel p-8 text-center text-sm text-text-muted">
                No handles connected yet. Add Instagram, LinkedIn, X, or other accounts to get started.
              </div>
            )}
            <div className="grid gap-3 sm:grid-cols-2">
              {accounts.map((account) => (
                <AccountCard key={account.id} account={account} onUpdated={refresh} />
              ))}
            </div>
          </>
        )}

        {tab === "posts" && (
          <>
            {postsLoading && <p className="text-sm text-text-muted">Loading posts…</p>}
            {!postsLoading && posts.length === 0 && (
              <div className="rounded-2xl border border-border bg-panel p-8 text-center text-sm text-text-muted">
                No posts yet. Compose a post or ask the Social Media Manager agent in project chat.
              </div>
            )}
            <div className="space-y-3">
              {posts.map((post) => (
                <div key={post.id} className="rounded-2xl border border-border bg-panel p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2 text-xs text-text-muted">
                        <ToolLogo slug={post.platform === "x-twitter" ? "x-twitter" : post.platform} className="h-4 w-4" />
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
                        {post.publishedAt && (
                          <span>Published {formatRelativeTime(post.publishedAt)}</span>
                        )}
                      </div>
                      <p className="mt-2 whitespace-pre-wrap text-sm text-text">{post.content}</p>
                      {post.errorDetail && (
                        <p className="mt-2 text-xs text-red-300">{post.errorDetail}</p>
                      )}
                    </div>
                    {(post.status === "draft" || post.status === "scheduled") && (
                      <PublishButton postId={post.id} onDone={refresh} />
                    )}
                  </div>
                </div>
              ))}
            </div>
          </>
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

function AccountCard({ account, onUpdated }: { account: SocialAccount; onUpdated: () => void }) {
  const deleteMutation = useMutation({
    mutationFn: () => api.deleteSocialAccount(account.id),
    onSuccess: onUpdated,
  });

  return (
    <div className="rounded-2xl border border-border bg-panel p-4">
      <div className="flex items-start gap-3">
        <ToolLogo slug={account.platform === "x-twitter" ? "x-twitter" : account.platform} className="h-8 w-8" />
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

  const selected = platforms.find((p) => p.id === platform);

  return (
    <Modal title="Connect social handle" onClose={onClose}>
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
      {selected && !selected.workspaceConnected && (
        <p className="mb-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
          Connect {selected.label} in the App Store before publishing live.
        </p>
      )}
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
  platforms: { id: string; label: string }[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [platform, setPlatform] = useState(accounts[0]?.platform ?? platforms[0]?.id ?? "instagram");
  const [content, setContent] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [publishNow, setPublishNow] = useState(false);

  const mutation = useMutation({
    mutationFn: () =>
      api.createSocialPost({
        platform,
        content,
        scheduledAt: !publishNow && scheduledAt ? new Date(scheduledAt).toISOString() : undefined,
        publishNow,
        handle: accounts.find((a) => a.platform === platform)?.handle,
      }),
    onSuccess: () => {
      onSaved();
      onClose();
    },
  });

  return (
    <Modal title="Compose post" onClose={onClose}>
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
        Publish immediately
      </label>
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onClose} className="rounded-xl border border-border px-4 py-2 text-sm">
          Cancel
        </button>
        <button
          type="button"
          disabled={!content.trim() || mutation.isPending}
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
        className="w-full max-w-md rounded-2xl border border-border bg-panel p-5 shadow-2xl"
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
