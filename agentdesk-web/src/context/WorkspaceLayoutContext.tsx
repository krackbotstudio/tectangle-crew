import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { useMediaQuery } from "../hooks/useMediaQuery";

interface WorkspaceLayoutContextValue {
  isDesktop: boolean;
  contextOpen: boolean;
  detailOpen: boolean;
  openContext: () => void;
  closeContext: () => void;
  openDetail: () => void;
  closeDetail: () => void;
  closeDrawers: () => void;
}

const WorkspaceLayoutContext = createContext<WorkspaceLayoutContextValue | null>(null);

export function WorkspaceLayoutProvider({ children }: { children: React.ReactNode }) {
  const isDesktop = useMediaQuery("(min-width: 1024px)");
  const location = useLocation();
  const [contextOpen, setContextOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);

  const closeDrawers = useCallback(() => {
    setContextOpen(false);
    setDetailOpen(false);
  }, []);

  useEffect(() => {
    closeDrawers();
  }, [location.pathname, closeDrawers]);

  useEffect(() => {
    if (isDesktop) closeDrawers();
  }, [isDesktop, closeDrawers]);

  const value = useMemo(
    () => ({
      isDesktop,
      contextOpen,
      detailOpen,
      openContext: () => setContextOpen(true),
      closeContext: () => setContextOpen(false),
      openDetail: () => setDetailOpen(true),
      closeDetail: () => setDetailOpen(false),
      closeDrawers,
    }),
    [isDesktop, contextOpen, detailOpen, closeDrawers]
  );

  return (
    <WorkspaceLayoutContext.Provider value={value}>{children}</WorkspaceLayoutContext.Provider>
  );
}

export function useWorkspaceLayout() {
  const ctx = useContext(WorkspaceLayoutContext);
  if (!ctx) {
    throw new Error("useWorkspaceLayout must be used within WorkspaceLayoutProvider");
  }
  return ctx;
}
