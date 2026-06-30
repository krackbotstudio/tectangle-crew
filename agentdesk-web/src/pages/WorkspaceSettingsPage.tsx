import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Settings,
  Users,
  UserPlus,
  KeyRound,
  Shield,
  FolderKanban,
  Trash2,
  Pencil,
  CheckCircle2,
  Sparkles,
} from "lucide-react";
import { api, type User, type WorkspaceUser } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { DashboardCard, PageHeader } from "../components/workspace/DashboardUI";
import { AiModelsSection } from "../components/settings/AiModelsSection";
import { cn } from "../lib/utils";

type SettingsTab = "members" | "teams" | "ai" | "account";

const roleLabels: Record<User["role"], string> = {
  admin: "Admin",
  team_lead: "Team lead",
  team_member: "Member",
};

export function WorkspaceSettingsPage() {
  const { user, isAdmin } = useAuth();
  const [tab, setTab] = useState<SettingsTab>(isAdmin ? "members" : "account");

  const tabs: { id: SettingsTab; label: string; icon: typeof Users; adminOnly?: boolean }[] = [
    { id: "members", label: "Members", icon: Users, adminOnly: true },
    { id: "teams", label: "Team groups", icon: Shield, adminOnly: true },
    { id: "ai", label: "AI models", icon: Sparkles, adminOnly: true },
    { id: "account", label: "My account", icon: KeyRound },
  ];

  return (
    <div className="h-full overflow-y-auto p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-4xl">
        <PageHeader
          title="Workspace settings"
          subtitle="Manage team members, access permissions, and your account."
        />

        <div className="mb-6 flex gap-1 overflow-x-auto scrollbar-hide">
          {tabs
            .filter((t) => !t.adminOnly || isAdmin)
            .map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => setTab(id)}
                className={cn(
                  "flex shrink-0 items-center gap-2 rounded-xl px-4 py-2 text-sm transition",
                  tab === id
                    ? "bg-list-selected text-text-strong"
                    : "text-text-muted hover:bg-panel-hover hover:text-text-strong"
                )}
              >
                <Icon className="h-4 w-4" />
                {label}
              </button>
            ))}
        </div>

        {tab === "members" && isAdmin && <MembersSection />}
        {tab === "teams" && isAdmin && <TeamGroupsSection />}
        {tab === "ai" && isAdmin && <AiModelsSection />}
        {tab === "account" && user && <MyAccountSection user={user} />}
      </div>
    </div>
  );
}

