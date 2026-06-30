import { useState } from "react";
import { Send } from "lucide-react";
import { cn } from "../../lib/utils";
import type { AgentQuestion } from "../../lib/chatQuestions";

export function AgentQuestionForm({
  questions,
  disabled,
  onSubmit,
}: {
  questions: AgentQuestion[];
  disabled?: boolean;
  onSubmit: (formattedAnswers: string) => void;
}) {
  const [answers, setAnswers] = useState<Record<string, string | string[]>>(() => {
    const init: Record<string, string | string[]> = {};
    for (const q of questions) {
      init[q.id] = q.type === "multi" ? [] : "";
    }
    return init;
  });

  function setText(id: string, value: string) {
    setAnswers((prev) => ({ ...prev, [id]: value }));
  }

  function toggleMulti(id: string, option: string) {
    setAnswers((prev) => {
      const current = (prev[id] as string[]) ?? [];
      const next = current.includes(option)
        ? current.filter((o) => o !== option)
        : [...current, option];
      return { ...prev, [id]: next };
    });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const lines = questions.map((q) => {
      const val = answers[q.id];
      if (q.type === "multi") {
        const selected = (val as string[]) ?? [];
        return `${q.label}: ${selected.length ? selected.join(", ") : "(none selected)"}`;
      }
      return `${q.label}: ${String(val ?? "").trim() || "(skipped)"}`;
    });
    onSubmit(lines.join("\n"));
  }

  const canSubmit = questions.some((q) => {
    if (!q.required) return true;
    const val = answers[q.id];
    if (q.type === "multi") return ((val as string[]) ?? []).length > 0;
    return String(val ?? "").trim().length > 0;
  });

  return (
    <form onSubmit={handleSubmit} className="mt-3 space-y-3 border-t border-border-subtle pt-3">
      {questions.map((q) => (
        <div key={q.id} className="space-y-1.5">
          <label className="block text-xs font-medium text-text-strong">
            {q.label}
            {q.required !== false && <span className="text-text-faint"> *</span>}
          </label>

          {q.type === "text" && (
            <input
              type="text"
              value={(answers[q.id] as string) ?? ""}
              onChange={(e) => setText(q.id, e.target.value)}
              placeholder={q.placeholder ?? "Your answer…"}
              disabled={disabled}
              className="w-full rounded-xl border border-border bg-panel-elevated px-3 py-2 text-sm text-text outline-none focus:border-neutral-500 disabled:opacity-50"
            />
          )}

          {q.type === "single" && q.options && (
            <div className="flex flex-wrap gap-2">
              {q.options.map((option) => {
                const selected = answers[q.id] === option;
                return (
                  <button
                    key={option}
                    type="button"
                    disabled={disabled}
                    onClick={() => setText(q.id, option)}
                    className={cn(
                      "rounded-full border px-3 py-1 text-xs transition disabled:opacity-50",
                      selected
                        ? "border-accent bg-accent-light text-accent-fg"
                        : "border-border bg-panel-elevated text-text-muted hover:border-neutral-500"
                    )}
                  >
                    {option}
                  </button>
                );
              })}
            </div>
          )}

          {q.type === "multi" && q.options && (
            <div className="flex flex-wrap gap-2">
              {q.options.map((option) => {
                const selected = ((answers[q.id] as string[]) ?? []).includes(option);
                return (
                  <button
                    key={option}
                    type="button"
                    disabled={disabled}
                    onClick={() => toggleMulti(q.id, option)}
                    className={cn(
                      "rounded-full border px-3 py-1 text-xs transition disabled:opacity-50",
                      selected
                        ? "border-accent bg-accent-light text-accent-fg"
                        : "border-border bg-panel-elevated text-text-muted hover:border-neutral-500"
                    )}
                  >
                    {option}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      ))}

      <button
        type="submit"
        disabled={disabled || !canSubmit}
        className="inline-flex items-center gap-2 rounded-xl bg-accent px-3 py-2 text-xs font-medium text-accent-muted-fg hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
      >
        <Send className="h-3.5 w-3.5" />
        Submit answers
      </button>
    </form>
  );
}
