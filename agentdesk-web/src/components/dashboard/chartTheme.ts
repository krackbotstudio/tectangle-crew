/**
 * Chart tokens aligned with index.css @theme (dark grey + brand purple accent).
 */
export const CHART_COLORS = [
  "#863bff", /* brand-purple */
  "#a3a3a3", /* brand-700 / text accent */
  "#737373", /* brand-300 */
  "#525252", /* accent / brand-600 */
  "#dcdcdc", /* text-strong */
  "#606060", /* text-faint */
  "#7e14ff", /* brand-purple-bright */
  "#404040", /* brand-100 */
] as const;

export const CHART_PRIMARY = "#863bff";
export const CHART_SECONDARY = "#737373";
export const CHART_MUTED = "#525252";

export const CHART_AXIS = {
  stroke: "transparent",
  tick: { fill: "#8a8a8a", fontSize: 11 },
};

export const CHART_GRID = { stroke: "#2a2a2a", strokeDasharray: "4 4" };

export const CHART_TOOLTIP_STYLE = {
  contentStyle: {
    background: "#141414",
    border: "1px solid #2a2a2a",
    borderRadius: "12px",
    fontSize: "12px",
    color: "#dcdcdc",
    boxShadow: "0 8px 24px rgba(0,0,0,0.35)",
  },
  itemStyle: { color: "#c8c8c8" },
  labelStyle: { color: "#8a8a8a", marginBottom: 4 },
};

/** Task status bar fills — grey scale matching STATUS_STYLES */
export const CHART_STATUS_COLORS = {
  queued: "#737373",
  running: "#a3a3a3",
  done: "#525252",
  failed: "#404040",
  pending_approval: "#606060",
} as const;
