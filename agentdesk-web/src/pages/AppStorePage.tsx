import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CheckCircle2,
  Loader2,
  Plug,
  Search,
  Server,
  Trash2,
  X,
  Zap,
} from "lucide-react";
import {
  api,
  type ConsoleLibraryItem,
  type IntegrationConnectionType,
  type IntegrationStatus,
  type McpConnector,
  type McpTransport,
} from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { DashboardCard, PageHeader } from "../components/workspace/DashboardUI";
import { ToolLogo } from "../components/console/ToolLogo";
import { cn } from "../lib/utils";

type ConsoleTab = "library" | "mcp";

const inputClass =
  "w-full rounded-xl border border-border bg-panel-elevated px-3 py-2 text-sm text-text outline-none focus:border-neutral-500";

const STATUS_STYLES: Record<IntegrationStatus | "not_configured", { label: string; className: string }> = {
  not_configured: { label: "Not set up", className: "border-border text-text-faint" },
  configured: { label: "Configured", className: "border-amber-500/30 text-amber-200 bg-amber-500/10" },
  connected: { label: "Connected", className: "border-emerald-500/30 text-emerald-200 bg-emerald-500/10" },
  error: { label: "Error", className: "border-red-500/30 text-red-200 bg-red-500/10" },
  disabled: { label: "Disabled", className: "border-border text-text-faint" },
};

const CONNECTION_TYPES: { id: IntegrationConnectionType; label: string }[] = [
  { id: "oauth", label: "OAuth" },
  { id: "api_key", label: "API key" },
  { id: "mcp", label: "MCP connector" },
  { id: "n8n", label: "n8n workflow" },
  { id: "manual", label: "Manual" },
];

