import { useEffect, useRef, useState, type FormEvent } from "react";
import { useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Send, Loader2 } from "lucide-react";
import { AgentTabs } from "../components/AgentSidebar";
import { api } from "../lib/api";
import { AGENT_ICONS, cn } from "../lib/utils";

export function ChatPage() {
  const { agentId } = useParams<{ agentId: string }>();
  const slug = agentId!;
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
      queryClient.invalidateQueries({ queryKey: ["tasks", "recent"] });
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
  const messages = messagesData?.messages ?? [];

  return (
    <div className="mx-auto flex h-[calc(100vh-8rem)] max-w-4xl flex-col">
      <div className="mb-2 flex items-center gap-3">
        <span className="text-2xl">{AGENT_ICONS[slug] ?? "🤖"}</span>
        <div>
          <h1 className="text-xl font-semibold text-slate-900">{agent?.name ?? slug}</h1>
          <p className="text-sm text-slate-500">
            {agent?.isActive ? "Connected" : "Inactive — configure in Settings"}
          </p>
        </div>
      </div>

      <AgentTabs />

      <div className="flex flex-1 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="flex-1 space-y-4 overflow-y-auto p-4">
          {isLoading && (
            <div className="text-center text-sm text-slate-400">Loading conversation…</div>
          )}
          {!isLoading && messages.length === 0 && (
            <div className="rounded-lg bg-slate-50 p-6 text-center text-sm text-slate-500">
              Start a conversation with {agent?.name ?? "this agent"}. Try: &quot;Write 3
              LinkedIn posts about our new feature.&quot;
            </div>
          )}
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={cn(
                "flex",
                msg.role === "user" ? "justify-end" : "justify-start"
              )}
            >
              <div
                className={cn(
                  "max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap",
                  msg.role === "user"
                    ? "bg-brand-600 text-white"
                    : "bg-slate-100 text-slate-800"
                )}
              >
                {msg.content}
              </div>
            </div>
          ))}
          {sendMutation.isPending && (
            <div className="flex justify-start">
              <div className="flex items-center gap-2 rounded-2xl bg-slate-100 px-4 py-3 text-sm text-slate-500">
                <Loader2 className="h-4 w-4 animate-spin" />
                Agent is thinking…
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        <form
          onSubmit={handleSubmit}
          className="flex gap-2 border-t border-slate-100 p-4"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask your agent…"
            className="flex-1 rounded-lg border border-slate-300 px-4 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
            disabled={sendMutation.isPending}
          />
          <button
            type="submit"
            disabled={!input.trim() || sendMutation.isPending}
            className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
          >
            <Send className="h-4 w-4" />
            Send
          </button>
        </form>
      </div>
    </div>
  );
}
