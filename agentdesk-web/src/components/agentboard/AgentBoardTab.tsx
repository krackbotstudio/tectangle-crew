import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowRight,
  Bot,
  Link2,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { api, type Agent, type AgentBoardCard } from "../../lib/api";
import { cn } from "../../lib/utils";
import { AgentAvatar } from "../workspace/TagEditor";
import {
  cardTypeColor,
  cardTypeIcon,
  defaultOutputConfig,
  INPUT_CARD_TYPES,
  OUTPUT_CARD_TYPES,
  type AgentBoardInputType,
  type AttachedFile,
  type DriveLink,
  type OutputContentType,
  type OutputDestination,
} from "./agentBoardTypes";
import { AgentBoardCardModal } from "./AgentBoardCardModal";

export function AgentBoardTab({ agent }: { agent: Agent }) {
  const queryClient = useQueryClient();
  const [editingCard, setEditingCard] = useState<AgentBoardCard | null>(null);
  const [addingSide, setAddingSide] = useState<"input" | "output" | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["agent-board", agent.slug],
    queryFn: () => api.getAgentBoard(agent.slug),
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["agent-board", agent.slug] });
    queryClient.invalidateQueries({ queryKey: ["agent", agent.slug] });
  };

  const createMutation = useMutation({
    mutationFn: (payload: Parameters<typeof api.createAgentBoardCard>[1]) =>
      api.createAgentBoardCard(agent.slug, payload),
    onSuccess: invalidate,
  });

  const updateMutation = useMutation({
    mutationFn: ({
      cardId,
      payload,
    }: {
      cardId: string;
      payload: Parameters<typeof api.updateAgentBoardCard>[2];
    }) => api.updateAgentBoardCard(agent.slug, cardId, payload),
    onSuccess: invalidate,
  });

  const deleteMutation = useMutation({
    mutationFn: (cardId: string) => api.deleteAgentBoardCard(agent.slug, cardId),
    onSuccess: invalidate,
  });

  const cards = data?.cards ?? [];
  const inputCards = cards.filter((c) => c.columnSide === "input");
  const outputCards = cards.filter((c) => c.columnSide === "output");

  function addInputCard(type: AgentBoardInputType) {
    const meta = INPUT_CARD_TYPES.find((t) => t.type === type)!;
    createMutation.mutate({
      columnSide: "input",
      cardType: type,
      title: meta.label,
      description: meta.desc,
      config:
        type === "skills"
          ? { items: agent.skills }
          : type === "rules"
            ? { items: agent.rules }
            : type === "notes"
              ? { content: "" }
              : type === "drive_link"
                ? { links: [] }
                : type === "file"
                  ? { files: [] }
                  : {},
      sortOrder: inputCards.length,
    });
    setAddingSide(null);
  }

  function addOutputCard(contentType: OutputContentType) {
    const preset = OUTPUT_CARD_TYPES.find((t) => t.defaultContentType === contentType)!;
    createMutation.mutate({
      columnSide: "output",
      cardType: "output_route",
      title: preset.label,
      description: preset.desc,
      config: defaultOutputConfig(contentType),
      sortOrder: outputCards.length,
    });
    setAddingSide(null);
  }

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-text-muted">
        Loading agent board…
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-hidden bg-[#0a0a0a]">
      <div className="shrink-0 border-b border-border px-4 py-3 sm:px-6">
        <p className="text-sm text-text-muted">
          Configure what feeds this agent (inputs) and where each output type gets stored (outputs).
          Click a card to edit. Add cards from the column menus.
        </p>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 overflow-y-auto p-4 lg:grid-cols-[1fr_auto_1fr] lg:overflow-hidden lg:p-6">
        <BoardColumn
          title="Inputs"
          subtitle="Skills, knowledge, files & sources"
          side="input"
          cards={inputCards}
          onAdd={() => setAddingSide("input")}
          onEdit={setEditingCard}
          onDelete={(id) => {
            if (confirm("Remove this input card?")) deleteMutation.mutate(id);
          }}
        />

        <div className="flex flex-col items-center justify-center px-2 py-4 lg:py-0">
          <div className="hidden lg:flex lg:flex-col lg:items-center lg:gap-3">
            <div className="h-px w-16 bg-gradient-to-r from-transparent via-teal-400/60 to-transparent" />
            <ArrowRight className="h-5 w-5 text-teal-400/70" />
          </div>
          <div
            className={cn(
              "w-full max-w-[240px] rounded-2xl border-2 border-[#863bff]/50 bg-[#863bff]/10 p-5 shadow-[0_0_32px_rgba(134,59,255,0.15)]",
              "lg:mx-0"
            )}
          >
            <div className="flex flex-col items-center text-center">
              <AgentAvatar name={agent.name} color={agent.avatarColor} size="lg" />
              <div className="mt-3 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[#c4a8ff]">
                <Bot className="h-3.5 w-3.5" /> Agent
              </div>
              <h3 className="mt-1 truncate text-sm font-semibold text-text-strong">{agent.name}</h3>
              <p className="mt-2 text-[11px] leading-relaxed text-text-muted">
                {inputCards.length} input{inputCards.length === 1 ? "" : "s"} · {outputCards.length}{" "}
                output route{outputCards.length === 1 ? "" : "s"}
              </p>
              <span
                className={cn(
                  "mt-3 rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase",
                  agent.isActive
                    ? "bg-emerald-900/40 text-emerald-400"
                    : "border border-border text-text-muted"
                )}
              >
                {agent.isActive ? "Active" : "Inactive"}
              </span>
            </div>
          </div>
          <div className="mt-3 hidden lg:flex lg:flex-col lg:items-center lg:gap-3">
            <ArrowRight className="h-5 w-5 text-violet-400/70" />
            <div className="h-px w-16 bg-gradient-to-r from-transparent via-violet-400/60 to-transparent" />
          </div>
        </div>

        <BoardColumn
          title="Outputs"
          subtitle="Where to store each output type"
          side="output"
          cards={outputCards}
          onAdd={() => setAddingSide("output")}
          onEdit={setEditingCard}
          onDelete={(id) => {
            if (confirm("Remove this output route?")) deleteMutation.mutate(id);
          }}
        />
      </div>

      {addingSide === "input" && (
        <AddCardPicker
          side="input"
          onClose={() => setAddingSide(null)}
          onPickInput={addInputCard}
        />
      )}
      {addingSide === "output" && (
        <AddCardPicker
          side="output"
          onClose={() => setAddingSide(null)}
          onPickOutput={addOutputCard}
        />
      )}

      {editingCard && (
        <AgentBoardCardModal
          agentSlug={agent.slug}
          card={editingCard}
          onClose={() => setEditingCard(null)}
          onSave={(payload) => {
            updateMutation.mutate({ cardId: editingCard.id, payload });
            setEditingCard(null);
          }}
        />
      )}
    </div>
  );
}

