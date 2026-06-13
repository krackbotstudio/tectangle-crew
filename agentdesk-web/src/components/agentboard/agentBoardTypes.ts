import type { LucideIcon } from "lucide-react";
import {
  BookOpen,
  FileText,
  FolderOpen,
  HardDrive,
  Layers,
  Lightbulb,
  Link2,
  Paperclip,
  Presentation,
  Sparkles,
  StickyNote,
} from "lucide-react";

export type AgentBoardColumnSide = "input" | "output";

export type AgentBoardInputType =
  | "knowledge"
  | "skills"
  | "notes"
  | "file"
  | "drive_link"
  | "rules";

export type AgentBoardOutputType = "output_route";

export type AgentBoardCardType = AgentBoardInputType | AgentBoardOutputType;

export type OutputContentType = "copy" | "presentation" | "design" | "code" | "data" | "general";

export type OutputDestination = {
  provider: string;
  label: string;
  url?: string;
  isDefault?: boolean;
};

export type DriveLink = {
  id: string;
  label: string;
  url: string;
};

export type AttachedFile = {
  id: string;
  name: string;
  url?: string;
  documentId?: string;
};

export type AgentBoardCard = {
  id: string;
  agentId: string;
  columnSide: AgentBoardColumnSide;
  cardType: AgentBoardCardType;
  title: string;
  description: string | null;
  config: Record<string, unknown>;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

export const INPUT_CARD_TYPES: {
  type: AgentBoardInputType;
  label: string;
  desc: string;
  icon: LucideIcon;
  color: string;
}[] = [
  {
    type: "knowledge",
    label: "Knowledge base",
    desc: "Docs & reference material",
    icon: BookOpen,
    color: "border-blue-400/50 bg-blue-500/10 text-blue-300",
  },
  {
    type: "skills",
    label: "Skills",
    desc: "What this agent can do",
    icon: Sparkles,
    color: "border-amber-400/50 bg-amber-500/10 text-amber-300",
  },
  {
    type: "notes",
    label: "Notes",
    desc: "Internal context & reminders",
    icon: StickyNote,
    color: "border-yellow-400/50 bg-yellow-500/10 text-yellow-200",
  },
  {
    type: "file",
    label: "Attached files",
    desc: "Upload files as skill sources",
    icon: Paperclip,
    color: "border-violet-400/50 bg-violet-500/10 text-violet-300",
  },
  {
    type: "drive_link",
    label: "Drive & links",
    desc: "Google Drive folders & URLs",
    icon: HardDrive,
    color: "border-teal-400/50 bg-teal-500/10 text-teal-300",
  },
  {
    type: "rules",
    label: "Rules",
    desc: "Behavior rules to follow",
    icon: Lightbulb,
    color: "border-orange-400/50 bg-orange-500/10 text-orange-300",
  },
];

export const OUTPUT_CARD_TYPES: {
  type: AgentBoardOutputType;
  label: string;
  desc: string;
  icon: LucideIcon;
  color: string;
  defaultContentType: OutputContentType;
  defaultDestinations: OutputDestination[];
}[] = [
  {
    type: "output_route",
    label: "Copy & content",
    desc: "Written content outputs",
    icon: FileText,
    color: "border-emerald-400/50 bg-emerald-500/10 text-emerald-300",
    defaultContentType: "copy",
    defaultDestinations: [
      { provider: "google_docs", label: "Google Docs", isDefault: true },
      { provider: "notes", label: "Notes" },
      { provider: "markdown", label: "Markdown (.md)" },
    ],
  },
  {
    type: "output_route",
    label: "Presentations",
    desc: "Slide decks & pitches",
    icon: Presentation,
    color: "border-pink-400/50 bg-pink-500/10 text-pink-300",
    defaultContentType: "presentation",
    defaultDestinations: [
      { provider: "google_slides", label: "Google Slides", isDefault: true },
      { provider: "powerpoint", label: "PowerPoint" },
      { provider: "canva", label: "Canva" },
    ],
  },
  {
    type: "output_route",
    label: "Design assets",
    desc: "Visual & brand outputs",
    icon: Layers,
    color: "border-fuchsia-400/50 bg-fuchsia-500/10 text-fuchsia-300",
    defaultContentType: "design",
    defaultDestinations: [
      { provider: "canva", label: "Canva", isDefault: true },
      { provider: "figma", label: "Figma" },
      { provider: "drive", label: "Google Drive" },
    ],
  },
  {
    type: "output_route",
    label: "Code & data",
    desc: "Technical outputs",
    icon: FolderOpen,
    color: "border-cyan-400/50 bg-cyan-500/10 text-cyan-300",
    defaultContentType: "code",
    defaultDestinations: [
      { provider: "github", label: "GitHub" },
      { provider: "markdown", label: "Markdown (.md)" },
      { provider: "google_sheets", label: "Google Sheets" },
    ],
  },
];

export const OUTPUT_DESTINATION_OPTIONS: Record<OutputContentType, OutputDestination[]> = {
  copy: [
    { provider: "google_docs", label: "Google Docs" },
    { provider: "notes", label: "Notes" },
    { provider: "markdown", label: "Markdown (.md)" },
    { provider: "notion", label: "Notion" },
  ],
  presentation: [
    { provider: "google_slides", label: "Google Slides" },
    { provider: "powerpoint", label: "PowerPoint" },
    { provider: "canva", label: "Canva" },
    { provider: "keynote", label: "Keynote" },
  ],
  design: [
    { provider: "canva", label: "Canva" },
    { provider: "figma", label: "Figma" },
    { provider: "drive", label: "Google Drive" },
    { provider: "adobe_express", label: "Adobe Express" },
  ],
  code: [
    { provider: "github", label: "GitHub" },
    { provider: "markdown", label: "Markdown (.md)" },
    { provider: "gitlab", label: "GitLab" },
  ],
  data: [
    { provider: "google_sheets", label: "Google Sheets" },
    { provider: "csv", label: "CSV file" },
    { provider: "airtable", label: "Airtable" },
  ],
  general: [
    { provider: "drive", label: "Google Drive" },
    { provider: "notes", label: "Notes" },
    { provider: "email", label: "Email draft" },
  ],
};

export function inputMeta(type: AgentBoardInputType) {
  return INPUT_CARD_TYPES.find((t) => t.type === type)!;
}

export function defaultInputTitle(type: AgentBoardInputType) {
  return inputMeta(type).label;
}

export function defaultOutputConfig(contentType: OutputContentType) {
  const preset = OUTPUT_CARD_TYPES.find((t) => t.defaultContentType === contentType);
  return {
    contentType,
    destinations: preset?.defaultDestinations ?? OUTPUT_DESTINATION_OPTIONS[contentType],
  };
}

export function cardTypeIcon(card: { columnSide: string; cardType: string; config: Record<string, unknown> }) {
  if (card.columnSide === "output") {
    const ct = (card.config.contentType as OutputContentType) ?? "general";
    return OUTPUT_CARD_TYPES.find((t) => t.defaultContentType === ct)?.icon ?? Link2;
  }
  return inputMeta(card.cardType as AgentBoardInputType).icon;
}

export function cardTypeColor(card: { columnSide: string; cardType: string; config: Record<string, unknown> }) {
  if (card.columnSide === "output") {
    const ct = (card.config.contentType as OutputContentType) ?? "general";
    return (
      OUTPUT_CARD_TYPES.find((t) => t.defaultContentType === ct)?.color ??
      "border-border bg-panel-elevated"
    );
  }
  return inputMeta(card.cardType as AgentBoardInputType).color;
}
