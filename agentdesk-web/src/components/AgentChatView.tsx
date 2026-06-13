import { useEffect, useRef, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Send, Loader2, Paperclip, Smile } from "lucide-react";
import { api } from "../lib/api";
import { cn } from "../lib/utils";
import { AgentAvatar } from "./workspace/TagEditor";
import { ChatEmptyIllustration } from "./Illustrations";

interface AgentChatViewProps {
  slug: string;
  agentName?: string;
  avatarColor?: string;
}

export function AgentChatView({ slug, agentName, avatarColor }: AgentChatViewProps) {
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  const { data: agentData } = useQuery({
    queryKey: ["agent", slug],
    queryFn: () => api.getAgent(slug),
  });

  const { data: messagesData, isLoading } = useQuery({
    queryKey: ["messages", slug],
    queryFn: () => api.getMessages(slug),
  });

  const sendMutation = useMutation({
    mutationFn: (message: string) => api.sendMessage(slug, message),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["messages", slug] });
      queryClient.invalidateQueries({ queryKey: ["tasks", slug] });
    },
  });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messagesData?.messages, sendMutation.isPending]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || sendMutation.isPending) return;
    setInput("");
    await sendMutation.mutateAsync(text);
  }

  const agent = agentData?.agent;
  const name = agentName ?? agent?.name ?? slug;
  const messages = messagesData?.messages ?? [];

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
          </div>
        )}
        <div className="mx-auto max-w-3xl space-y-4">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={cn("flex gap-3", msg.role === "user" ? "flex-row-reverse" : "")}
            >
              {msg.role === "assistant" && (
                <AgentAvatar name={name} color={avatarColor ?? agent?.avatarColor} size="sm" />
              )}
              <div
                className={cn(
                  "max-w-[75%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap",
                  msg.role === "user"
                    ? "bg-accent-light text-accent-fg"
                    : "border border-border bg-panel text-text"
                )}
              >
                {msg.content}
              </div>
            </div>
          ))}
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
        <form onSubmit={handleSubmit} className="mx-auto max-w-3xl">
          <div className="rounded-2xl border border-border bg-panel-elevated focus-within:border-neutral-500">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit(e);
                }
              }}
              placeholder={`Message ${name}…`}
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
