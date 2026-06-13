import { useState } from "react";
import { X, Plus } from "lucide-react";
import { cn, avatarShadeFromName } from "../../lib/utils";

interface TagEditorProps {
  label: string;
  items: string[];
  onChange: (items: string[]) => void;
  placeholder?: string;
  color?: "light" | "mid" | "dark";
  readOnly?: boolean;
}

const colorMap = {
  light: "bg-panel-elevated text-text-muted border-border",
  mid: "bg-neutral-700 text-neutral-200 border-neutral-600",
  dark: "bg-accent-light text-accent-fg border-accent-light",
};

export function TagEditor({
  label,
  items,
  onChange,
  placeholder = "Add item…",
  color = "light",
  readOnly = false,
}: TagEditorProps) {
  const [input, setInput] = useState("");

  function addItem() {
    const val = input.trim();
    if (!val || items.includes(val)) return;
    onChange([...items, val]);
    setInput("");
  }

  function removeItem(item: string) {
    onChange(items.filter((i) => i !== item));
  }

  return (
    <div>
      <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-faint">
        {label}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {items.map((item) => (
          <span
            key={item}
            className={cn(
              "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium",
              colorMap[color]
            )}
          >
            {item}
            {!readOnly && (
              <button type="button" onClick={() => removeItem(item)} className="opacity-60 hover:opacity-100">
                <X className="h-3 w-3" />
              </button>
            )}
          </span>
        ))}
      </div>
      {!readOnly && (
        <div className="mt-2 flex gap-1">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addItem())}
            placeholder={placeholder}
            className="flex-1 rounded-xl border border-border bg-panel-elevated px-2 py-1 text-xs text-text outline-none placeholder:text-text-faint focus:border-neutral-500"
          />
          <button
            type="button"
            onClick={addItem}
            className="rounded-xl border border-border bg-panel-elevated p-1 hover:bg-panel-hover"
          >
            <Plus className="h-4 w-4 text-text-muted" />
          </button>
        </div>
      )}
    </div>
  );
}

export function AgentAvatar({
  name,
  size = "md",
}: {
  name: string;
  color?: string;
  size?: "sm" | "md" | "lg";
}) {
  const sizeClass = size === "sm" ? "h-8 w-8 text-xs" : size === "lg" ? "h-16 w-16 text-xl" : "h-10 w-10 text-sm";
  const initials = name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  const shade = avatarShadeFromName(name);

  return (
    <div
      className={cn("flex shrink-0 items-center justify-center rounded-full font-semibold text-neutral-200 ring-1 ring-neutral-600/40", sizeClass)}
      style={{ backgroundColor: shade }}
    >
      {initials}
    </div>
  );
}
