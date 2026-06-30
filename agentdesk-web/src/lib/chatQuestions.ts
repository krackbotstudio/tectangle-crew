export type AgentQuestionType = "text" | "single" | "multi";

export interface AgentQuestion {
  id: string;
  label: string;
  type: AgentQuestionType;
  placeholder?: string;
  options?: string[];
  required?: boolean;
}

export function inferQuestionsFromPlainText(content: string): AgentQuestion[] | null {
  const lines = content.split("\n");
  const questions: AgentQuestion[] = [];

  for (const line of lines) {
    const numbered = line.match(/^\s*(\d+)[.)]\s*(.+)$/);
    if (!numbered) continue;

    const label = numbered[2].trim();
    if (label.length < 8) continue;

    const lower = label.toLowerCase();
    let type: AgentQuestionType = "text";
    let options: string[] | undefined;

    if (/\b(which|select|choose|pick one|platform|channel)\b/.test(lower)) {
      const optionMatch = label.match(/\(([^)]+)\)/);
      if (optionMatch) {
        options = optionMatch[1].split(/[,/|]/).map((s) => s.trim()).filter(Boolean);
        if (options.length >= 2) type = "single";
      }
    }

    questions.push({
      id: `q${numbered[1]}`,
      label: label.replace(/\([^)]*\)\s*$/, "").trim() || label,
      type,
      options,
    });
  }

  return questions.length >= 2 ? questions : null;
}

export function messageRefToken(messageId: string): string {
  const compact = messageId.replace(/-/g, "").slice(0, 8).toLowerCase();
  return `#msg-${compact}`;
}

export function getQuestionsForMessage(msg: {
  content: string;
  questions?: AgentQuestion[];
}): AgentQuestion[] | null {
  if (msg.questions && msg.questions.length > 0) return msg.questions;
  return inferQuestionsFromPlainText(msg.content);
}
