import { useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Upload, FileText, Trash2, Loader2 } from "lucide-react";
import { AgentTabs } from "../components/AgentSidebar";
import { api } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { AGENT_ICONS, formatBytes, formatRelativeTime } from "../lib/utils";

export function KnowledgePage({ embedded, agentSlug: slugProp }: { embedded?: boolean; agentSlug?: string } = {}) {
  const { agentId, agentSlug: routeSlug } = useParams<{ agentId?: string; agentSlug?: string }>();
  const slug = slugProp ?? routeSlug ?? agentId!;
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploadError, setUploadError] = useState("");
  const queryClient = useQueryClient();
  const { isAdmin } = useAuth();

  const { data: agentData } = useQuery({
    queryKey: ["agent", slug],
    queryFn: () => api.getAgent(slug),
  });

  const { data, isLoading } = useQuery({
    queryKey: ["knowledge", slug],
    queryFn: () => api.getDocuments(slug),
  });

  const uploadMutation = useMutation({
    mutationFn: (file: File) => api.uploadDocument(slug, file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["knowledge", slug] });
      setUploadError("");
    },
    onError: (err: Error) => setUploadError(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteDocument(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["knowledge", slug] }),
  });

  const documents = data?.documents ?? [];

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) uploadMutation.mutate(file);
    e.target.value = "";
  }

  return (
    <div className={embedded ? "h-full overflow-y-auto p-6" : "mx-auto max-w-5xl"}>
      {!embedded && (
        <>
          <div className="mb-2 flex items-center gap-3">
            <span className="text-2xl">{AGENT_ICONS[slug] ?? "🤖"}</span>
            <div>
              <h1 className="text-xl font-semibold text-slate-900">
                {agentData?.agent.name ?? slug} — Knowledge Base
              </h1>
              <p className="text-sm text-slate-500">
                Upload brand guidelines, SOPs, and templates for RAG retrieval
              </p>
            </div>
          </div>
          <AgentTabs />
        </>
      )}

      <div
        className="mb-6 cursor-pointer rounded-xl border-2 border-dashed border-border bg-panel p-8 text-center transition hover:border-neutral-500 hover:bg-panel-hover"
        onClick={() => fileRef.current?.click()}
        onKeyDown={(e) => e.key === "Enter" && fileRef.current?.click()}
        role="button"
        tabIndex={0}
      >
        <input
          ref={fileRef}
          type="file"
          className="hidden"
          accept=".txt,.md,.csv,.json"
          onChange={handleFileChange}
        />
        {uploadMutation.isPending ? (
          <div className="flex items-center justify-center gap-2 text-sm text-slate-500">
            <Loader2 className="h-5 w-5 animate-spin" />
            Uploading and indexing…
          </div>
        ) : (
          <>
            <Upload className="mx-auto mb-3 h-8 w-8 text-neutral-700" />
            <div className="font-medium text-slate-700">Upload documents</div>
            <div className="mt-1 text-sm text-slate-500">
              .txt, .md, .csv, .json — max 10 MB
            </div>
          </>
        )}
      </div>

      {uploadError && (
        <div className="mb-4 rounded-lg border border-neutral-400 bg-neutral-100 px-4 py-2 text-sm text-neutral-800">
          {uploadError}
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-border bg-panel">
        {isLoading ? (
          <div className="p-8 text-center text-sm text-slate-400">Loading documents…</div>
        ) : documents.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-400">
            No documents yet. Upload brand guidelines or SOPs to improve agent responses.
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {documents.map((doc) => (
              <li key={doc.id} className="flex items-center gap-4 px-5 py-4">
                <FileText className="h-5 w-5 shrink-0 text-slate-400" />
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium text-slate-800">{doc.filename}</div>
                  <div className="text-xs text-slate-500">
                    {formatBytes(doc.fileSize)} · uploaded {formatRelativeTime(doc.uploadedAt)}
                    {doc.indexedAt && " · indexed"}
                  </div>
                </div>
                {isAdmin && (
                  <button
                    type="button"
                    onClick={() => deleteMutation.mutate(doc.id)}
                    className="rounded-lg p-2 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-800"
                    title="Delete document"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
