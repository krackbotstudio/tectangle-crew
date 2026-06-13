import { Navigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Plus } from "lucide-react";
import { api } from "../lib/api";

export function ProjectsRedirectPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["projects"],
    queryFn: () => api.getProjects(),
  });

  if (isLoading) {
    return <div className="flex h-full items-center justify-center text-[#616161]">Loading…</div>;
  }

  const first = data?.projects[0];
  if (first) return <Navigate to={`/projects/${first.id}`} replace />;

  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 text-[#616161]">
      <p>No projects yet</p>
      <Link
        to="/projects/new"
        className="inline-flex items-center gap-2 rounded-md bg-accent px-4 py-2 text-sm text-accent-muted-fg hover:bg-accent-hover"
      >
        <Plus className="h-4 w-4" /> Create your first project
      </Link>
    </div>
  );
}
