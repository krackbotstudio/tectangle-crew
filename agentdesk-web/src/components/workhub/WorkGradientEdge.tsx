import { BaseEdge, getBezierPath, type EdgeProps } from "@xyflow/react";

export function WorkGradientEdge(props: EdgeProps) {
  const {
    id,
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    data,
    selected,
  } = props;

  const [path] = getBezierPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  });

  const edgeData = data as { sourceColor?: string; targetColor?: string } | undefined;
  const from = edgeData?.sourceColor ?? "#863bff";
  const to = edgeData?.targetColor ?? "#a78bfa";
  const gradId = `work-edge-${id}`;

  return (
    <>
      <defs>
        <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor={from} />
          <stop offset="100%" stopColor={to} />
        </linearGradient>
      </defs>
      <BaseEdge
        id={id}
        path={path}
        style={{
          stroke: `url(#${gradId})`,
          strokeWidth: selected ? 3 : 2.5,
          opacity: selected ? 1 : 0.85,
        }}
      />
    </>
  );
}