export function AppStorePage() {
  const { isAdmin } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [tab, setTab] = useState<ConsoleTab>("library");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string>("all");
  const [selectedSlug, setSelectedSlug] = useState<string | null>(searchParams.get("tool"));

  const { data, isLoading } = useQuery({
    queryKey: ["console"],
    queryFn: () => api.getConsole(),
  });

  useEffect(() => {
    const tool = searchParams.get("tool");
    if (tool) setSelectedSlug(tool);
  }, [searchParams]);

  const categories = data?.catalog.categories ?? [];
  const library = data?.library ?? [];
  const stats = data?.stats;

  const filtered = useMemo(() => {
    return library.filter((item) => {
      if (category !== "all" && item.category !== category) return false;
      if (!query.trim()) return true;
      const q = query.toLowerCase();
      return (
        item.name.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q) ||
        item.slug.includes(q)
      );
    });
  }, [library, category, query]);

  const selectedItem = library.find((i) => i.slug === selectedSlug) ?? null;

  const openTool = (slug: string) => {
    setSelectedSlug(slug);
    setSearchParams({ tool: slug });
  };

  const closeTool = () => {
    setSelectedSlug(null);
    setSearchParams({});
  };

  return (
    <div className="flex h-full min-h-0">
      <div className="min-w-0 flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
        <div className="mx-auto max-w-6xl">
          <PageHeader
            title="App Store"
            subtitle="Browse and connect workspace apps once — agents use them per project group."
          />

          {!isAdmin && (
            <div className="mb-6 rounded-xl border border-border bg-panel px-4 py-3 text-sm text-text-muted">
              Only admins can configure integrations. You can browse the app library below.
            </div>
          )}

          {stats && (
            <div className="mb-6 grid gap-3 sm:grid-cols-4">
              <StatCard label="Apps in library" value={stats.catalogCount} />
              <StatCard label="Configured" value={stats.configuredCount} />
              <StatCard label="Connected" value={stats.connectedCount} accent />
              <StatCard label="MCP connectors" value={stats.mcpCount} />
            </div>
          )}

          <div className="mb-6 flex gap-1 overflow-x-auto scrollbar-hide">
            <TabButton active={tab === "library"} onClick={() => setTab("library")} icon={Plug}>
              App library
            </TabButton>
            <TabButton active={tab === "mcp"} onClick={() => setTab("mcp")} icon={Server}>
              MCP connectors
            </TabButton>
          </div>

          {tab === "library" && (
            <>
              <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
                <div className="relative min-w-0 flex-1">
                  <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-text-faint" />
                  <input
                    type="search"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search apps…"
                    className={cn(inputClass, "pl-9")}
                  />
                </div>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className={cn(inputClass, "sm:w-52")}
                >
                  <option value="all">All categories</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>

              {isLoading ? (
                <p className="text-sm text-text-muted">Loading app library…</p>
              ) : (
                <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                  {filtered.map((item) => (
                    <AppCard
                      key={item.slug}
                      item={item}
                      onClick={() => openTool(item.slug)}
                      selected={selectedSlug === item.slug}
                    />
                  ))}
                </div>
              )}

              {!isLoading && filtered.length === 0 && (
                <p className="text-sm text-text-muted">No apps match your search.</p>
              )}

              <p className="mt-6 text-xs text-text-faint">
                Assign tools to project groups from{" "}
                <Link to="/projects" className="text-text-muted underline hover:text-text-strong">
                  Groups
                </Link>
                . The App Store holds company-wide credentials; projects choose which apps each team uses.
              </p>
            </>
          )}

          {tab === "mcp" && (
            <McpConnectorsSection connectors={data?.mcpConnectors ?? []} isAdmin={isAdmin} />
          )}
        </div>
      </div>

      {selectedItem && (
        <IntegrationConfigPanel
          item={selectedItem}
          isAdmin={isAdmin}
          onClose={closeTool}
        />
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent?: boolean;
}) {
  return (
    <DashboardCard className="p-4">
      <div className="text-[11px] font-medium uppercase tracking-wide text-text-faint">{label}</div>
      <div className={cn("mt-1 text-2xl font-semibold", accent ? "text-emerald-300" : "text-text-strong")}>
        {value}
      </div>
    </DashboardCard>
  );
}

function TabButton({
  active,
  onClick,
  icon: Icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: typeof Plug;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex shrink-0 items-center gap-2 rounded-xl px-4 py-2 text-sm transition",
        active ? "bg-list-selected text-text-strong" : "text-text-muted hover:bg-panel-hover hover:text-text-strong"
      )}
    >
      <Icon className="h-4 w-4" />
      {children}
    </button>
  );
}

function AppCard({
  item,
  onClick,
  selected,
}: {
  item: ConsoleLibraryItem;
  onClick: () => void;
  selected: boolean;
}) {
  const status = item.integration?.status ?? "not_configured";
  const meta = STATUS_STYLES[status];

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-2xl border bg-panel-elevated p-4 text-left transition hover:border-neutral-500 hover:bg-panel-hover",
        selected ? "border-neutral-500 ring-1 ring-neutral-500/30" : "border-border"
      )}
    >
      <div className="flex items-start gap-3">
        <ToolLogo slug={item.slug} name={item.name} size="md" />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 font-medium text-text-strong">{item.name}</div>
            <span className={cn("shrink-0 rounded-md border px-2 py-0.5 text-[10px] font-medium", meta.className)}>
              {meta.label}
            </span>
          </div>
          <p className="mt-1 line-clamp-2 text-xs text-text-muted">{item.description}</p>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-1 pl-[52px]">
        {item.capabilities.slice(0, 3).map((cap) => (
          <span key={cap} className="rounded-md border border-border px-1.5 py-0.5 text-[10px] text-text-faint">
            {cap.replace(/_/g, " ")}
          </span>
        ))}
        {item.connectVia && (
          <span className="rounded-md border border-border px-1.5 py-0.5 text-[10px] text-text-faint">
            via {item.connectVia}
          </span>
        )}
      </div>
      {item.integration?.accountLabel && (
        <p className="mt-2 truncate pl-[52px] text-[11px] text-text-muted">{item.integration.accountLabel}</p>
      )}
    </button>
  );
}

