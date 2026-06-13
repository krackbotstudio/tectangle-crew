import { useEffect, useState, type ChangeEvent, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { BookOpen, Plus, Trash2, X } from "lucide-react";
import { api, type AgentBoardCard } from "../../lib/api";
import { cn } from "../../lib/utils";
import {
  OUTPUT_DESTINATION_OPTIONS,
  type AttachedFile,
  type DriveLink,
  type OutputContentType,
  type OutputDestination,
} from "./agentBoardTypes";

type Props = {
  agentSlug: string;
  card: AgentBoardCard;
  onClose: () => void;
  onSave: (payload: {
    title?: string;
    description?: string;
    config?: Record<string, unknown>;
  }) => void;
};

export function AgentBoardCardModal({ agentSlug, card, onClose, onSave }: Props) {
  const [title, setTitle] = useState(card.title);
  const [description, setDescription] = useState(card.description ?? "");
  const [config, setConfig] = useState<Record<string, unknown>>({ ...card.config });

  const { data: docsData } = useQuery({
    queryKey: ["knowledge", agentSlug],
    queryFn: () => api.getDocuments(agentSlug),
    enabled: card.cardType === "knowledge",
  });

  useEffect(() => {
    setTitle(card.title);
    setDescription(card.description ?? "");
    setConfig({ ...card.config });
  }, [card]);

  function save() {
    onSave({ title: title.trim(), description: description.trim() || undefined, config });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center">
      <div className="flex max-h-[90vh] w-full max-w-lg flex-col rounded-2xl border border-border bg-panel shadow-2xl">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h3 className="text-sm font-semibold text-text-strong">Configure card</h3>
          <button type="button" onClick={onClose} className="rounded-lg p-1 hover:bg-panel-hover">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto p-4">
          <Field label="Title">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-xl border border-border bg-panel-elevated px-3 py-2 text-sm outline-none focus:border-neutral-500"
            />
          </Field>
          <Field label="Description">
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full rounded-xl border border-border bg-panel-elevated px-3 py-2 text-sm outline-none focus:border-neutral-500"
            />
          </Field>

          {card.cardType === "skills" || card.cardType === "rules" ? (
            <TagListEditor
              label={card.cardType === "skills" ? "Skills" : "Rules"}
              items={(config.items as string[]) ?? []}
              onChange={(items) => setConfig({ ...config, items })}
            />
          ) : null}

          {card.cardType === "notes" ? (
            <Field label="Notes">
              <textarea
                value={(config.content as string) ?? ""}
                onChange={(e) => setConfig({ ...config, content: e.target.value })}
                rows={6}
                className="w-full rounded-xl border border-border bg-panel-elevated px-3 py-2 text-sm outline-none focus:border-neutral-500"
                placeholder="Add context, reminders, or instructions for this agent…"
              />
            </Field>
          ) : null}

          {card.cardType === "drive_link" ? (
            <DriveLinksEditor
              links={(config.links as DriveLink[]) ?? []}
              onChange={(links) => setConfig({ ...config, links })}
            />
          ) : null}

          {card.cardType === "file" ? (
            <FilesEditor
              agentSlug={agentSlug}
              files={(config.files as AttachedFile[]) ?? []}
              onChange={(files) => setConfig({ ...config, files })}
            />
          ) : null}

          {card.cardType === "knowledge" ? (
            <div className="rounded-xl border border-border bg-panel-elevated/60 p-4">
              <div className="flex items-center gap-2 text-sm text-text-muted">
                <BookOpen className="h-4 w-4" />
                Knowledge documents
              </div>
              <ul className="mt-2 space-y-1 text-xs text-text-faint">
                {(docsData?.documents ?? []).length === 0 ? (
                  <li>No documents uploaded yet.</li>
                ) : (
                  docsData!.documents.map((d) => (
                    <li key={d.id}>{d.filename}</li>
                  ))
                )}
              </ul>
              <Link
                to={`/agents/${agentSlug}/knowledge`}
                className="mt-3 inline-block text-xs text-teal-300 hover:underline"
              >
                Open Knowledge tab to upload →
              </Link>
            </div>
          ) : null}

          {card.cardType === "output_route" ? (
            <OutputRouteEditor
              contentType={(config.contentType as OutputContentType) ?? "general"}
              destinations={(config.destinations as OutputDestination[]) ?? []}
              onChange={(contentType, destinations) =>
                setConfig({ ...config, contentType, destinations })
              }
            />
          ) : null}
        </div>

        <div className="flex justify-end gap-2 border-t border-border p-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-border px-4 py-2 text-sm text-text-muted hover:bg-panel-hover"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={save}
            disabled={!title.trim()}
            className="rounded-xl bg-accent px-4 py-2 text-sm font-medium text-accent-fg disabled:opacity-50"
          >
            Save card
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-text-faint">
        {label}
      </span>
      {children}
    </label>
  );
}

function TagListEditor({
  label,
  items,
  onChange,
}: {
  label: string;
  items: string[];
  onChange: (items: string[]) => void;
}) {
  const [draft, setDraft] = useState("");

  return (
    <Field label={label}>
      <div className="flex flex-wrap gap-1.5">
        {items.map((item, i) => (
          <span
            key={`${item}-${i}`}
            className="inline-flex items-center gap-1 rounded-full border border-border bg-panel-elevated px-2.5 py-1 text-xs"
          >
            {item}
            <button
              type="button"
              onClick={() => onChange(items.filter((_, j) => j !== i))}
              className="text-text-faint hover:text-text-strong"
            >
              ×
            </button>
          </span>
        ))}
      </div>
      <div className="mt-2 flex gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && draft.trim()) {
              e.preventDefault();
              onChange([...items, draft.trim()]);
              setDraft("");
            }
          }}
          placeholder={`Add ${label.toLowerCase()}…`}
          className="flex-1 rounded-xl border border-border bg-panel-elevated px-3 py-2 text-sm outline-none"
        />
        <button
          type="button"
          onClick={() => {
            if (!draft.trim()) return;
            onChange([...items, draft.trim()]);
            setDraft("");
          }}
          className="rounded-xl border border-border px-3 py-2 text-sm hover:bg-panel-hover"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>
    </Field>
  );
}

