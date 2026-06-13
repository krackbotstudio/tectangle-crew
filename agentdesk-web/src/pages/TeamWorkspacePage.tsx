import { useParams, NavLink } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { MessageSquare, ListTodo, BookOpen, Settings, Workflow } from "lucide-react";
import { api } from "../lib/api";
import { AgentChatView } from "../components/AgentChatView";
import { TasksPage } from "./TasksPage";
import { KnowledgePage } from "./KnowledgePage";
import { SettingsPage } from "./SettingsPage";
import { AutomationsPage } from "./AutomationsPage";
import { TeamConfigurePage } from "../components/teams/TeamConfigurePage";
import { listItemNavClass } from "../components/workspace/DashboardUI";
import { AgentAvatar } from "../components/workspace/TagEditor";
import { AgentIdentityBadge } from "../components/workspace/AgentIdentity";
import { cn } from "../lib/utils";

const tabs = [
  { id: "chat", label: "Chat", shortLabel: "Chat", icon: MessageSquare },
  { id: "tasks", label: "Tasks", shortLabel: "Tasks", icon: ListTodo },
  { id: "knowledge", label: "Knowledge", shortLabel: "Docs", icon: BookOpen },
  { id: "automations", label: "Automations", shortLabel: "Flows", icon: Workflow },
  { id: "settings", label: "Settings", shortLabel: "Settings", icon: Settings },
];

export function TeamWorkspacePage() {
  const { teamSlug, agentSlug, tab } = useParams<{
    teamSlug: string;
    agentSlug?: string;
    tab?: string;
  }>();

  const { data: teamData, isLoading } = useQuery({
    queryKey: ["team", teamSlug],
    queryFn: () => api.getTeam(teamSlug!),
  });

  if (isLoading) {
    return <div className="flex h-full items-center justify-center text-text-muted">Loading…</div>;
  }

  if (!agentSlug) {
    if (!teamData) {
      return (
        <div className="flex h-full items-center justify-center text-text-muted">Team not found.</div>
      );
    }
    return (
      <TeamConfigurePage
        teamSlug={teamSlug!}
        team={teamData.team}
        agents={teamData.agents}
        projects={teamData.projects ?? []}
        toolRequests={teamData.toolRequests ?? []}
      />
    );
  }

  const agent = teamData?.agents.find((a) => a.slug === agentSlug);
  const activeTab = tab ?? "chat";

  return (
    <div className="flex h-full flex-col">
      <header className="shrink-0 border-b border-border bg-canvas">
        <div className="flex items-start gap-3 px-4 py-3 sm:px-6">
          <AgentAvatar name={agent?.name ?? agentSlug} color={agent?.avatarColor} />
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-base font-semibold text-text-strong sm:text-lg">
              {agent?.name ?? agentSlug}
            </h1>
            {agent && (
              <div className="mt-1.5">
                <AgentIdentityBadge agent={agent} />
              </div>
            )}
          </div>
        </div>

        <nav
          className="grid grid-cols-5 gap-1 border-t border-border-subtle px-2 py-2 sm:flex sm:gap-1 sm:overflow-x-auto sm:px-6 scrollbar-hide"
          aria-label="Agent workspace"
        >
          {tabs.map(({ id, label, shortLabel, icon: Icon }) => (
            <NavLink
              key={id}
              to={`/teams/${teamSlug}/agents/${agentSlug}/${id}`}
              end={id === "chat"}
              title={label}
              className={({ isActive }) =>
                listItemNavClass(
                  isActive || (id === "chat" && !tab && activeTab === "chat"),
                  cn(
                    "flex flex-col items-center justify-center gap-0.5 px-1 py-2 text-[11px] sm:min-w-0 sm:flex-1 sm:flex-row sm:gap-1.5 sm:px-3 sm:py-1.5 sm:text-sm"
                  )
                )
              }
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="truncate">
                <span className="sm:hidden">{shortLabel}</span>
                <span className="hidden sm:inline">{label}</span>
              </span>
            </NavLink>
          ))}
        </nav>
      </header>

      <div className="min-h-0 flex-1">
        {(activeTab === "chat" || !tab) && (
          <AgentChatView slug={agentSlug} agentName={agent?.name} avatarColor={agent?.avatarColor} />
        )}
        {activeTab === "tasks" && <TasksPage embedded agentSlug={agentSlug} />}
        {activeTab === "knowledge" && <KnowledgePage embedded agentSlug={agentSlug} />}
        {activeTab === "automations" && <AutomationsPage embedded agentSlug={agentSlug} />}
        {activeTab === "settings" && <SettingsPage embedded agentSlug={agentSlug} />}
      </div>
    </div>
  );
}
