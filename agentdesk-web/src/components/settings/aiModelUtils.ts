export const AUTO = "auto" as const;

export function isAuto(value: string | null | undefined): boolean {
  return !value || value === AUTO;
}

export function modelLabel(id: string): string {
  if (id === AUTO) return "Auto";
  return id;
}
