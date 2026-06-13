import { Navigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";

export function TeamsRedirectPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["teams"],
    queryFn: () => api.getTeams(),
  });

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center text-[#616161]">Loading teams…</div>
    );
  }

  const first = data?.teams[0];
  if (first) return <Navigate to={`/teams/${first.slug}`} replace />;

  return (
    <div className="flex h-full items-center justify-center text-[#616161]">
      No teams configured yet.
    </div>
  );
}
