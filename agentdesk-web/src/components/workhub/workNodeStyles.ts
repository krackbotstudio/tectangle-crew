import type { WorkNodeKind } from "./workHubGraph";

export const NODE_KIND_META: Record<
  WorkNodeKind,
  {
    label: string;
    width: string;
    border: string;
    glow: string;
    headerBg: string;
    headerText: string;
    iconBg: string;
    iconColor: string;
    handleTarget: string;
    handleSource: string;
    edgeColor: string;
  }
> = {
  project: {
    label: "Project",
    width: "w-[260px]",
    border: "border-2 border-[#863bff]/60",
    glow: "shadow-[0_0_32px_rgba(134,59,255,0.22)]",
    headerBg: "bg-gradient-to-r from-[#863bff]/30 to-[#863bff]/5",
    headerText: "text-[#c4a8ff]",
    iconBg: "bg-[#863bff]/20 border-[#863bff]/40",
    iconColor: "text-[#b794ff]",
    handleTarget: "!bg-[#863bff]",
    handleSource: "!bg-[#863bff]",
    edgeColor: "#863bff",
  },
  activity: {
    label: "Activity",
    width: "w-[228px]",
    border: "border-2 border-teal-400/70",
    glow: "shadow-[0_0_28px_rgba(45,212,191,0.18)]",
    headerBg: "bg-gradient-to-r from-teal-500/15 to-transparent",
    headerText: "text-teal-300/90",
    iconBg: "bg-teal-500/15 border-teal-400/35",
    iconColor: "text-teal-300",
    handleTarget: "!bg-teal-400",
    handleSource: "!bg-teal-400",
    edgeColor: "#2dd4bf",
  },
  task: {
    label: "Step",
    width: "w-[210px]",
    border: "border-2 border-violet-400/55",
    glow: "shadow-[0_0_22px_rgba(167,139,250,0.15)]",
    headerBg: "bg-gradient-to-r from-violet-500/12 to-transparent",
    headerText: "text-violet-300/90",
    iconBg: "bg-violet-500/15 border-violet-400/30",
    iconColor: "text-violet-300",
    handleTarget: "!bg-violet-400",
    handleSource: "!bg-violet-300",
    edgeColor: "#a78bfa",
  },
};

export function standaloneTaskBorder(isAttached: boolean) {
  return isAttached
    ? NODE_KIND_META.task.border
    : "border-2 border-dashed border-violet-400/40";
}
