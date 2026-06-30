export function routeParam(value: string | string[]): string {
  if (Array.isArray(value)) return value[0] ?? "";
  return value;
}