function DriveLinksEditor({
  links,
  onChange,
}: {
  links: DriveLink[];
  onChange: (links: DriveLink[]) => void;
}) {
  const [label, setLabel] = useState("");
  const [url, setUrl] = useState("");

  return (
    <Field label="Drive & web links">
      <div className="space-y-2">
        {links.map((link) => (
          <div
            key={link.id}
            className="flex items-center gap-2 rounded-xl border border-border bg-panel-elevated px-3 py-2 text-sm"
          >
            <div className="min-w-0 flex-1">
              <div className="truncate font-medium text-text-strong">{link.label}</div>
              <div className="truncate text-[11px] text-text-faint">{link.url}</div>
            </div>
            <button
              type="button"
              onClick={() => onChange(links.filter((l) => l.id !== link.id))}
              className="text-text-faint hover:text-red-300"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>
      <div className="mt-3 space-y-2">
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Label (e.g. Brand assets folder)"
          className="w-full rounded-xl border border-border bg-panel-elevated px-3 py-2 text-sm outline-none"
        />
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://drive.google.com/…"
          className="w-full rounded-xl border border-border bg-panel-elevated px-3 py-2 text-sm outline-none"
        />
        <button
          type="button"
          disabled={!label.trim() || !url.trim()}
          onClick={() => {
            onChange([
              ...links,
              { id: crypto.randomUUID(), label: label.trim(), url: url.trim() },
            ]);
            setLabel("");
            setUrl("");
          }}
          className="rounded-xl border border-border px-3 py-1.5 text-xs hover:bg-panel-hover disabled:opacity-50"
        >
          Add link
        </button>
      </div>
    </Field>
  );
}

function FilesEditor({
  agentSlug,
  files,
  onChange,
}: {
  agentSlug: string;
  files: AttachedFile[];
  onChange: (files: AttachedFile[]) => void;
}) {
  async function onUpload(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const result = await api.uploadDocument(agentSlug, file);
      onChange([
        ...files,
        {
          id: crypto.randomUUID(),
          name: file.name,
          documentId: result.documentId,
        },
      ]);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Upload failed");
    }
    e.target.value = "";
  }

  return (
    <Field label="Attached files">
      <div className="space-y-2">
        {files.map((f) => (
          <div
            key={f.id}
            className="flex items-center justify-between rounded-xl border border-border bg-panel-elevated px-3 py-2 text-sm"
          >
            <span className="truncate">{f.name}</span>
            <button
              type="button"
              onClick={() => onChange(files.filter((x) => x.id !== f.id))}
              className="text-text-faint hover:text-red-300"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>
      <label className="mt-3 inline-flex cursor-pointer items-center gap-2 rounded-xl border border-dashed border-border px-3 py-2 text-xs text-text-muted hover:bg-panel-hover">
        <Plus className="h-3.5 w-3.5" /> Upload file
        <input type="file" className="hidden" onChange={onUpload} />
      </label>
    </Field>
  );
}

function OutputRouteEditor({
  contentType,
  destinations,
  onChange,
}: {
  contentType: OutputContentType;
  destinations: OutputDestination[];
  onChange: (contentType: OutputContentType, destinations: OutputDestination[]) => void;
}) {
  const options = OUTPUT_DESTINATION_OPTIONS[contentType] ?? OUTPUT_DESTINATION_OPTIONS.general;

  function toggle(provider: string, label: string) {
    const exists = destinations.find((d) => d.provider === provider);
    if (exists) {
      onChange(
        contentType,
        destinations.filter((d) => d.provider !== provider)
      );
    } else {
      onChange(contentType, [...destinations, { provider, label }]);
    }
  }

  function setDefault(provider: string) {
    onChange(
      contentType,
      destinations.map((d) => ({ ...d, isDefault: d.provider === provider }))
    );
  }

  return (
    <div className="space-y-4">
      <Field label="Output type">
        <select
          value={contentType}
          onChange={(e) => {
            const next = e.target.value as OutputContentType;
            onChange(next, OUTPUT_DESTINATION_OPTIONS[next].slice(0, 2));
          }}
          className="w-full rounded-xl border border-border bg-panel-elevated px-3 py-2 text-sm capitalize outline-none"
        >
          {(
            ["copy", "presentation", "design", "code", "data", "general"] as OutputContentType[]
          ).map((t) => (
            <option key={t} value={t}>
              {t.replace("_", " ")}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Store outputs in">
        <div className="space-y-1.5">
          {options.map((opt) => {
            const selected = destinations.some((d) => d.provider === opt.provider);
            const isDefault = destinations.find((d) => d.provider === opt.provider)?.isDefault;
            return (
              <div
                key={opt.provider}
                className={cn(
                  "flex items-center gap-2 rounded-xl border px-3 py-2 text-sm transition",
                  selected ? "border-violet-400/50 bg-violet-500/10" : "border-border bg-panel-elevated"
                )}
              >
                <input
                  type="checkbox"
                  checked={selected}
                  onChange={() => toggle(opt.provider, opt.label)}
                  className="rounded"
                />
                <span className="flex-1">{opt.label}</span>
                {selected && (
                  <button
                    type="button"
                    onClick={() => setDefault(opt.provider)}
                    className={cn(
                      "rounded-full px-2 py-0.5 text-[10px]",
                      isDefault ? "bg-violet-500/30 text-violet-200" : "text-text-faint hover:text-text-muted"
                    )}
                  >
                    {isDefault ? "Default" : "Set default"}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </Field>
    </div>
  );
}
