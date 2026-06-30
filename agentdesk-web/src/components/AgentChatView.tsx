import { useEffect, useRef, useState, useCallback } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Send, Loader2, Paperclip, Smile, Hash } from "lucide-react";
import { api, type ChatMessage } from "../lib/api";
import { cn } from "../lib/utils";
import { AgentAvatar } from "./workspace/TagEditor";
import { ChatEmptyIllustration } from "./Illustrations";
import { CreativeAttachment } from "./chat/CreativeAttachment";
import { AgentQuestionForm } from "./chat/AgentQuestionForm";
import { getQuestionsForMessage, messageRefToken } from "../lib/chatQuestions";

export interface GroupAgentOption {
  slug: string;
  name: string;
  avatarColor?: string;
}

interface AgentChatViewProps {
  slug: string;
  agentName?: string;
  avatarColor?: string;
  projectId?: string;
  groupAgents?: GroupAgentOption[];
}

function getMentionQuery(text: string, cursor: number): { query: string; start: number } | null {
  const before = text.slice(0, cursor);
  const match = before.match(/@([\w\s-]*)$/);
  if (!match) return null;
  return { query: match[1].toLowerCase(), start: before.length - match[0].length };
}

function getHashQuery(text: string, cursor: number): { query: string; start: number } | null {
  const before = text.slice(0, cursor);
  const match = before.match(/#([\w-]*)$/);
  if (!match) return null;
  return { query: match[1].toLowerCase(), start: before.length - match[0].length };
}

function messageHasAnswers(messages: ChatMessage[], msgIndex: number): boolean {
  return messages.slice(msgIndex + 1).some((m) => m.role === "user");
}

function messagePreview(content: string, maxLen = 72): string {
  const flat = content.replace(/\s+/g, " ").trim();
  return flat.length > maxLen ? `${flat.slice(0, maxLen)}…` : flat;
}

export function AgentChatView({
  slug,
  agentName,
  avatarColor,
  projectId,
  groupAgents = [],
}: AgentChatViewProps) {
  const [input, setInput] = useState("");
  const [sendError, setSendError] = useState<string | null>(null);
  const [mentionIndex, setMentionIndex] = useState(0);
  const [mentionOpen, setMentionOpen] = useState(false);
  const [hashIndex, setHashIndex] = useState(0);
  const [hashOpen, setHashOpen] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const queryClient = useQueryClient();

  const mentionState = (() => {
    const el = textareaRef.current;
    const cursor = el?.selectionStart ?? input.length;
    return getMentionQuery(input, cursor);
  })();

  const hashState = (() => {
    const el = textareaRef.current;
    const cursor = el?.selectionStart ?? input.length;
    return getHashQuery(input, cursor);
  })();

  const mentionCandidates =
    projectId && mentionState
      ? groupAgents.filter((a) => a.name.toLowerCase().includes(mentionState.query))
      : [];

  const messagesQueryKey = projectId ? ["messages", "project", projectId] : ["messages", slug];

  const { data: messagesData, isLoading } = useQuery({
    queryKey: messagesQueryKey,
    queryFn: () => api.getMessages(slug, projectId),
  });

  const messages = messagesData?.messages ?? [];

  const hashCandidates = hashState
    ? messages
        .filter((m) => {
          const token = messageRefToken(m.id).slice(1);
          const preview = messagePreview(m.content).toLowerCase();
          const q = hashState.query;
          if (!q) return true;
          return token.includes(q) || preview.includes(q);
        })
        .slice(-12)
        .reverse()
    : [];

  const showMentionPicker = mentionOpen && !hashOpen && mentionCandidates.length > 0;
  const showHashPicker = hashOpen && hashCandidates.length > 0;

  const insertMention = useCallback(
    (agent: GroupAgentOption) => {
      const el = textareaRef.current;
      const cursor = el?.selectionStart ?? input.length;
      const state = getMentionQuery(input, cursor);
      if (!state) return;

      const before = input.slice(0, state.start);
      const after = input.slice(cursor);
      const insertion = `@${agent.name} `;
      const next = `${before}${insertion}${after}`;
      setInput(next);
      setMentionOpen(false);
      setMentionIndex(0);

      requestAnimationFrame(() => {
        const pos = before.length + insertion.length;
        el?.focus();
        el?.setSelectionRange(pos, pos);
      });
    },
    [input]
  );

  const insertMessageRef = useCallback(
    (msg: ChatMessage) => {
      const el = textareaRef.current;
      const cursor = el?.selectionStart ?? input.length;
      const state = getHashQuery(input, cursor);
      if (!state) return;

      const before = input.slice(0, state.start);
      const after = input.slice(cursor);
      const insertion = `${messageRefToken(msg.id)} `;
      const next = `${before}${insertion}${after}`;
      setInput(next);
      setHashOpen(false);
      setHashIndex(0);

      requestAnimationFrame(() => {
        const pos = before.length + insertion.length;
        el?.focus();
        el?.setSelectionRange(pos, pos);
      });
    },
    [input]
  );

  const { data: agentData } = useQuery({
    queryKey: ["agent", slug],
    queryFn: () => api.getAgent(slug),
  });

  const sendMutation = useMutation({
    mutationFn: (message: string) => api.sendMessage(slug, message, projectId),
    onMutate: async (message) => {
      setSendError(null);
      await queryClient.cancelQueries({ queryKey: messagesQueryKey });
      const previous = queryClient.getQueryData<{ messages: ChatMessage[] }>(messagesQueryKey);
      const optimistic: ChatMessage = {
        id: `pending-${Date.now()}`,
        role: "user",
        content: message,
        createdAt: new Date().toISOString(),
      };
      queryClient.setQueryData(messagesQueryKey, {
        messages: [...(previous?.messages ?? []), optimistic],
      });
      return { previous };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: messagesQueryKey });
      queryClient.invalidateQueries({ queryKey: ["tasks", slug] });
      queryClient.invalidateQueries({ queryKey: ["project-tools"] });
      queryClient.invalidateQueries({ queryKey: ["console"] });
      queryClient.invalidateQueries({ queryKey: ["team"] });
    },
    onError: (error: Error, _message, context) => {
      if (context?.previous) {
        queryClient.setQueryData(messagesQueryKey, context.previous);
      }
      setSendError(error.message);
    },
  });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sendMutation.isPending]);

  async function sendMessage(textOverride?: string) {
    const text = (textOverride ?? input).trim();
    if (!text || sendMutation.isPending) return;
    if (!textOverride) setInput("");
    try {
      await sendMutation.mutateAsync(text);
    } catch {
      // Error surfaced via sendError state
    }
  }

  const agent = agentData?.agent;
  const name = agentName ?? agent?.name ?? slug;

  return (
    <div className="flex h-full flex-col bg-canvas">
      <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-6">
        {isLoading && (
          <div className="text-center text-sm text-text-muted">Loading conversation…</div>
        )}
        {!isLoading && messages.length === 0 && (
          <div className="mx-auto mt-12 max-w-md rounded-2xl border border-border bg-panel p-8 text-center">
            <ChatEmptyIllustration className="mx-auto h-16 w-24 text-text-faint" />
            <AgentAvatar name={name} color={avatarColor ?? agent?.avatarColor} size="lg" />
            <h3 className="mt-4 font-semibold text-text-strong">{name}</h3>
            <p className="mt-2 text-sm text-text-muted">
              Start a conversation. Ask for drafts, revisions, or team-specific work.
            </p>
            {agent?.chatMode === "direct" && (
              <p className="mt-3 text-xs text-text-faint">
                Uses built-in AI — configure providers under Workspace settings → AI models.
              </p>
            )}
          </div>
        )}
        <div className="mx-auto max-w-3xl space-y-4">
          {messages.map((msg, msgIndex) => {
            const questions = getQuestionsForMessage(msg);
            const showQuestionForm =
              msg.role === "assistant" &&
              questions &&
              questions.length > 0 &&
              !messageHasAnswers(messages, msgIndex);

            return (
              <div
                key={msg.id}
                className={cn("flex gap-3", msg.role === "user" ? "flex-row-reverse" : "")}
              >
                {msg.role === "assistant" && (
                  <div className="flex shrink-0 flex-col items-center gap-1">
                    <AgentAvatar
                      name={msg.agentName ?? name}
                      color={msg.avatarColor ?? avatarColor ?? agent?.avatarColor}
                      size="sm"
                    />
                  </div>
                )}
                <div className={cn("max-w-[75%]", msg.role === "user" ? "" : "")}>
                  {msg.role === "assistant" && projectId && msg.agentName && (
                    <p className="mb-1 text-xs font-medium text-text-muted">{msg.agentName}</p>
                  )}
                  <div
                    className={cn(
                      "rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap",
                      msg.role === "user"
                        ? "bg-accent-light text-accent-fg"
                        : "border border-border bg-panel text-text"
                    )}
                  >
                    {msg.content}
                    {msg.creatives?.map((creative) => (
                      <CreativeAttachment
                        key={creative.id}
                        creative={creative}
                        projectId={projectId}
                        onUpdated={() => queryClient.invalidateQueries({ queryKey: messagesQueryKey })}
                      />
                    ))}
                    {showQuestionForm && (
                      <AgentQuestionForm
                        questions={questions}
                        disabled={sendMutation.isPending}
                        onSubmit={(answers) => {
                          void sendMessage(`Here are my answers:\n${answers}`);
                        }}
                      />
                    )}
                  </div>
                </div>
              </div>
            );
          })}
          {sendMutation.isPending && (
            <div className="flex gap-3">
              <AgentAvatar name={name} color={avatarColor ?? agent?.avatarColor} size="sm" />
              <div className="flex items-center gap-2 rounded-2xl border border-border bg-panel px-4 py-3 text-sm text-text-muted">
                <Loader2 className="h-4 w-4 animate-spin" />
                Thinking…
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      </div>

      <div className="border-t border-border bg-panel px-4 py-3 sm:px-6 sm:py-4">
        {sendError && (
          <div className="mx-auto mb-3 max-w-3xl rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm text-red-100">
            {sendError}
          </div>
        )}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void sendMessage();
          }}
          className="mx-auto max-w-3xl"
        >
          <div className="relative rounded-2xl border border-border bg-panel-elevated focus-within:border-neutral-500">
            {showMentionPicker && (
              <div className="absolute bottom-full left-0 z-20 mb-2 w-full max-w-xs overflow-hidden rounded-xl border border-border bg-panel-elevated shadow-lg">
                <p className="border-b border-border px-3 py-2 text-xs font-medium text-text-muted">
                  Assign to agent
                </p>
                <ul className="max-h-48 overflow-y-auto py-1">
                  {mentionCandidates.map((agent, idx) => (
                    <li key={agent.slug}>
                      <button
                        type="button"
                        className={cn(
                          "flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-panel-hover",
                          idx === mentionIndex && "bg-panel-hover"
                        )}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          insertMention(agent);
                        }}
                      >
                        <AgentAvatar name={agent.name} color={agent.avatarColor} size="sm" />
                        <span className="text-text">{agent.name}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {showHashPicker && (
              <div className="absolute bottom-full left-0 z-20 mb-2 w-full max-w-md overflow-hidden rounded-xl border border-border bg-panel-elevated shadow-lg">
                <p className="border-b border-border px-3 py-2 text-xs font-medium text-text-muted">
                  Reference a message
                </p>
                <ul className="max-h-56 overflow-y-auto py-1">
                  {hashCandidates.map((msg, idx) => (
                    <li key={msg.id}>
                      <button
                        type="button"
                        className={cn(
                          "flex w-full flex-col gap-0.5 px-3 py-2 text-left text-sm hover:bg-panel-hover",
                          idx === hashIndex && "bg-panel-hover"
                        )}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          insertMessageRef(msg);
                        }}
                      >
                        <span className="flex items-center gap-1.5 text-xs font-medium text-text-muted">
                          <Hash className="h-3 w-3" />
                          {messageRefToken(msg.id)}
                          <span className="text-text-faint">·</span>
                          {msg.role === "user" ? "You" : msg.agentName ?? "Agent"}
                        </span>
                        <span className="truncate text-text">{messagePreview(msg.content)}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                const cursor = e.target.selectionStart;
                const mention = getMentionQuery(e.target.value, cursor);
                const hash = getHashQuery(e.target.value, cursor);
                if (hash) {
                  setHashOpen(true);
                  setMentionOpen(false);
                  setHashIndex(0);
                } else if (mention && projectId && groupAgents.length > 0) {
                  setMentionOpen(true);
                  setHashOpen(false);
                  setMentionIndex(0);
                } else {
                  setMentionOpen(false);
                  setHashOpen(false);
                }
              }}
              onKeyDown={(e) => {
                if (showHashPicker) {
                  if (e.key === "ArrowDown") {
                    e.preventDefault();
                    setHashIndex((i) => (i + 1) % hashCandidates.length);
                    return;
                  }
                  if (e.key === "ArrowUp") {
                    e.preventDefault();
                    setHashIndex((i) => (i - 1 + hashCandidates.length) % hashCandidates.length);
                    return;
                  }
                  if (e.key === "Enter" || e.key === "Tab") {
                    e.preventDefault();
                    insertMessageRef(hashCandidates[hashIndex]);
                    return;
                  }
                  if (e.key === "Escape") {
                    e.preventDefault();
                    setHashOpen(false);
                    return;
                  }
                }
                if (showMentionPicker) {
                  if (e.key === "ArrowDown") {
                    e.preventDefault();
                    setMentionIndex((i) => (i + 1) % mentionCandidates.length);
                    return;
                  }
                  if (e.key === "ArrowUp") {
                    e.preventDefault();
                    setMentionIndex((i) => (i - 1 + mentionCandidates.length) % mentionCandidates.length);
                    return;
                  }
                  if (e.key === "Enter" || e.key === "Tab") {
                    e.preventDefault();
                    insertMention(mentionCandidates[mentionIndex]);
                    return;
                  }
                  if (e.key === "Escape") {
                    e.preventDefault();
                    setMentionOpen(false);
                    return;
                  }
                }
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void sendMessage();
                }
              }}
              placeholder={
                projectId
                  ? `Message group… @ assign agent, # reference message`
                  : `Message ${name}… type # to reference a message`
              }
              rows={2}
              className="w-full resize-none bg-transparent px-4 py-3 text-sm text-text outline-none placeholder:text-text-faint"
              disabled={sendMutation.isPending}
            />
            <div className="flex items-center gap-0.5 border-t border-border px-2 py-1.5">
              <button
                type="button"
                title="Attach file"
                className="rounded-lg p-1.5 hover:bg-panel-hover"
              >
                <Paperclip className="h-4 w-4 text-text-muted" />
              </button>
              <button
                type="button"
                title="Add emoji"
                className="rounded-lg p-1.5 hover:bg-panel-hover"
              >
                <Smile className="h-4 w-4 text-text-muted" />
              </button>
              <div className="flex-1" />
              <button
                type="submit"
                disabled={!input.trim() || sendMutation.isPending}
                title="Send message"
                className={cn(
                  "rounded-xl p-2 transition",
                  input.trim() && !sendMutation.isPending
                    ? "bg-accent text-accent-muted-fg hover:bg-accent-hover"
                    : "text-text-faint hover:bg-panel-hover disabled:cursor-not-allowed"
                )}
              >
                {sendMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
