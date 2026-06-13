import { cn } from "../../lib/utils";

export function DashboardCard({
  className,
  children,
  hover,
}: {
  className?: string;
  children: React.ReactNode;
  hover?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-border bg-panel p-5",
        hover && "transition hover:border-neutral-600 hover:bg-panel-hover",
        className
      )}
    >
      {children}
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-text-strong sm:text-2xl">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-text-muted">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function MetricCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string | number;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <DashboardCard>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm text-text-muted">{label}</p>
          <p className="mt-1 text-3xl font-semibold tracking-tight text-text-strong">{value}</p>
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-panel-elevated">
          <Icon className="h-5 w-5 text-text-muted" />
        </div>
      </div>
    </DashboardCard>
  );
}

/** Nav/list row — dark grey when selected; hover keeps light text */
export function listItemNavClass(isActive: boolean, extra?: string) {
  return cn(
    "rounded-xl transition",
    extra,
    isActive
      ? "bg-list-selected text-text-strong hover:bg-list-selected-hover"
      : "text-text hover:bg-panel-hover hover:text-text-strong"
  );
}
