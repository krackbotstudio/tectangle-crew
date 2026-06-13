import { PanelLeft, UserCircle } from "lucide-react";
import { useWorkspaceLayout } from "../../context/WorkspaceLayoutContext";

interface MobileWorkspaceBarProps {
  showContext: boolean;
  showDetail: boolean;
  contextLabel?: string;
  detailLabel?: string;
}

export function MobileWorkspaceBar({
  showContext,
  showDetail,
  contextLabel = "Browse",
  detailLabel = "Profile",
}: MobileWorkspaceBarProps) {
  const { openContext, openDetail } = useWorkspaceLayout();

  if (!showContext && !showDetail) return null;

  return (
    <div className="flex shrink-0 items-center gap-2 border-b border-border-subtle bg-panel px-3 py-2 lg:hidden">
      {showContext && (
        <button
          type="button"
          onClick={openContext}
          className="inline-flex items-center gap-1.5 rounded-xl border border-border px-3 py-1.5 text-xs font-medium text-text-strong hover:bg-panel-hover"
        >
          <PanelLeft className="h-4 w-4" />
          {contextLabel}
        </button>
      )}
      <div className="flex-1" />
      {showDetail && (
        <button
          type="button"
          onClick={openDetail}
          className="inline-flex items-center gap-1.5 rounded-xl border border-border px-3 py-1.5 text-xs font-medium text-text-strong hover:bg-panel-hover"
        >
          <UserCircle className="h-4 w-4" />
          {detailLabel}
        </button>
      )}
    </div>
  );
}
