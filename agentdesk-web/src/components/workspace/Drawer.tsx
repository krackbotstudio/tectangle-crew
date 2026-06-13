import { useEffect } from "react";
import { X } from "lucide-react";
import { cn } from "../../lib/utils";

interface DrawerProps {
  open: boolean;
  onClose: () => void;
  side?: "left" | "right";
  title?: string;
  children: React.ReactNode;
}

export function Drawer({ open, onClose, side = "left", title, children }: DrawerProps) {
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 lg:hidden">
      <button
        type="button"
        aria-label="Close panel"
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cn(
          "absolute top-0 flex h-full w-[min(100vw,320px)] flex-col bg-panel shadow-2xl",
          side === "left" ? "left-0 border-r border-border-subtle" : "right-0 border-l border-border-subtle"
        )}
      >
        {title && (
          <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3">
            <span className="text-sm font-semibold text-text-strong">{title}</span>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1.5 hover:bg-panel-hover"
              aria-label="Close"
            >
              <X className="h-4 w-4 text-text-muted" />
            </button>
          </div>
        )}
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">{children}</div>
      </div>
    </div>
  );
}