function IntegrationConfigPanel({
  item,
  isAdmin,
  onClose,
}: {
  item: ConsoleLibraryItem;
  isAdmin: boolean;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const integration = item.integration;
  const apiKeyRef = useRef<HTMLInputElement>(null);
  const apiSecretRef = useRef<HTMLInputElement>(null);
  const apiSecretTextareaRef = useRef<HTMLTextAreaElement>(null);
  const anonKeyRef = useRef<HTMLInputElement>(null);
  const clientSecretRef = useRef<HTMLInputElement>(null);

  const [connectionType, setConnectionType] = useState<IntegrationConnectionType>(
    integration?.connectionType ?? (item.connectVia as IntegrationConnectionType) ?? "api_key"
  );
  const [status, setStatus] = useState<IntegrationStatus>(integration?.status ?? "configured");
  const [accountLabel, setAccountLabel] = useState(integration?.accountLabel ?? "");
  const [notes, setNotes] = useState(integration?.notes ?? "");
  const [config, setConfig] = useState<Record<string, string>>({
    accountId: String(integration?.config?.accountId ?? ""),
    clientId: String(integration?.config?.clientId ?? ""),
    baseUrl: String(integration?.config?.baseUrl ?? ""),
    mcpServerUrl: String(integration?.config?.mcpServerUrl ?? ""),
    mcpServerName: String(integration?.config?.mcpServerName ?? ""),
    n8nWorkflowId: String(integration?.config?.n8nWorkflowId ?? ""),
    spreadsheetId: String(integration?.config?.spreadsheetId ?? ""),
    docId: String(integration?.config?.docId ?? ""),
    pageId: String(integration?.config?.pageId ?? ""),
    databaseId: String(integration?.config?.databaseId ?? ""),
    channel: String(integration?.config?.channel ?? ""),
    profileId: String(integration?.config?.profileId ?? ""),
  });
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  const saveMutation = useMutation({
    mutationFn: () =>
      api.upsertWorkspaceIntegration(item.slug, {
        connectionType,
        status,
        accountLabel: accountLabel.trim() || null,
        notes: notes.trim() || null,
        config: Object.fromEntries(Object.entries(config).filter(([, v]) => v.trim())),
        credentials: {
          apiKey: apiKeyRef.current?.value.trim() || undefined,
          apiSecret:
            apiSecretTextareaRef.current?.value.trim() ||
            apiSecretRef.current?.value.trim() ||
            undefined,
          anonKey: anonKeyRef.current?.value.trim() || undefined,
          clientId: config.clientId?.trim() || undefined,
          clientSecret: clientSecretRef.current?.value.trim() || undefined,
        },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["console"] });
      queryClient.invalidateQueries({ queryKey: ["project-tools"] });
      if (apiKeyRef.current) apiKeyRef.current.value = "";
      if (apiSecretRef.current) apiSecretRef.current.value = "";
      if (apiSecretTextareaRef.current) apiSecretTextareaRef.current.value = "";
      if (anonKeyRef.current) anonKeyRef.current.value = "";
      if (clientSecretRef.current) clientSecretRef.current.value = "";
      setSaveMessage("Saved");
      setTimeout(() => setSaveMessage(null), 2500);
    },
    onError: (e: Error) => setSaveMessage(e.message),
  });

  const testMutation = useMutation({
    mutationFn: () => api.testWorkspaceIntegration(item.slug),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["console"] });
      setSaveMessage(data.message ?? "Connected successfully");
      setTimeout(() => setSaveMessage(null), 4000);
    },
    onError: (e: Error) => setSaveMessage(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: () => api.deleteWorkspaceIntegration(item.slug),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["console"] });
      onClose();
    },
  });

  const setConfigField = (key: string, value: string) =>
    setConfig((prev) => ({ ...prev, [key]: value }));

  return (
    <aside className="flex w-full max-w-md shrink-0 flex-col border-l border-border-subtle bg-sidebar lg:w-[420px]">
      <div className="flex items-start justify-between gap-2 border-b border-border-subtle px-4 py-3">
        <div className="flex min-w-0 gap-3">
          <ToolLogo slug={item.slug} name={item.name} size="lg" />
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-sm font-semibold text-text-strong">
              {item.name}
            </div>
            <p className="mt-1 text-xs text-text-muted">{item.description}</p>
          </div>
        </div>
        <button type="button" onClick={onClose} className="rounded-lg p-1 hover:bg-panel-hover">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        {item.setupHint && (
          <p className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-3 py-2 text-xs text-emerald-100/90">
            {item.setupHint}
          </p>
        )}

        {item.liveIntegration && (
          <p className="text-xs text-text-faint">
            Live API — save credentials, then use Verify &amp; connect to test against the real provider.
          </p>
        )}

        <Field label="Account label">
          <input
            value={accountLabel}
            onChange={(e) => setAccountLabel(e.target.value)}
            placeholder="e.g. Acme Marketing Meta account"
            className={inputClass}
            disabled={!isAdmin}
          />
        </Field>

        <Field label="Connection type">
          <select
            value={connectionType}
            onChange={(e) => setConnectionType(e.target.value as IntegrationConnectionType)}
            className={inputClass}
            disabled={!isAdmin}
          >
            {CONNECTION_TYPES.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Status">
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as IntegrationStatus)}
            className={inputClass}
            disabled={!isAdmin}
          >
            {Object.entries(STATUS_STYLES).map(([value, m]) => (
              <option key={value} value={value}>
                {m.label}
              </option>
            ))}
          </select>
        </Field>

        {connectionType === "api_key" && (
          <>
            <Field
              label={
                item.slug === "notion"
                  ? "Notion integration token"
                  : item.slug === "slack"
                    ? "Slack bot token (xoxb-…)"
                    : item.slug === "buffer"
                      ? "Buffer access token"
                      : "API key"
              }
            >
              <input
                ref={apiKeyRef}
                type="password"
                placeholder={integration?.credentials.apiKey ?? "Paste token"}
                className={inputClass}
                disabled={!isAdmin}
                autoComplete="off"
              />
            </Field>
            <Field
              label={
                item.slug === "google-sheets" || item.slug === "google-docs"
                  ? "Google service account JSON"
                  : "API secret (optional)"
              }
            >
              {item.slug === "google-sheets" || item.slug === "google-docs" ? (
                <textarea
                  ref={apiSecretTextareaRef}
                  rows={4}
                  placeholder={
                    integration?.credentials.apiSecret ??
                    '{"type":"service_account","client_email":"…","private_key":"…"}'
                  }
                  className={cn(inputClass, "resize-y font-mono text-xs")}
                  disabled={!isAdmin}
                  autoComplete="off"
                />
              ) : (
                <input
                  ref={apiSecretRef}
                  type="password"
                  placeholder={integration?.credentials.apiSecret ?? "If required"}
                  className={inputClass}
                  disabled={!isAdmin}
                  autoComplete="off"
                />
              )}
            </Field>
            <Field label="Anon / public key (optional)">
              <input
                ref={anonKeyRef}
                type="password"
                placeholder={integration?.credentials.anonKey ?? "e.g. Supabase anon key"}
                className={inputClass}
                disabled={!isAdmin}
                autoComplete="off"
              />
            </Field>
            <Field label="Account / app ID">
              <input
                value={config.accountId}
                onChange={(e) => setConfigField("accountId", e.target.value)}
                className={inputClass}
                disabled={!isAdmin}
              />
            </Field>
          </>
        )}

        {connectionType === "oauth" && (
          <>
            <Field label="Client ID">
              <input
                value={config.clientId ?? ""}
                onChange={(e) => setConfigField("clientId", e.target.value)}
                className={inputClass}
                disabled={!isAdmin}
              />
            </Field>
            <Field label="Client secret">
              <input
                ref={clientSecretRef}
                type="password"
                placeholder={integration?.credentials.clientSecret ?? "Paste client secret"}
                className={inputClass}
                disabled={!isAdmin}
                autoComplete="off"
              />
            </Field>
            <p className="text-xs text-text-faint">
              OAuth redirect flows will be available in a future release. Store credentials here so agents and n8n workflows can reference this account.
            </p>
          </>
        )}

        {connectionType === "mcp" && (
          <>
            <Field label="MCP server URL">
              <input
                value={config.mcpServerUrl}
                onChange={(e) => setConfigField("mcpServerUrl", e.target.value)}
                placeholder="https://… or stdio command"
                className={inputClass}
                disabled={!isAdmin}
              />
            </Field>
            <Field label="Server name">
              <input
                value={config.mcpServerName}
                onChange={(e) => setConfigField("mcpServerName", e.target.value)}
                placeholder="e.g. google-sheets-mcp"
                className={inputClass}
                disabled={!isAdmin}
              />
            </Field>
          </>
        )}

        {connectionType === "n8n" && (
          <Field label="n8n workflow ID">
            <input
              value={config.n8nWorkflowId}
              onChange={(e) => setConfigField("n8nWorkflowId", e.target.value)}
              className={inputClass}
              disabled={!isAdmin}
            />
          </Field>
        )}

        {item.slug === "google-sheets" && (
          <Field label="Default spreadsheet ID">
            <input
              value={config.spreadsheetId}
              onChange={(e) => setConfigField("spreadsheetId", e.target.value)}
              placeholder="From the sheet URL"
              className={inputClass}
              disabled={!isAdmin}
            />
          </Field>
        )}

        {item.slug === "google-docs" && (
          <Field label="Default document ID">
            <input
              value={config.docId}
              onChange={(e) => setConfigField("docId", e.target.value)}
              placeholder="From the document URL"
              className={inputClass}
              disabled={!isAdmin}
            />
          </Field>
        )}

        {item.slug === "notion" && (
          <>
            <Field label="Default page ID">
              <input
                value={config.pageId}
                onChange={(e) => setConfigField("pageId", e.target.value)}
                className={inputClass}
                disabled={!isAdmin}
              />
            </Field>
            <Field label="Default database ID (for create)">
              <input
                value={config.databaseId}
                onChange={(e) => setConfigField("databaseId", e.target.value)}
                className={inputClass}
                disabled={!isAdmin}
              />
            </Field>
          </>
        )}

        {item.slug === "slack" && (
          <Field label="Default channel">
            <input
              value={config.channel}
              onChange={(e) => setConfigField("channel", e.target.value)}
              placeholder="#general or channel ID"
              className={inputClass}
              disabled={!isAdmin}
            />
          </Field>
        )}

        {item.slug === "buffer" && (
          <Field label="Default profile ID">
            <input
              value={config.profileId}
              onChange={(e) => setConfigField("profileId", e.target.value)}
              placeholder="From Buffer profile list"
              className={inputClass}
              disabled={!isAdmin}
            />
          </Field>
        )}

        <Field label="Notes">
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            className={cn(inputClass, "resize-none")}
            disabled={!isAdmin}
          />
        </Field>

        {integration?.lastError && (
          <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-200">
            {integration.lastError}
          </p>
        )}
      </div>

      {isAdmin && (
        <div className="space-y-2 border-t border-border-subtle p-4">
          {saveMessage && (
            <p className="text-center text-xs text-text-muted">{saveMessage}</p>
          )}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-accent px-4 py-2 text-sm text-accent-muted-fg hover:bg-accent-hover disabled:opacity-50"
            >
              {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Save
            </button>
            <button
              type="button"
              onClick={() => testMutation.mutate()}
              disabled={testMutation.isPending || !integration}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-border px-3 py-2 text-sm text-text-strong hover:bg-panel-hover disabled:opacity-50"
            >
              {testMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle2 className="h-4 w-4" />
              )}
              Verify &amp; connect
            </button>
            {integration && (
              <button
                type="button"
                onClick={() => {
                  if (confirm(`Remove ${item.name} integration?`)) deleteMutation.mutate();
                }}
                className="rounded-xl border border-border p-2 text-text-faint hover:bg-panel-hover hover:text-red-300"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      )}
    </aside>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-medium text-text-muted">{label}</span>
      {children}
    </label>
  );
}

