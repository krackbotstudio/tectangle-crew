import { useEffect, useRef } from "react";
import { FolderKanban, FolderOpen, ListTodo, Plus, Zap } from "lucide-react";
import type { WorkItemKind } from "../workspace/WorkItemModal";

export function WorkCanvasContextMenu({
  position,
  onClose,
  onCreate,
  onAddExisting,
}: {
  position: { x: number; y: number };
  onClose: () => void;
  onCreate: (kind: WorkItemKind) => void;
  onAddExisting: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onPointerDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as HTMLElement)) onClose();
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [onClose]);

  const items: { kind: WorkItemKind; label: string; icon: typeof Plus; desc: string }[] = [
    { kind: "project", label: "New project", icon: FolderKanban, desc: "Group activities" },
    { kind: "activity", label: "New activity", icon: Zap, desc: "Initiative with steps" },
    { kind: "task", label: "New step", icon: ListTodo, desc: "Standalone or attach later" },
  ];

  const x = Math.min(position.x, window.innerWidth - 240);
  const y = Math.min(position.y, window.innerHeight - 220);

  return (
    <div
      ref={ref}
      className="fixed z-[100] w-[220px] overflow-hidden rounded-2xl border border-border bg-panel shadow-2xl"
      style={{ left: x, top: y }}
      onContextMenu={(e) => e.preventDefault()}
    >
      <div className="border-b border-border px-3 py-2.5 text-xs font-semibold text-text-muted">
        <Plus className="mr-1.5 inline h-3.5 w-3.5" />
        Add to canvas
      </div>
      <button
        type="button"
        onClick={() => {
          onAddExisting();
          onClose();
        }}
        className="flex w-full items-start gap-2.5 border-b border-border px-3 py-2.5 text-left hover:bg-panel-hover"
      >
        <FolderOpen className="mt-0.5 h-4 w-4 shrink-0 text-text-muted" />
        <span>
          <span className="block text-sm text-text-strong">Existing project group</span>
          <span className="block text-[10px] text-text-faint">From Groups</span>
        </span>
      </button>
      {items.map(({ kind, label, icon: Icon, desc }) => (
        <button
          key={kind}
          type="button"
          onClick={() => {
            onCreate(kind);
            onClose();
          }}
          className="flex w-full items-start gap-2.5 px-3 py-2.5 text-left hover:bg-panel-hover"
        >
          <Icon className="mt-0.5 h-4 w-4 shrink-0 text-text-muted" />
          <span>
            <span className="block text-sm text-text-strong">{label}</span>
            <span className="block text-[10px] text-text-faint">{desc}</span>
          </span>
        </button>
      ))}
    </div>
  );
}
