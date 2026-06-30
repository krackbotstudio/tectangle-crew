import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Calendar, Download, Loader2, Send, X } from "lucide-react";
import { api, type AgentCreative, getToken } from "../../lib/api";
import { cn } from "../../lib/utils";

/** Resolve creative file path for Vite `/api` proxy (avoid double `/api/api`). */
function toApiUrl(downloadPath: string): string {
  if (downloadPath.startsWith("/api/")) return downloadPath;
  return `/api${downloadPath.startsWith("/") ? downloadPath : `/${downloadPath}`}`;
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
        const res = await fetch(toApiUrl(downloadPath), {
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

export function CreativeAttachment({
  creative,
  projectId,
  onUpdated,
}: {
  creative: AgentCreative;
  projectId?: string;
  onUpdated?: () => void;
}) {
  const queryClient = useQueryClient();
  const { url, error } = useAuthenticatedImageUrl(creative.downloadUrl);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [platform, setPlatform] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const { data: platformsData } = useQuery({
    queryKey: ["creative-platforms", creative.id],
    queryFn: () => api.getCreativePublishPlatforms(creative.id),
    enabled: !!projectId,
  });

  const platforms = platformsData?.platforms ?? [];

  const publishMutation = useMutation({
    mutationFn: (p: string) => api.publishCreative(creative.id, p),
    onSuccess: (result) => {
      setStatusMessage(result.message);
      queryClient.invalidateQueries({ queryKey: ["messages"] });
      onUpdated?.();
    },
  });

  const scheduleMutation = useMutation({
    mutationFn: () => api.scheduleCreative(creative.id, platform, scheduledAt),
    onSuccess: (result) => {
      setStatusMessage(result.message);
      setScheduleOpen(false);
      queryClient.invalidateQueries({ queryKey: ["messages"] });
      onUpdated?.();
    },
  });

  async function downloadImage() {
    const token = getToken();
    const res = await fetch(toApiUrl(creative.downloadUrl), {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) return;
    const blob = await res.blob();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `creative-${creative.purpose ?? creative.id}.png`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <div className="mt-3 overflow-hidden rounded-xl border border-border bg-panel-elevated">
      <div className="relative aspect-square max-h-80 w-full bg-black/20">
        {!url && !error && (
          <div className="flex h-full items-center justify-center text-xs text-text-muted">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Loading preview…
          </div>
        )}
        {error && (
          <div className="flex h-full items-center justify-center p-4 text-xs text-text-muted">
            Could not load image preview
          </div>
        )}
        {url && (
          <img src={url} alt={creative.prompt} className="h-full w-full object-contain" />
        )}
      </div>
      <div className="space-y-2 border-t border-border-subtle p-3">
        <div className="flex flex-wrap gap-1.5 text-[10px] text-text-faint">
          {creative.width && creative.height && (
            <span className="rounded border border-border px-1.5 py-0.5">
              {creative.width}×{creative.height}
            </span>
          )}
          {creative.purpose && (
            <span className="rounded border border-border px-1.5 py-0.5">{creative.purpose}</span>
          )}
          {creative.status !== "generated" && (
            <span
              className={cn(
                "rounded border px-1.5 py-0.5",
                creative.status === "published"
                  ? "border-emerald-500/30 text-emerald-200"
                  : "border-sky-500/30 text-sky-200"
              )}
            >
              {creative.status}
              {creative.publishPlatform ? ` → ${creative.publishPlatform}` : ""}
            </span>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void downloadImage()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs text-text-strong hover:bg-panel-hover"
          >
            <Download className="h-3.5 w-3.5" />
            Download
          </button>
          {platforms.length > 0 ? (
            <>
              <select
                value={platform}
                onChange={(e) => setPlatform(e.target.value)}
                className="rounded-lg border border-border bg-panel px-2 py-1.5 text-xs text-text outline-none"
              >
                <option value="">Platform…</option>
                {platforms.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </select>
              <button
                type="button"
                disabled={!platform || publishMutation.isPending}
                onClick={() => platform && publishMutation.mutate(platform)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs text-text-strong hover:bg-panel-hover disabled:opacity-50"
              >
                {publishMutation.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Send className="h-3.5 w-3.5" />
                )}
                Publish now
              </button>
              <button
                type="button"
                disabled={!platform}
                onClick={() => setScheduleOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs text-text-strong hover:bg-panel-hover disabled:opacity-50"
              >
                <Calendar className="h-3.5 w-3.5" />
                Schedule
              </button>
            </>
          ) : (
            <span className="text-[10px] text-text-faint">
              Connect Instagram, Facebook, LinkedIn, or Buffer in the App Store to publish.
            </span>
          )}
        </div>
        {statusMessage && <p className="text-[11px] text-emerald-200/90">{statusMessage}</p>}
      </div>

      {scheduleOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-sm rounded-2xl border border-border bg-panel p-4 shadow-xl">
            <div className="mb-3 flex items-center justify-between">
              <h4 className="font-medium text-text-strong">Schedule creative</h4>
              <button type="button" onClick={() => setScheduleOpen(false)} className="rounded p-1 hover:bg-panel-hover">
                <X className="h-4 w-4" />
              </button>
            </div>
            <label className="mb-3 block text-xs text-text-muted">
              Date & time
              <input
                type="datetime-local"
                value={scheduledAt}
                onChange={(e) => setScheduledAt(e.target.value)}
                className="mt-1 w-full rounded-xl border border-border bg-panel-elevated px-3 py-2 text-sm text-text outline-none"
              />
            </label>
            <p className="mb-3 text-[11px] text-text-faint">
              Publishing to <strong>{platforms.find((p) => p.id === platform)?.label ?? platform}</strong>
            </p>
            <button
              type="button"
              disabled={!scheduledAt || scheduleMutation.isPending}
              onClick={() => scheduleMutation.mutate()}
              className="w-full rounded-xl bg-accent py-2 text-sm text-accent-muted-fg hover:bg-accent-hover disabled:opacity-50"
            >
              {scheduleMutation.isPending ? "Scheduling…" : "Confirm schedule"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