function MembersSection() {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<WorkspaceUser | null>(null);
  const [adding, setAdding] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["users"],
    queryFn: () => api.getUsers(),
  });

  const deactivateMutation = useMutation({
    mutationFn: (id: string) => api.deactivateUser(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["users"] }),
    onError: (e: Error) => alert(e.message),
  });

  const users = data?.users ?? [];

  return (
    <section>
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="font-semibold text-text-strong">Team members</h2>
          <p className="text-sm text-text-muted">
            Add people, assign team and project access, reset passwords.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2 text-sm text-accent-muted-fg hover:bg-accent-hover"
        >
          <UserPlus className="h-4 w-4" />
          Add member
        </button>
      </div>

      {isLoading ? (
        <p className="text-sm text-text-muted">Loading members…</p>
      ) : (
        <ul className="space-y-2">
          {users.map((member) => (
            <li
              key={member.id}
              className="flex flex-wrap items-start gap-3 rounded-2xl border border-border bg-panel px-4 py-4"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent-light text-sm font-semibold text-accent-fg">
                {member.name.charAt(0)}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium text-text-strong">{member.name}</span>
                  <span className="rounded-full border border-border px-2 py-0.5 text-[10px] uppercase text-text-muted">
                    {roleLabels[member.role]}
                  </span>
                  {!member.isActive && (
                    <span className="rounded-full bg-panel-elevated px-2 py-0.5 text-[10px] text-text-muted">
                      Deactivated
                    </span>
                  )}
                </div>
                <div className="text-sm text-text-muted">{member.email}</div>
                <div className="mt-2 flex flex-wrap gap-1">
                  {member.teamAccess.length === 0 && member.role !== "admin" && (
                    <span className="text-xs text-text-faint">No team access</span>
                  )}
                  {member.teamAccess.map((t) => (
                    <span
                      key={t.id}
                      className="rounded-full border border-border bg-panel-elevated px-2 py-0.5 text-[10px] text-text-muted"
                    >
                      {t.name}
                    </span>
                  ))}
                  {member.projectAccess.map((p) => (
                    <span
                      key={p.id}
                      className="inline-flex items-center gap-0.5 rounded-full border border-border bg-panel-elevated px-2 py-0.5 text-[10px] text-text-muted"
                    >
                      <FolderKanban className="h-2.5 w-2.5" />
                      {p.title}
                    </span>
                  ))}
                </div>
              </div>
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={() => setEditing(member)}
                  className="rounded-lg p-2 text-text-muted hover:bg-panel-hover hover:text-text-strong"
                  title="Edit member"
                >
                  <Pencil className="h-4 w-4" />
                </button>
                {member.isActive && (
                  <button
                    type="button"
                    onClick={() => {
                      if (confirm(`Deactivate ${member.name}? They will no longer be able to sign in.`)) {
                        deactivateMutation.mutate(member.id);
                      }
                    }}
                    className="rounded-lg p-2 text-text-muted hover:bg-panel-hover hover:text-text-strong"
                    title="Deactivate"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {(adding || editing) && (
        <MemberFormModal
          member={editing ?? undefined}
          onClose={() => {
            setAdding(false);
            setEditing(null);
          }}
        />
      )}
    </section>
  );
}

function MemberFormModal({ member, onClose }: { member?: WorkspaceUser; onClose: () => void }) {
  const queryClient = useQueryClient();
  const isEdit = !!member;

  const { data: teamsData } = useQuery({ queryKey: ["teams"], queryFn: () => api.getTeams() });
  const { data: projectsData } = useQuery({ queryKey: ["projects"], queryFn: () => api.getProjects() });

  const [form, setForm] = useState({
    email: member?.email ?? "",
    name: member?.name ?? "",
    password: "",
    role: member?.role ?? ("team_member" as User["role"]),
    isActive: member?.isActive ?? true,
    teamGroupIds: member?.teamAccess.map((t) => t.id) ?? [],
    projectIds: member?.projectAccess.map((p) => p.id) ?? [],
  });
  const [resetPassword, setResetPassword] = useState("");
  const [error, setError] = useState("");

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (isEdit && member) {
        await api.updateUser(member.id, {
          name: form.name.trim(),
          role: form.role,
          isActive: form.isActive,
          teamGroupIds: form.teamGroupIds,
          projectIds: form.projectIds,
        });
        if (resetPassword.trim()) {
          await api.resetUserPassword(member.id, resetPassword);
        }
        return;
      }
      await api.createUser({
        email: form.email.trim(),
        name: form.name.trim(),
        password: form.password,
        role: form.role,
        teamGroupIds: form.teamGroupIds,
        projectIds: form.projectIds,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      onClose();
    },
    onError: (e: Error) => setError(e.message),
  });

  function toggleTeam(id: string) {
    setForm((f) => ({
      ...f,
      teamGroupIds: f.teamGroupIds.includes(id)
        ? f.teamGroupIds.filter((x) => x !== id)
        : [...f.teamGroupIds, id],
    }));
  }

  function toggleProject(id: string) {
    setForm((f) => ({
      ...f,
      projectIds: f.projectIds.includes(id)
        ? f.projectIds.filter((x) => x !== id)
        : [...f.projectIds, id],
    }));
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-border bg-panel shadow-2xl">
        <div className="border-b border-border px-5 py-4">
          <h2 className="font-semibold text-text-strong">
            {isEdit ? `Edit ${member?.name}` : "Add team member"}
          </h2>
          <p className="mt-1 text-xs text-text-muted">
            Admins have full workspace access. Others need team and project assignments.
          </p>
        </div>

        <form
          className="space-y-4 p-5"
          onSubmit={(e) => {
            e.preventDefault();
            setError("");
            saveMutation.mutate();
          }}
        >
          {!isEdit && (
            <Field label="Email">
              <input
                type="email"
                required
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                className={inputClass}
              />
            </Field>
          )}

          <Field label="Full name">
            <input
              required
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className={inputClass}
            />
          </Field>

          {!isEdit && (
            <Field label="Temporary password">
              <input
                type="password"
                required
                minLength={6}
                value={form.password}
                onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                className={inputClass}
              />
            </Field>
          )}

          {isEdit && (
            <Field label="Reset password" hint="Leave blank to keep current password">
              <input
                type="password"
                minLength={6}
                value={resetPassword}
                onChange={(e) => setResetPassword(e.target.value)}
                className={inputClass}
                placeholder="New password…"
              />
            </Field>
          )}

          <Field label="Role">
            <select
              value={form.role}
              onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as User["role"] }))}
              className={inputClass}
            >
              <option value="team_member">Member</option>
              <option value="team_lead">Team lead</option>
              <option value="admin">Admin</option>
            </select>
          </Field>

          {isEdit && (
            <label className="flex items-center gap-2 text-sm text-text-muted">
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
                className="h-4 w-4 rounded border-border"
              />
              Account active (can sign in)
            </label>
          )}

          {form.role !== "admin" && (
            <>
              <Field label="Team access">
                <div className="flex flex-wrap gap-2">
                  {(teamsData?.teams ?? []).map((t) => (
                    <label
                      key={t.id}
                      className={cn(
                        "cursor-pointer rounded-xl border px-3 py-1.5 text-xs transition",
                        form.teamGroupIds.includes(t.id)
                          ? "border-neutral-500 bg-list-selected text-text-strong"
                          : "border-border text-text-muted hover:bg-panel-hover"
                      )}
                    >
                      <input
                        type="checkbox"
                        className="sr-only"
                        checked={form.teamGroupIds.includes(t.id)}
                        onChange={() => toggleTeam(t.id)}
                      />
                      {t.name}
                    </label>
                  ))}
                </div>
              </Field>

              <Field label="Project group access">
                <div className="flex flex-wrap gap-2">
                  {(projectsData?.projects ?? []).length === 0 && (
                    <span className="text-xs text-text-faint">No project groups yet</span>
                  )}
                  {(projectsData?.projects ?? []).map((p) => (
                    <label
                      key={p.id}
                      className={cn(
                        "cursor-pointer rounded-xl border px-3 py-1.5 text-xs transition",
                        form.projectIds.includes(p.id)
                          ? "border-neutral-500 bg-list-selected text-text-strong"
                          : "border-border text-text-muted hover:bg-panel-hover"
                      )}
                    >
                      <input
                        type="checkbox"
                        className="sr-only"
                        checked={form.projectIds.includes(p.id)}
                        onChange={() => toggleProject(p.id)}
                      />
                      {p.title}
                    </label>
                  ))}
                </div>
              </Field>
            </>
          )}

          {error && (
            <div className="rounded-xl border border-border bg-panel-elevated px-3 py-2 text-sm text-text-strong">
              {error}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-border px-4 py-2 text-sm text-text-muted hover:bg-panel-hover"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saveMutation.isPending}
              className="rounded-xl bg-accent px-4 py-2 text-sm text-accent-muted-fg hover:bg-accent-hover disabled:opacity-50"
            >
              {saveMutation.isPending ? "Saving…" : isEdit ? "Save changes" : "Add member"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function TeamGroupsSection() {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState("");

  const { data } = useQuery({ queryKey: ["teams"], queryFn: () => api.getTeams() });

  const createMutation = useMutation({
    mutationFn: () => api.createTeam({ name: name.trim(), description: description.trim() || undefined }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["teams"] });
      setName("");
      setDescription("");
      setError("");
    },
    onError: (e: Error) => setError(e.message),
  });

  return (
    <section className="space-y-6">
      <div>
        <h2 className="font-semibold text-text-strong">Team groups</h2>
        <p className="text-sm text-text-muted">
          Organize agents into teams. Members get access per team assignment.
        </p>
      </div>

      <DashboardCard>
        <h3 className="mb-3 text-sm font-medium text-text-strong">Create team group</h3>
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (!name.trim()) return;
            createMutation.mutate();
          }}
        >
          <input
            placeholder="Team name (e.g. Legal)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={inputClass}
          />
          <input
            placeholder="Description (optional)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className={inputClass}
          />
          {error && <p className="text-sm text-text-muted">{error}</p>}
          <button
            type="submit"
            disabled={createMutation.isPending || !name.trim()}
            className="rounded-xl bg-accent px-4 py-2 text-sm text-accent-muted-fg hover:bg-accent-hover disabled:opacity-50"
          >
            Create team
          </button>
        </form>
      </DashboardCard>

      <ul className="space-y-2">
        {(data?.teams ?? []).map((team) => (
          <li
            key={team.id}
            className="flex items-center justify-between rounded-2xl border border-border bg-panel px-4 py-3"
          >
            <div>
              <div className="font-medium text-text-strong">{team.name}</div>
              {team.description && (
                <div className="text-xs text-text-muted">{team.description}</div>
              )}
            </div>
            <span className="text-xs text-text-faint">{team.agentCount} agents</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function MyAccountSection({ user }: { user: User }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  const resetMutation = useMutation({
    mutationFn: () => api.resetUserPassword(user.id, password),
    onSuccess: () => {
      setPassword("");
      setConfirm("");
      setSaved(true);
      setError("");
      setTimeout(() => setSaved(false), 2500);
    },
    onError: (e: Error) => setError(e.message),
  });

  return (
    <section className="space-y-6">
      <DashboardCard>
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-accent-light text-lg font-semibold text-accent-fg">
            {user.name.charAt(0)}
          </div>
          <div>
            <div className="font-semibold text-text-strong">{user.name}</div>
            <div className="text-sm text-text-muted">{user.email}</div>
            <div className="mt-1 text-xs text-text-faint">{roleLabels[user.role]}</div>
          </div>
        </div>
      </DashboardCard>

      <DashboardCard>
        <h3 className="mb-1 flex items-center gap-2 font-medium text-text-strong">
          <KeyRound className="h-4 w-4" />
          Change password
        </h3>
        <p className="mb-4 text-sm text-text-muted">Update your sign-in password.</p>
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            setError("");
            if (password !== confirm) {
              setError("Passwords do not match");
              return;
            }
            if (password.length < 6) {
              setError("Password must be at least 6 characters");
              return;
            }
            resetMutation.mutate();
          }}
        >
          <input
            type="password"
            placeholder="New password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={inputClass}
          />
          <input
            type="password"
            placeholder="Confirm new password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className={inputClass}
          />
          {error && <p className="text-sm text-text-muted">{error}</p>}
          <button
            type="submit"
            disabled={resetMutation.isPending}
            className="inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2 text-sm text-accent-muted-fg hover:bg-accent-hover disabled:opacity-50"
          >
            {saved ? (
              <>
                <CheckCircle2 className="h-4 w-4" /> Password updated
              </>
            ) : (
              "Update password"
            )}
          </button>
        </form>
      </DashboardCard>

      <DashboardCard>
        <div className="flex items-start gap-3">
          <Settings className="mt-0.5 h-5 w-5 text-text-muted" />
          <div className="text-sm text-text-muted">
            Workspace administration — member invites, team access, and project permissions — is
            available to admins under the <strong className="text-text-strong">Members</strong> tab.
          </div>
        </div>
      </DashboardCard>
    </section>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-text-muted">{label}</label>
      {hint && <p className="mb-1 text-xs text-text-faint">{hint}</p>}
      {children}
    </div>
  );
}

const inputClass =
  "w-full rounded-xl border border-border bg-panel-elevated px-3 py-2 text-sm text-text outline-none focus:border-neutral-500";