function BoardColumn({
  title,
  subtitle,
  side,
  cards,
  onAdd,
  onEdit,
  onDelete,
}: {
  title: string;
  subtitle: string;
  side: "input" | "output";
  cards: AgentBoardCard[];
  onAdd: () => void;
  onEdit: (card: AgentBoardCard) => void;
  onDelete: (id: string) => void;
}) {
  const accent = side === "input" ? "teal" : "violet";

  return (
    <div className="flex min-h-[280px] flex-col rounded-2xl border border-border bg-panel/40 lg:min-h-0 lg:overflow-hidden">
      <div className="flex items-start justify-between gap-2 border-b border-border px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold text-text-strong">{title}</h2>
          <p className="text-[11px] text-text-muted">{subtitle}</p>
        </div>
        <button
          type="button"
          onClick={onAdd}
          className={cn(
            "inline-flex items-center gap-1 rounded-xl border px-2.5 py-1.5 text-xs transition hover:bg-panel-hover",
            side === "input" ? "border-teal-400/40 text-teal-300" : "border-violet-400/40 text-violet-300"
          )}
        >
          <Plus className="h-3.5 w-3.5" /> Add
        </button>
      </div>

      <div className="flex flex-1 flex-col gap-2 overflow-y-auto p-3">
        {cards.length === 0 ? (
          <div
            className={cn(
              "flex flex-1 flex-col items-center justify-center rounded-xl border border-dashed p-6 text-center",
              accent === "teal" ? "border-teal-400/30 bg-teal-500/5" : "border-violet-400/30 bg-violet-500/5"
            )}
          >
            <p className="text-xs text-text-muted">No cards yet</p>
            <button type="button" onClick={onAdd} className="mt-2 text-xs text-text-strong hover:underline">
              Add {side} card
            </button>
          </div>
        ) : (
          cards.map((card) => (
            <BoardCard key={card.id} card={card} onEdit={() => onEdit(card)} onDelete={() => onDelete(card.id)} />
          ))
        )}
      </div>
    </div>
  );
}

