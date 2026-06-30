import { useState } from "react";
import { Plug } from "lucide-react";
import { getToolLogoMeta, getToolLogoUrl } from "../../lib/toolLogos";
import { cn } from "../../lib/utils";

export function ToolLogo({
  slug,
  name,
  size = "md",
  className,
}: {
  slug: string;
  name: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const url = getToolLogoUrl(slug);
  const meta = getToolLogoMeta(slug);

  const box = {
    sm: "h-8 w-8 rounded-lg",
    md: "h-10 w-10 rounded-xl",
    lg: "h-12 w-12 rounded-xl",
  }[size];

  const img = {
    sm: "h-4 w-4",
    md: "h-5 w-5",
    lg: "h-6 w-6",
  }[size];

  if (!url || failed) {
    return (
      <div
        className={cn(
          "flex shrink-0 items-center justify-center bg-panel font-semibold text-text-muted",
          box,
          className
        )}
        aria-hidden
      >
        {name.charAt(0).toUpperCase()}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center border border-border/60 bg-white/95 p-1.5 shadow-sm",
        box,
        className
      )}
    >
      <img
        src={url}
        alt=""
        className={cn("object-contain", img)}
        loading="lazy"
        decoding="async"
        onError={() => setFailed(true)}
        title={meta?.icon ? `${name} logo` : undefined}
      />
    </div>
  );
}

export function ToolLogoFallback({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border bg-panel text-text-muted",
        className
      )}
    >
      <Plug className="h-4 w-4" />
    </div>
  );
}
