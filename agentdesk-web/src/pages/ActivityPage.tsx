import { TasksPage } from "./TasksPage";
import { PageHeader } from "../components/workspace/DashboardUI";

export function ActivityPage() {
  return (
    <div className="h-full overflow-y-auto p-4 sm:p-6 lg:p-8">
      <PageHeader
        title="Activity"
        subtitle="Recent automation runs across all agents."
      />
      <TasksPage embedded agentSlug="content" />
    </div>
  );
}
