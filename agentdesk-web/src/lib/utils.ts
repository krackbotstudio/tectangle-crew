import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const diff = Date.now() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export const AGENT_ICONS: Record<string, string> = {
  content: "✍️",
  design: "🎨",
  development: "💻",
  marketing: "📣",
  sales: "🤝",
  hr: "👥",
  orchestrator: "🔀",
};

export const STATUS_STYLES: Record<string, string> = {
  queued: "bg-panel-elevated text-text-muted border border-border",
  running: "bg-accent-light text-accent-fg",
  done: "bg-neutral-700 text-neutral-200",
  failed: "bg-transparent text-text-strong border border-neutral-500",
  pending_approval: "bg-panel-elevated text-text-muted border border-dashed border-neutral-500",
};

const AVATAR_SHADES = ["#0a0a0a", "#262626", "#404040", "#525252", "#737373"];

export function avatarShadeFromName(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_SHADES[Math.abs(hash) % AVATAR_SHADES.length];
}
