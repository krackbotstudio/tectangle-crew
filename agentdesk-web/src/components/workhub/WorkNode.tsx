import { memo } from "react";
import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import { Bot, FolderKanban, Link2, ListTodo, Unlink, Zap } from "lucide-react";
import { cn } from "../../lib/utils";
import { AgentAvatar } from "../workspace/TagEditor";
import type { WorkNodeData } from "./workHubGraph";
import { NODE_KIND_META, standaloneTaskBorder } from "./workNodeStyles";

const KIND_ICONS = {
  project: FolderKanban,
  activity: Zap,
  task: ListTodo,
} as const;

function WorkNodeComponent({ data, selected, parentId }: NodeProps<Node<WorkNodeData>>) {
  const meta = NODE_KIND_META[data.kind];
  const Icon = KIND_ICONS[data.kind];
  const isTask = data.kind === "task";
  const isNested = !!parentId;
  const isAttached =
    isTask && data.isAttached !== false && !!(data.item as { activityId?: string | null }).activityId;

  if (isNested && isTask) {
    return (
      <div
        className={cn(
          "group relative flex w-full items-center gap-2 rounded-lg border border-violet-400/40 bg-violet-500/8 px-2.5 py-1.5 shadow-[0_0_10px_rgba(167,139,250,0.1)] transition-all",
          data.isDropTarget && "ring-2 ring-teal-300",
          selected && "ring-2 ring-white/30"
        )}
      >
        <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md border border-violet-400/30 bg-violet-500/15">
          <ListTodo className="h-3 w-3 text-violet-300" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[11px] font-semibold text-text-strong">{data.label}</div>
          {data.agentName && (
            <div className="truncate text-[9px] text-text-faint">{data.agentName}</div>
          )}
        </div>
        <span className="shrink-0 rounded-full border border-border bg-panel px-1.5 py-0.5 text-[8px] capitalize text-text-muted">
          {data.status.replace("_", " ")}
        </span>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "group relative rounded-xl bg-[#141414]/98 backdrop-blur-sm transition-all duration-200",
        meta.width,
        meta.glow,
        isTask ? standaloneTaskBorder(isAttached) : meta.border,
        data.isDropTarget && "ring-2 ring-teal-300",
        selected && "ring-2 ring-white/30"
      )}
    >
      <div className={cn("rounded-t-2xl px-3 py-2", meta.headerBg)}>
        <div className="flex items-center gap-2">
          <div
            className={cn(
              "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border",
              meta.iconBg
            )}
          >
            <Icon className={cn("h-4 w-4", meta.iconColor)} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold text-text-strong">{data.label}</div>
            <div className={cn("text-[9px] font-bold uppercase tracking-[0.14em]", meta.headerText)}>
              {meta.label}
            </div>
          </div>
        </div>
      </div>

      {data.kind !== "project" && (
        <Handle
          type="target"
          position={Position.Left}
          id="target"
          className={cn("!h-3.5 !w-3.5 !border-2 !border-[#121212]", meta.handleTarget)}
        />
      )}

      <div className="relative px-3 pb-3 pt-2">
        {data.subtitle && (
          <p className="line-clamp-2 text-[11px] leading-relaxed text-text-muted">{data.subtitle}</p>
        )}

        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <span className="rounded-full border border-border bg-panel px-2 py-0.5 text-[10px] capitalize text-text-muted">
            {data.status.replace("_", " ")}
          </span>
          {data.scheduleType && data.scheduleType !== "one_time" && (
            <span className="rounded-full border border-dashed border-neutral-500 px-2 py-0.5 text-[10px] text-text-faint">
              {data.scheduleType}
            </span>
          )}
          {isTask && (
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px]",
                isAttached
                  ? "bg-teal-500/15 text-teal-300"
                  : "bg-panel-elevated text-text-faint"
              )}
            >
              {isAttached ? (
                <>
                  <Link2 className="h-2.5 w-2.5" /> Attached
                </>
              ) : (
                <>
                  <Unlink className="h-2.5 w-2.5" /> Standalone
                </>
              )}
            </span>
          )}
        </div>

        {data.agentName ? (
          <div className="mt-2 flex items-center gap-1.5 text-[10px] text-text-faint">
            <AgentAvatar name={data.agentName} color={data.agentColor ?? undefined} size="sm" />
            <span className="truncate">{data.agentName}</span>
          </div>
        ) : data.kind !== "project" ? (
          <div className="mt-2 flex items-center gap-1 text-[10px] text-text-faint">
            <Bot className="h-3 w-3" />
            No agent
          </div>
        ) : null}

        {isTask && !isAttached && (
          <p className="mt-2 text-[10px] text-text-faint">Drag into an activity to attach</p>
        )}
      </div>

      {data.kind !== "task" && (
        <Handle
          type="source"
          position={Position.Right}
          id="source"
          className={cn("!h-3.5 !w-3.5 !border-2 !border-[#121212]", meta.handleSource)}
        />
      )}

      {isTask && (
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

export const WorkNode = memo(WorkNodeComponent);
