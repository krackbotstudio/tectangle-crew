import { query } from "../db.js";
import type { AuthUser } from "../middleware/auth.js";

/** Returns null when user has access to all teams (admin). */
export async function getAccessibleTeamIds(user: AuthUser): Promise<string[] | null> {
  if (user.role === "admin") return null;
  const result = await query<{ team_group_id: string }>(
    "SELECT team_group_id FROM user_team_access WHERE user_id = $1",
    [user.id]
  );
  return result.rows.map((r) => r.team_group_id);
}

/** Returns null when user has access to all projects (admin). */
export async function getAccessibleProjectIds(user: AuthUser): Promise<string[] | null> {
  if (user.role === "admin") return null;
  const result = await query<{ project_id: string }>(
    "SELECT project_id FROM user_project_access WHERE user_id = $1",
    [user.id]
  );
  return result.rows.map((r) => r.project_id);
}

export async function canAccessTeam(user: AuthUser, teamGroupId: string): Promise<boolean> {
  const ids = await getAccessibleTeamIds(user);
  if (ids === null) return true;
  return ids.includes(teamGroupId);
}

export async function canAccessProject(user: AuthUser, projectId: string): Promise<boolean> {
  const ids = await getAccessibleProjectIds(user);
  if (ids === null) return true;
  return ids.includes(projectId);
}
