import type { Edge, Node } from "@xyflow/react";
import type { WorkActivity, WorkHub, WorkProject, WorkTask } from "../../lib/api";
import { NODE_KIND_META } from "./workNodeStyles";
import type { CanvasNestState } from "./workHubCanvasLayout";
import {
  countNestedActivitiesInProject,
  isActivityNested,
  isTaskNested,
  nestedTasksInActivity,
} from "./workHubCanvasLayout";

export type WorkNodeKind = "project" | "activity" | "task";

export type WorkNodeData = {
  kind: WorkNodeKind;
  label: string;
  subtitle?: string;
  status: string;
  agentName?: string | null;
  agentColor?: string | null;
  scheduleType?: string;
  priority?: string;
  isAttached?: boolean;
  isNested?: boolean;
  isDropTarget?: boolean;
  isLinkedToProject?: boolean;
  childTaskCount?: number;
  childActivityCount?: number;
  containerWidth?: number;
  containerHeight?: number;
  hostProjectId?: string | null;
  item: WorkProject | WorkActivity | WorkTask;
};

export type WorkNodeSelection = {
  kind: WorkNodeKind;
  item: WorkProject | WorkActivity | WorkTask;
};

const PROJECT_W = 292;
const ACTIVITY_W = 236;
const TASK_W = 208;
const TASK_TILE_H = 40;
const TASK_TILE_GAP = 6;
const ACTIVITY_HEADER = 108;
const ACTIVITY_DROP_PAD = 10;
const PROJECT_HEADER = 100;
const PROJECT_INNER_PAD = 16;
const GAP_Y = 48;
const COL_X = { project: 0, activity: 380, task: 680 } as const;

function nodeId(kind: WorkNodeKind, id: string) {
  return `${kind}:${id}`;
}

function activityNodeId(activityId: string) {
  return `activity:${activityId}`;
}

function activityHeight(nestedTaskCount: number) {
  const dropInner = Math.max(44, nestedTaskCount * (TASK_TILE_H + TASK_TILE_GAP) + 8);
  return ACTIVITY_HEADER + ACTIVITY_DROP_PAD + dropInner + 8;
}

function projectHeight(nestedActivityCount: number, activityHeights: number[]) {
  const inner =
    nestedActivityCount === 0
      ? 72
      : activityHeights.reduce((a, b) => a + b, 0) + Math.max(0, nestedActivityCount - 1) * 12;
  return PROJECT_HEADER + inner + PROJECT_INNER_PAD;
}

function pushEdge(
  edges: Edge[],
  source: string,
  target: string,
  fromKind: WorkNodeKind,
  toKind: WorkNodeKind
) {
  const edgeId = `e-${source}-${target}`;
  if (edges.some((e) => e.id === edgeId)) return;
  edges.push({
    id: edgeId,
    source,
    target,
    sourceHandle: "source",
    targetHandle: "target",
    type: "workGradient",
    data: {
      sourceColor: NODE_KIND_META[fromKind].edgeColor,
      targetColor: NODE_KIND_META[toKind].edgeColor,
    },
  });
}

export function getActivityIdFromNode(node: Node<WorkNodeData>): string | null {
  if (node.data.kind !== "activity") return null;
  return (node.data.item as WorkActivity).id;
}

export function getTaskIdFromNode(node: Node<WorkNodeData>): string | null {
  if (node.data.kind !== "task") return null;
  return (node.data.item as WorkTask).id;
}

export function getProjectIdFromNode(node: Node<WorkNodeData>): string | null {
  if (node.data.kind !== "project") return null;
  return (node.data.item as WorkProject).id;
}

export function parseNodeSelection(node: Node<WorkNodeData> | null): WorkNodeSelection | null {
  if (!node?.data) return null;
  return { kind: node.data.kind, item: node.data.item };
}

export function isValidWorkConnection(
  sourceKind: WorkNodeKind,
  targetKind: WorkNodeKind
): boolean {
  return (
    (sourceKind === "project" && targetKind === "activity") ||
    (sourceKind === "activity" && targetKind === "project") ||
    (sourceKind === "activity" && targetKind === "task") ||
    (sourceKind === "task" && targetKind === "activity")
  );
}

export type WorkConnectionAction =
  | { type: "connect-activity"; activityId: string; projectId: string }
  | { type: "connect-task"; taskId: string; activityId: string }
  | { type: "disconnect-activity"; activityId: string; projectId: string }
  | { type: "disconnect-task"; taskId: string };

