import type { WorkTask } from "../../lib/api";

export type CanvasNestState = {
  nestedActivities: Record<string, string>;
  nestedTasks: Record<string, string>;
};

const STORAGE_KEY = "work-hub-canvas-nest";

export function loadCanvasNestState(): CanvasNestState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { nestedActivities: {}, nestedTasks: {} };
    const parsed = JSON.parse(raw) as CanvasNestState;
    return {
      nestedActivities: parsed.nestedActivities ?? {},
      nestedTasks: parsed.nestedTasks ?? {},
    };
  } catch {
    return { nestedActivities: {}, nestedTasks: {} };
  }
}

export function saveCanvasNestState(state: CanvasNestState) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function nestActivity(
  state: CanvasNestState,
  activityId: string,
  projectId: string
): CanvasNestState {
  const next = {
    nestedActivities: { ...state.nestedActivities, [activityId]: projectId },
    nestedTasks: { ...state.nestedTasks },
  };
  saveCanvasNestState(next);
  return next;
}

export function unnestActivity(state: CanvasNestState, activityId: string): CanvasNestState {
  const nestedActivities = { ...state.nestedActivities };
  delete nestedActivities[activityId];
  const next = { nestedActivities, nestedTasks: { ...state.nestedTasks } };
  saveCanvasNestState(next);
  return next;
}

export function nestTask(
  state: CanvasNestState,
  taskId: string,
  activityId: string
): CanvasNestState {
  const next = {
    nestedActivities: { ...state.nestedActivities },
    nestedTasks: { ...state.nestedTasks, [taskId]: activityId },
  };
  saveCanvasNestState(next);
  return next;
}

export function unnestTask(state: CanvasNestState, taskId: string): CanvasNestState {
  const nestedTasks = { ...state.nestedTasks };
  delete nestedTasks[taskId];
  const next = { nestedActivities: { ...state.nestedActivities }, nestedTasks };
  saveCanvasNestState(next);
  return next;
}

export function isActivityNested(state: CanvasNestState, activityId: string): boolean {
  return activityId in state.nestedActivities;
}

export function isTaskNested(state: CanvasNestState, taskId: string): boolean {
  return taskId in state.nestedTasks;
}

export function countNestedActivitiesInProject(
  state: CanvasNestState,
  projectId: string
): number {
  return Object.values(state.nestedActivities).filter((id) => id === projectId).length;
}

export function nestedTasksInActivity(
  state: CanvasNestState,
  activityId: string,
  tasks: WorkTask[]
): WorkTask[] {
  return tasks.filter((t) => state.nestedTasks[t.id] === activityId);
}
