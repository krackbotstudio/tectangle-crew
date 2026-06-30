export type AgentQuestionType = "text" | "single" | "multi";

export interface AgentQuestion {
  id: string;
  label: string;
  type: AgentQuestionType;
  placeholder?: string;
  options?: string[];
  required?: boolean;
}

export interface ParsedAskQuestions {
  intro: string;
  questions: AgentQuestion[];
}

function extractJsonBlocks(text: string): string[] {
  const blocks: string[] = [];
  const regex = /```json\s*([\s\S]*?)\s*```/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    blocks.push(match[1].trim());
  }
  return blocks;
}

function normalizeQuestion(raw: Record<string, unknown>, index: number): AgentQuestion | null {
  const label = String(raw.label ?? raw.question ?? "").trim();
  if (!label) return null;

  const typeRaw = String(raw.type ?? "text").toLowerCase();
  let type: AgentQuestionType = "text";
  if (typeRaw === "single" || typeRaw === "select" || typeRaw === "radio") type = "single";
  if (typeRaw === "multi" || typeRaw === "multiple" || typeRaw === "checkbox") type = "multi";

  const options = Array.isArray(raw.options)
    ? raw.options.map(String).filter(Boolean)
    : undefined;

  if ((type === "single" || type === "multi") && (!options || options.length === 0)) {
    type = "text";
  }

  return {
    id: String(raw.id ?? `q${index + 1}`),
    label,
    type,
    placeholder: raw.placeholder ? String(raw.placeholder) : undefined,
    options,
    required: raw.required !== false,
  };
}

export function parseAskQuestionsFromReply(text: string): ParsedAskQuestions | null {
  for (const block of extractJsonBlocks(text)) {
    try {
      const parsed = JSON.parse(block) as {
        action?: string;
        intro?: string;
        questions?: unknown[];
      };
      if (parsed.action !== "ask_questions" || !Array.isArray(parsed.questions)) continue;

      const questions = parsed.questions
        .map((q, i) => normalizeQuestion(q as Record<string, unknown>, i))
        .filter((q): q is AgentQuestion => q !== null);

      if (questions.length === 0) continue;

      const intro =
        String(parsed.intro ?? "").trim() ||
        stripJsonBlocks(text).trim() ||
        "Please answer the questions below:";

      return { intro, questions };
    } catch {
      // try next block
    }
  }
  return null;
}

export function stripJsonBlocks(text: string): string {
  return text.replace(/```json\s*[\s\S]*?\s*```/g, "").trim();
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

export const ASK_QUESTIONS_PROMPT = `
=== INTERACTIVE QUESTIONS (use when you need structured input) ===
When you need 2 or more distinct facts, preferences, or choices from the user, output an ask_questions JSON block (with a short friendly intro before or after it). The UI will render input fields, single-select, and multi-select controls.

\`\`\`json
{
  "action": "ask_questions",
  "intro": "To create the best content, I need a few details:",
  "questions": [
    { "id": "product", "label": "What is the product or service?", "type": "text", "placeholder": "e.g. restaurant POS app" },
    { "id": "audience", "label": "Who is the target audience?", "type": "single", "options": ["Independent restaurants", "Restaurant chains", "Food trucks", "Other"] },
    { "id": "platforms", "label": "Which social platforms?", "type": "multi", "options": ["Instagram", "LinkedIn", "Facebook", "X (Twitter)"] }
  ]
}
\`\`\`

Question types:
- "text" — open text field
- "single" — pick one option (include "options" array)
- "multi" — pick multiple options (include "options" array)

Do NOT use a plain numbered list when structured questions would work — use ask_questions instead.
`.trim();