export function resolveWorkConnection(
  sourceNode: Node<WorkNodeData>,
  targetNode: Node<WorkNodeData>
): WorkConnectionAction | null {
  const sk = sourceNode.data.kind;
  const tk = targetNode.data.kind;

  if (sourceNode.parentId || targetNode.parentId) return null;

  if (sk === "project" && tk === "activity") {
    const activityId = getActivityIdFromNode(targetNode);
    const projectId = getProjectIdFromNode(sourceNode);
    return activityId && projectId ? { type: "connect-activity", activityId, projectId } : null;
  }
  if (sk === "activity" && tk === "project") {
    const activityId = getActivityIdFromNode(sourceNode);
    const projectId = getProjectIdFromNode(targetNode);
    return activityId && projectId ? { type: "connect-activity", activityId, projectId } : null;
  }
  if (sk === "activity" && tk === "task") {
    const taskId = getTaskIdFromNode(targetNode);
    const activityId = getActivityIdFromNode(sourceNode);
    return taskId && activityId ? { type: "connect-task", taskId, activityId } : null;
  }
  if (sk === "task" && tk === "activity") {
    const taskId = getTaskIdFromNode(sourceNode);
    const activityId = getActivityIdFromNode(targetNode);
    return taskId && activityId ? { type: "connect-task", taskId, activityId } : null;
  }
  return null;
}

export function resolveWorkEdgeRemoval(
  sourceNode: Node<WorkNodeData>,
  targetNode: Node<WorkNodeData>
): WorkConnectionAction | null {
  const connect = resolveWorkConnection(sourceNode, targetNode);
  if (!connect) return null;
  if (connect.type === "connect-activity") {
    return {
      type: "disconnect-activity",
      activityId: connect.activityId,
      projectId: connect.projectId,
    };
  }
  if (connect.type === "connect-task") {
    return { type: "disconnect-task", taskId: connect.taskId };
  }
  return null;
}

export const PROJECT_DROP_ZONE_TOP = PROJECT_HEADER;
export const ACTIVITY_DROP_ZONE_TOP = ACTIVITY_HEADER;