function BoardCard({
  card,
  onEdit,
  onDelete,
}: {
  card: AgentBoardCard;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const Icon = cardTypeIcon(card);
  const color = cardTypeColor(card);
  const summary = cardSummary(card);

  const links = (card.cardType === "drive_link"
    ? (card.config.links as DriveLink[] | undefined)
    : (card.config.referenceLinks as DriveLink[] | undefined)) ?? [];

  return (
    <div
      className={cn(
        "group relative cursor-pointer rounded-xl border-2 p-3 transition hover:scale-[1.01] hover:shadow-lg",
        color
      )}
      onClick={onEdit}
      onKeyDown={(e) => e.key === "Enter" && onEdit()}
      role="button"
      tabIndex={0}
    >
      <div className="flex items-start gap-2.5">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-black/20">
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold text-text-strong">{card.title}</div>
          {card.description && (
            <p className="mt-0.5 line-clamp-2 text-[11px] text-text-muted">{card.description}</p>
          )}
          {summary && <p className="mt-1.5 text-[10px] text-text-faint">{summary}</p>}

          {links.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5 border-t border-white/5 pt-2">
              {links.map((link) => (
                <a
                  key={link.id}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] text-text-muted transition hover:bg-white/10 hover:text-text-strong",
                    "max-w-full"
                  )}
                  title={`${link.label}: ${link.url}`}
                >
                  <Link2 className="h-2.5 w-2.5 shrink-0" />
                  <span className="truncate">{link.label}</span>
                </a>
              ))}
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="rounded-lg p-1 opacity-0 transition hover:bg-black/30 group-hover:opacity-100"
        >
          <Trash2 className="h-3.5 w-3.5 text-text-muted" />
        </button>
      </div>
    </div>
  );
}

function cardSummary(card: AgentBoardCard): string {
  const cfg = card.config;
  if (card.cardType === "skills" || card.cardType === "rules") {
    const items = (cfg.items as string[] | undefined) ?? [];
    return items.length ? `${items.length} item${items.length === 1 ? "" : "s"}` : "Empty";
  }
  if (card.cardType === "notes") {
    const content = (cfg.content as string) ?? "";
    return content.trim() ? content.slice(0, 60) + (content.length > 60 ? "…" : "") : "No notes yet";
  }
  if (card.cardType === "drive_link") {
    const links = (cfg.links as DriveLink[] | undefined) ?? [];
    return links.length ? `${links.length} link${links.length === 1 ? "" : "s"}` : "No links";
  }
  if (card.cardType === "file") {
    const files = (cfg.files as AttachedFile[] | undefined) ?? [];
    return files.length ? `${files.length} file${files.length === 1 ? "" : "s"}` : "No files";
  }
  if (card.cardType === "knowledge") {
    return "Open Knowledge tab to upload docs";
  }
  if (card.cardType === "output_route") {
    const destinations = (cfg.destinations as OutputDestination[] | undefined) ?? [];
    const def = destinations.find((d) => d.isDefault) ?? destinations[0];
    return def ? `Default → ${def.label}` : "Configure destinations";
  }
  return "";
}

function AddCardPicker({
  side,
  onClose,
  onPickInput,
  onPickOutput,
}: {
  side: "input" | "output";
  onClose: () => void;
  onPickInput?: (type: AgentBoardInputType) => void;
  onPickOutput?: (type: OutputContentType) => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center">
      <div className="w-full max-w-md rounded-2xl border border-border bg-panel shadow-2xl">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h3 className="text-sm font-semibold text-text-strong">
            Add {side === "input" ? "input" : "output"} card
          </h3>
          <button type="button" onClick={onClose} className="rounded-lg p-1 hover:bg-panel-hover">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="max-h-[60vh] overflow-y-auto p-2">
          {side === "input"
            ? INPUT_CARD_TYPES.map(({ type, label, desc, icon: Icon, color }) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => onPickInput?.(type)}
                  className={cn(
                    "mb-1 flex w-full items-start gap-3 rounded-xl border-2 p-3 text-left transition hover:scale-[1.01]",
                    color
                  )}
                >
                  <Icon className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>
                    <span className="block text-sm font-medium text-text-strong">{label}</span>
                    <span className="block text-[11px] text-text-muted">{desc}</span>
                  </span>
                </button>
              ))
            : OUTPUT_CARD_TYPES.map(({ defaultContentType, label, desc, icon: Icon, color }) => (
                <button
                  key={defaultContentType}
                  type="button"
                  onClick={() => onPickOutput?.(defaultContentType)}
                  className={cn(
                    "mb-1 flex w-full items-start gap-3 rounded-xl border-2 p-3 text-left transition hover:scale-[1.01]",
                    color
                  )}
                >
                  <Icon className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>
                    <span className="block text-sm font-medium text-text-strong">{label}</span>
                    <span className="block text-[11px] text-text-muted">{desc}</span>
                  </span>
                </button>
              ))}
        </div>
      </div>
    </div>
  );
}
