import { useLocation } from "react-router-dom";

import { NavRail } from "../components/workspace/NavRail";
import { AgentsContextPanel } from "../components/workspace/AgentsContextPanel";
import { ContextPanel } from "../components/workspace/ContextPanel";
import { DetailPanel } from "../components/workspace/DetailPanel";
import { BottomNav } from "../components/workspace/BottomNav";
import { Drawer } from "../components/workspace/Drawer";
import { MobileWorkspaceBar } from "../components/workspace/MobileWorkspaceBar";
import { WorkspaceLayoutProvider, useWorkspaceLayout } from "../context/WorkspaceLayoutContext";

export function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  return (
    <WorkspaceLayoutProvider>
      <WorkspaceLayoutInner>{children}</WorkspaceLayoutInner>
    </WorkspaceLayoutProvider>
  );
}

function WorkspaceLayoutInner({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const { isDesktop, contextOpen, detailOpen, closeContext, closeDetail } = useWorkspaceLayout();

  const isAgentsHub = location.pathname.startsWith("/agents");
  const isTeamsOrProjects =
    location.pathname.startsWith("/teams") || location.pathname.startsWith("/projects");

  const showContext = isAgentsHub || isTeamsOrProjects;

  const showDetail =
    (location.pathname.startsWith("/teams/") || location.pathname.startsWith("/projects/")) &&
    location.pathname.includes("/agents/");

  const contextTitle = isAgentsHub
    ? "All agents"
    : location.pathname.startsWith("/teams")
      ? "Teams"
      : "Project groups";
  const detailTitle = "Agent profile";

  return (
    <div className="flex h-full overflow-hidden bg-canvas">
      <NavRail />

      {showContext && isDesktop && (
        isAgentsHub ? <AgentsContextPanel mode="inline" /> : <ContextPanel mode="inline" />
      )}

      <div className="flex min-w-0 flex-1 flex-col pb-[calc(4.25rem+env(safe-area-inset-bottom))] lg:pb-0">
        {!isDesktop && (
          <MobileWorkspaceBar
            showContext={showContext}
            showDetail={showDetail}
            contextLabel={contextTitle}
          />
        )}
        <div className="min-h-0 flex-1">{children}</div>
      </div>

      {showDetail && isDesktop && <DetailPanel mode="inline" />}

      <BottomNav />

      {!isDesktop && showContext && (
        <Drawer open={contextOpen} onClose={closeContext} side="left" title={contextTitle}>
          {isAgentsHub ? <AgentsContextPanel mode="overlay" /> : <ContextPanel mode="overlay" />}
        </Drawer>
      )}

      {!isDesktop && showDetail && (
        <Drawer open={detailOpen} onClose={closeDetail} side="right" title={detailTitle}>
          <DetailPanel mode="overlay" />
        </Drawer>
      )}
    </div>
  );
}