export function buildWorkGraph(
  hub: WorkHub,
  nestState: CanvasNestState,
  filterProjectId: string | null = null
): { nodes: Node<WorkNodeData>[]; edges: Edge[] } {
  const nodes: Node<WorkNodeData>[] = [];
  const edges: Edge[] = [];
  const activityNodeIdByEntity = new Map<string, string>();
  let projectY = 40;
  let activityY = 40;
  let taskY = 40;

  const projects = filterProjectId
    ? hub.projects.filter((p) => p.id === filterProjectId)
    : hub.projects;

  const activities = filterProjectId
    ? hub.allActivities.filter(
        (a) =>
          a.workProjectId === filterProjectId ||
          (a.linkedProjectIds ?? []).includes(filterProjectId)
      )
    : hub.allActivities;

  const tasks = filterProjectId
    ? hub.allTasks.filter(
        (t) =>
          !t.activityId ||
          activities.some((a) => a.id === t.activityId)
      )
    : hub.allTasks;

  for (const project of projects) {
    const pid = nodeId("project", project.id);
    const nestedActivityIds = Object.entries(nestState.nestedActivities)
      .filter(([, pId]) => pId === project.id)
      .map(([aId]) => aId);
    const nestedActivities = nestedActivityIds
      .map((id) => activities.find((a) => a.id === id))
      .filter(Boolean) as WorkActivity[];
    const actHeights = nestedActivities.map((a) =>
      activityHeight(nestedTasksInActivity(nestState, a.id, tasks).length)
    );
    const pHeight = projectHeight(nestedActivities.length, actHeights);

    nodes.push({
      id: pid,
      type: "projectContainer",
      position: { x: COL_X.project, y: projectY },
      draggable: false,
      selectable: true,
      connectable: true,
      data: {
        kind: "project",
        label: project.title,
        subtitle: project.description ?? undefined,
        status: project.status,
        childActivityCount: nestedActivities.length,
        containerWidth: PROJECT_W,
        containerHeight: pHeight,
        item: project,
      },
      style: { width: PROJECT_W, height: pHeight },
    });

    let innerY = PROJECT_HEADER;
    nestedActivities.forEach((activity, ai) => {
      const aid = activityNodeId(activity.id);
      activityNodeIdByEntity.set(activity.id, aid);
      const nestedTasks = nestedTasksInActivity(nestState, activity.id, tasks);
      const aHeight = actHeights[ai];

      nodes.push({
        id: aid,
        type: "activityContainer",
        parentId: pid,
        expandParent: true,
        position: { x: PROJECT_INNER_PAD, y: innerY },
        draggable: true,
        connectable: true,
        data: {
          kind: "activity",
          label: activity.title,
          subtitle: activity.description ?? `${nestedTasks.length} steps inside`,
          status: activity.status,
          agentName: activity.agentName,
          agentColor: activity.agentColor,
          scheduleType: activity.scheduleType,
          priority: activity.priority,
          childTaskCount: nestedTasks.length,
          isLinkedToProject: true,
          isNested: true,
          hostProjectId: project.id,
          containerWidth: PROJECT_W - PROJECT_INNER_PAD * 2,
          containerHeight: aHeight,
          item: activity,
        },
        style: { width: PROJECT_W - PROJECT_INNER_PAD * 2, height: aHeight },
      });

      nestedTasks.forEach((task, ti) => {
        nodes.push({
          id: nodeId("task", task.id),
          type: "taskNode",
          parentId: aid,
          extent: "parent",
          expandParent: true,
          position: {
            x: 8,
            y: ACTIVITY_HEADER + ACTIVITY_DROP_PAD + 4 + ti * (TASK_TILE_H + TASK_TILE_GAP),
          },
          draggable: true,
          connectable: true,
          data: {
            kind: "task",
            label: task.title,
            subtitle: task.description ?? undefined,
            status: task.status,
            agentName: task.agentName,
            agentColor: task.agentColor,
            scheduleType: task.scheduleType,
            priority: task.priority,
            isAttached: true,
            isNested: true,
            containerWidth: TASK_W,
            item: task,
          },
          style: { width: TASK_W, height: TASK_TILE_H },
        });
      });

      innerY += aHeight + 12;
    });

    projectY += pHeight + GAP_Y;
  }

  for (const activity of activities) {
    if (isActivityNested(nestState, activity.id)) continue;

    const aid = activityNodeId(activity.id);
    activityNodeIdByEntity.set(activity.id, aid);
    const nestedTasks = nestedTasksInActivity(nestState, activity.id, tasks);
    const aHeight = activityHeight(nestedTasks.length);
    const linkedProjectIds = activity.linkedProjectIds ?? [];
    const hasProjectLink =
      !!activity.workProjectId || linkedProjectIds.length > 0;

    nodes.push({
      id: aid,
      type: "activityContainer",
      position: { x: COL_X.activity, y: activityY },
      draggable: true,
      connectable: true,
      data: {
        kind: "activity",
        label: activity.title,
        subtitle: activity.description ?? "Standalone",
        status: activity.status,
        agentName: activity.agentName,
        agentColor: activity.agentColor,
        scheduleType: activity.scheduleType,
        priority: activity.priority,
        childTaskCount: nestedTasks.length,
        isLinkedToProject: hasProjectLink,
        isNested: false,
        hostProjectId: activity.workProjectId,
        containerWidth: ACTIVITY_W,
        containerHeight: aHeight,
        item: activity,
      },
      style: { width: ACTIVITY_W, height: aHeight },
    });

    nestedTasks.forEach((task, ti) => {
      nodes.push({
        id: nodeId("task", task.id),
        type: "taskNode",
        parentId: aid,
        extent: "parent",
        expandParent: true,
        position: {
          x: 8,
          y: ACTIVITY_HEADER + ACTIVITY_DROP_PAD + 4 + ti * (TASK_TILE_H + TASK_TILE_GAP),
        },
        draggable: true,
        connectable: true,
        data: {
          kind: "task",
          label: task.title,
          subtitle: task.description ?? undefined,
          status: task.status,
          agentName: task.agentName,
          agentColor: task.agentColor,
          scheduleType: task.scheduleType,
          priority: task.priority,
          isAttached: true,
          isNested: true,
          containerWidth: TASK_W,
          item: task,
        },
        style: { width: TASK_W, height: TASK_TILE_H },
      });
    });

    for (const linkedProjectId of linkedProjectIds) {
      const projectNode = nodeId("project", linkedProjectId);
      if (nodes.some((n) => n.id === projectNode)) {
        pushEdge(edges, projectNode, aid, "project", "activity");
      }
    }
    if (activity.workProjectId && !linkedProjectIds.includes(activity.workProjectId)) {
      const projectNode = nodeId("project", activity.workProjectId);
      if (nodes.some((n) => n.id === projectNode)) {
        pushEdge(edges, projectNode, aid, "project", "activity");
      }
    }

    activityY += aHeight + GAP_Y;
  }

  for (const task of tasks) {
    if (isTaskNested(nestState, task.id)) continue;

    const tid = nodeId("task", task.id);
    const linkedToActivity = !!task.activityId;

    nodes.push({
      id: tid,
      type: "taskNode",
      position: { x: COL_X.task, y: taskY },
      draggable: true,
      connectable: true,
      data: {
        kind: "task",
        label: task.title,
        subtitle: task.description ?? undefined,
        status: task.status,
        agentName: task.agentName,
        agentColor: task.agentColor,
        scheduleType: task.scheduleType,
        priority: task.priority,
        isAttached: linkedToActivity,
        isNested: false,
        containerWidth: TASK_W,
        item: task,
      },
      style: { width: TASK_W },
    });

    if (task.activityId) {
      const activityNode = activityNodeIdByEntity.get(task.activityId);
      if (activityNode) {
        pushEdge(edges, activityNode, tid, "activity", "task");
      }
    }

    taskY += 88 + GAP_Y;
  }

  return { nodes, edges };
}

export function countNestedActivitiesForProject(nestState: CanvasNestState, projectId: string) {
  return countNestedActivitiesInProject(nestState, projectId);
}
