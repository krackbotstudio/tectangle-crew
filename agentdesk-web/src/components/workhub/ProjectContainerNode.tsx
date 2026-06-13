import { memo } from "react";
import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import { FolderKanban } from "lucide-react";
import { cn } from "../../lib/utils";
import type { WorkProject } from "../../lib/api";
import type { WorkNodeData } from "./workHubGraph";
import { NODE_KIND_META } from "./workNodeStyles";

export type ProjectContainerData = WorkNodeData & {
  kind: "project";
  childActivityCount: number;
  item: WorkProject;
};

function ProjectContainerNodeComponent({
  data,
  selected,
}: NodeProps<Node<ProjectContainerData>>) {
  const meta = NODE_KIND_META.project;
  const project = data.item as WorkProject;

  return (
    <div
      className={cn(
        "rounded-2xl border-2 bg-[#0e0e0e]/95 backdrop-blur-sm transition-all duration-200",
        meta.border,
        meta.glow,
        data.isDropTarget && "ring-2 ring-[#863bff] scale-[1.01]",
        selected && "ring-2 ring-white/30"
      )}
      style={{ width: data.containerWidth ?? 292, minHeight: data.containerHeight ?? 160 }}
    >
      <div className={cn("rounded-t-2xl px-3 py-2.5", meta.headerBg)}>
        <div className="flex items-center gap-2">
          <div className={cn("flex h-9 w-9 items-center justify-center rounded-lg border", meta.iconBg)}>
            <FolderKanban className={cn("h-4 w-4", meta.iconColor)} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold text-text-strong">{data.label}</div>
            <div className={cn("text-[9px] font-bold uppercase tracking-[0.14em]", meta.headerText)}>
              Project
            </div>
          </div>
        </div>
        {project.description && (
          <p className="mt-1.5 line-clamp-2 text-[11px] text-text-muted">{project.description}</p>
        )}
        <span className="mt-2 inline-block rounded-full border border-border bg-panel px-2 py-0.5 text-[10px] capitalize text-text-muted">
          {data.status.replace("_", " ")}
        </span>
      </div>

      <div
        className={cn(
          "mx-2 mb-2 mt-1 rounded-xl border border-dashed px-2 py-2 transition",
          data.isDropTarget
            ? "border-[#863bff]/60 bg-[#863bff]/10"
            : "border-border/80 bg-black/20"
        )}
        style={{ minHeight: Math.max(56, (data.childActivityCount || 0) * 8) }}
      >
        <div className="mb-1 text-[9px] font-semibold uppercase tracking-wider text-text-faint">
          Activities · drop here to attach
        </div>
      </div>

      <Handle
        type="target"
        position={Position.Left}
        id="target"
        className={cn("!h-3.5 !w-3.5 !border-2 !border-[#121212]", meta.handleTarget)}
      />
      <Handle
        type="source"
        position={Position.Right}
        id="source"
        className={cn("!h-3.5 !w-3.5 !border-2 !border-[#121212]", meta.handleSource)}
      />
    </div>
  );
}

export const ProjectContainerNode = memo(ProjectContainerNodeComponent);
