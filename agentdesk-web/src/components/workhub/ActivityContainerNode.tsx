import { memo } from "react";
import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import { Bot, Link2, Unlink, Zap } from "lucide-react";
import { cn } from "../../lib/utils";
import { AgentAvatar } from "../workspace/TagEditor";
import type { WorkActivity } from "../../lib/api";
import type { WorkNodeData } from "./workHubGraph";
import { NODE_KIND_META } from "./workNodeStyles";

export type ActivityContainerData = WorkNodeData & {
  kind: "activity";
  childTaskCount: number;
  isLinkedToProject: boolean;
  item: WorkActivity;
};

function ActivityContainerNodeComponent({
  data,
  selected,
  parentId,
}: NodeProps<Node<ActivityContainerData>>) {
  const meta = NODE_KIND_META.activity;
  const nested = !!parentId;
  const dropMinHeight = Math.max(48, (data.childTaskCount || 0) * 4);

  return (
    <div
      className={cn(
        "rounded-2xl border-2 bg-[#101010]/95 backdrop-blur-sm transition-all duration-200",
        nested ? "border-teal-400/50" : meta.border,
        meta.glow,
        data.isDropTarget && "ring-2 ring-teal-300 scale-[1.02]",
        selected && "ring-2 ring-white/30"
      )}
      style={{ width: data.containerWidth ?? 236, minHeight: data.containerHeight ?? 140 }}
    >
      <div className={cn("rounded-t-2xl px-3 py-2", meta.headerBg)}>
        <div className="flex items-center gap-2">
          <div className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border", meta.iconBg)}>
            <Zap className={cn("h-4 w-4", meta.iconColor)} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold text-text-strong">{data.label}</div>
            <div className={cn("text-[9px] font-bold uppercase tracking-[0.14em]", meta.headerText)}>
              Activity
            </div>
          </div>
        </div>
      </div>

      {!nested && (
        <Handle
          type="target"
          position={Position.Left}
          id="target"
          className={cn("!h-3.5 !w-3.5 !border-2 !border-[#121212]", meta.handleTarget)}
        />
      )}

      <div className="px-3 pt-1">
        {data.subtitle && (
          <p className="line-clamp-2 text-[11px] leading-relaxed text-text-muted">{data.subtitle}</p>
        )}
        <div className="mt-1.5 flex flex-wrap gap-1">
          <span className="rounded-full border border-border bg-panel px-2 py-0.5 text-[10px] capitalize text-text-muted">
            {data.status.replace("_", " ")}
          </span>
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px]",
              data.isLinkedToProject || nested
                ? "bg-teal-500/15 text-teal-300"
                : "bg-panel-elevated text-text-faint"
            )}
          >
            {data.isLinkedToProject || nested ? (
              <>
                <Link2 className="h-2.5 w-2.5" /> In project
              </>
            ) : (
              <>
                <Unlink className="h-2.5 w-2.5" /> Standalone
              </>
            )}
          </span>
        </div>
        {data.agentName ? (
          <div className="mt-1.5 flex items-center gap-1.5 text-[10px] text-text-faint">
            <AgentAvatar name={data.agentName} color={data.agentColor ?? undefined} size="sm" />
            {data.agentName}
          </div>
        ) : (
          <div className="mt-1.5 flex items-center gap-1 text-[10px] text-text-faint">
            <Bot className="h-3 w-3" /> No agent
          </div>
        )}
      </div>

      <div
        className={cn(
          "pointer-events-none mx-2 mb-2 mt-2 rounded-xl border border-dashed px-2 py-1.5 transition",
          data.isDropTarget
            ? "border-teal-400/70 bg-teal-500/10"
            : "border-violet-400/25 bg-violet-500/5"
        )}
        style={{ minHeight: dropMinHeight }}
      >
        <div className="text-[9px] font-semibold uppercase tracking-wider text-text-faint">
          Steps inside · {data.childTaskCount ?? 0} attached
        </div>
        {(data.childTaskCount ?? 0) === 0 && (
          <p className="mt-1 text-[10px] text-text-faint">Drop step cards here</p>
        )}
      </div>

      {!nested && (
        <Handle
          type="source"
          position={Position.Right}
          id="source"
          className={cn("!h-3.5 !w-3.5 !border-2 !border-[#121212]", meta.handleSource)}
        />
      )}
    </div>
  );
}

export const ActivityContainerNode = memo(ActivityContainerNodeComponent);
