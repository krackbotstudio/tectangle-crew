import { cn } from "../../lib/utils";

type GlassVariant = "default" | "brand" | "elevated";

const variantClass: Record<GlassVariant, string> = {
  default: "border-border bg-panel",
  brand:
    "border-border bg-panel bg-gradient-to-br from-brand-purple/[0.08] via-panel to-panel",
  elevated: "border-border bg-panel-elevated",
};

export function GlassCard({
  className,
  children,
  variant = "default",
  hover,
  padding = true,
}: {
  className?: string;
  children: React.ReactNode;
  variant?: GlassVariant;
  hover?: boolean;
  padding?: boolean;
}) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl border",
        variantClass[variant],
        padding && "p-5",
        hover && "transition hover:border-neutral-600 hover:bg-panel-hover",
        className
      )}
    >
      {children}
    </div>
  );
}

export function SectionLabel({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
      <div>
        <h2 className="text-sm font-semibold tracking-tight text-text-strong">{title}</h2>
        {subtitle && <p className="mt-0.5 text-xs text-text-muted">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}