function McpConnectorsSection({
  connectors,
  isAdmin,
}: {
  connectors: McpConnector[];
  isAdmin: boolean;
}) {
  const queryClient = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [transport, setTransport] = useState<McpTransport>("sse");
  const [serverUrl, setServerUrl] = useState("");
  const [command, setCommand] = useState("");

  const createMutation = useMutation({
    mutationFn: () =>
      api.createMcpConnector({
        name: name.trim(),
        transport,
        serverUrl: serverUrl.trim() || undefined,
        command: command.trim() || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["console"] });
      setAdding(false);
      setName("");
      setServerUrl("");
      setCommand("");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteMcpConnector(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["console"] }),
  });

  return (
    <section className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold text-text-strong">Custom MCP connectors</h2>
          <p className="text-sm text-text-muted">
            Register MCP servers agents can call — alongside catalog apps configured as MCP.
          </p>
        </div>
        {isAdmin && (
          <button
            type="button"
            onClick={() => setAdding((v) => !v)}
            className="inline-flex items-center gap-2 rounded-xl border border-border px-3 py-2 text-sm hover:bg-panel-hover"
          >
            <Zap className="h-4 w-4" />
            Add connector
          </button>
        )}
      </div>

      {adding && isAdmin && (
        <DashboardCard className="space-y-3 p-4">
          <Field label="Name">
            <input value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
          </Field>
          <Field label="Transport">
            <select
              value={transport}
              onChange={(e) => setTransport(e.target.value as McpTransport)}
              className={inputClass}
            >
              <option value="sse">SSE</option>
              <option value="stdio">stdio</option>
              <option value="http">HTTP</option>
            </select>
          </Field>
          {transport !== "stdio" ? (
            <Field label="Server URL">
              <input value={serverUrl} onChange={(e) => setServerUrl(e.target.value)} className={inputClass} />
            </Field>
          ) : (
            <Field label="Command">
              <input value={command} onChange={(e) => setCommand(e.target.value)} className={inputClass} />
            </Field>
          )}
          <button
            type="button"
            disabled={!name.trim() || createMutation.isPending}
            onClick={() => createMutation.mutate()}
            className="rounded-xl bg-accent px-4 py-2 text-sm text-accent-muted-fg hover:bg-accent-hover disabled:opacity-50"
          >
            Create connector
          </button>
        </DashboardCard>
      )}

      {connectors.length === 0 ? (
        <p className="text-sm text-text-muted">No custom MCP connectors yet.</p>
      ) : (
        <ul className="space-y-2">
          {connectors.map((c) => {
            const meta = STATUS_STYLES[c.status];
            return (
              <li key={c.id} className="rounded-xl border border-border bg-panel-elevated p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-medium text-text-strong">{c.name}</div>
                    <p className="mt-1 text-xs text-text-muted">
                      {c.transport.toUpperCase()}
                      {c.serverUrl ? ` · ${c.serverUrl}` : c.command ? ` · ${c.command}` : ""}
                    </p>
                  </div>
                  <span className={cn("rounded-md border px-2 py-0.5 text-[10px] font-medium", meta.className)}>
                    {meta.label}
                  </span>
                </div>
                {isAdmin && (
                  <button
                    type="button"
                    onClick={() => {
                      if (confirm(`Delete MCP connector "${c.name}"?`)) deleteMutation.mutate(c.id);
                    }}
                    className="mt-2 text-xs text-text-faint hover:text-red-300"
                  >
                    Remove
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
