import { Navigate, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "./context/AuthContext";
import { ProtectedLayout } from "./layouts/ProtectedLayout";
import { LandingPage } from "./pages/LandingPage";
import { AuthPage } from "./pages/AuthPage";
import { AuthCallbackPage } from "./pages/AuthCallbackPage";
import { HomePage } from "./pages/HomePage";
import { TeamsRedirectPage } from "./pages/TeamsRedirectPage";
import { TeamWorkspacePage } from "./pages/TeamWorkspacePage";
import { ProjectsRedirectPage } from "./pages/ProjectsRedirectPage";
import { CreateProjectPage } from "./pages/CreateProjectPage";
import { ProjectWorkspacePage } from "./pages/ProjectWorkspacePage";
import { WorkHubPage } from "./pages/WorkHubPage";
import { WorkspaceSettingsPage } from "./pages/WorkspaceSettingsPage";
import { AppStorePage } from "./pages/AppStorePage";
import { ConsolePage } from "./pages/ConsolePage";
import { AgentsRedirectPage } from "./pages/AgentsRedirectPage";
import { AgentManagePage } from "./pages/AgentManagePage";
import { TemplateLibraryPage } from "./pages/TemplateLibraryPage";
import { SocialMediaPage } from "./pages/SocialMediaPage";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: 1 },
  },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<AuthPage mode="signin" />} />
          <Route path="/signup" element={<AuthPage mode="signup" />} />
          <Route path="/auth/callback" element={<AuthCallbackPage />} />
          <Route element={<ProtectedLayout />}>
            <Route path="/dashboard" element={<HomePage />} />
            <Route path="/teams" element={<TeamsRedirectPage />} />
            <Route path="/teams/:teamSlug" element={<TeamWorkspacePage />} />
            <Route path="/teams/:teamSlug/agents/:agentSlug" element={<TeamWorkspacePage />} />
            <Route path="/teams/:teamSlug/agents/:agentSlug/:tab" element={<TeamWorkspacePage />} />
            <Route path="/projects" element={<ProjectsRedirectPage />} />
            <Route path="/projects/new" element={<CreateProjectPage />} />
            <Route path="/projects/:projectId" element={<ProjectWorkspacePage />} />
            <Route path="/projects/:projectId/agents/:agentSlug" element={<ProjectWorkspacePage />} />
            <Route path="/agents" element={<AgentsRedirectPage />} />
            <Route path="/templates" element={<TemplateLibraryPage />} />
            <Route path="/social" element={<SocialMediaPage />} />
            <Route path="/agents/:agentSlug" element={<AgentManagePage />} />
            <Route path="/agents/:agentSlug/:tab" element={<AgentManagePage />} />
            <Route path="/work" element={<WorkHubPage />} />
            <Route path="/app-store" element={<AppStorePage />} />
            <Route path="/console" element={<ConsolePage />} />
            <Route path="/activity" element={<Navigate to="/work" replace />} />
            <Route path="/settings" element={<WorkspaceSettingsPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </QueryClientProvider>
  );
}
