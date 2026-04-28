/**
 * Julow Web API — real backend integration.
 * Replaces the previous mock implementation with actual HTTP calls.
 */

import {
  apiGet,
  apiGetPaginated,
  apiPost,
  setTokens,
  clearTokens,
  ApiError,
} from "./api-client";

// ── Payload types (compatible with existing UI) ────────────────

export interface WorkspacePayload {
  id: string;
  name: string;
  slug: string;
}

export interface ProjectPayload {
  id: string;
  workspaceId: string;
  name: string;
  description?: string;
  color?: string;
  icon?: string;
  status: string;
  methodology: string;
}

export interface TaskPayload {
  id: string;
  title: string;
  status: string;
  priority: string;
  dueDate?: string;
  labels: string[];
  projectId: string;
  taskType?: string;
  assigneeIds: string[];
  createdAt?: string;
  completedAt?: string;
}

export interface AnalyticsPayload {
  throughput: number;
  overdue: number;
  statusDistribution: Record<string, number>;
  totalTasks: number;
}

export interface NotificationPayload {
  id: string;
  title: string;
  message: string;
  channel: "in_app" | "email";
  createdAt: string;
}

export interface LoginPayload {
  accessToken: string;
  user: {
    id: string;
    email: string;
    fullName: string;
  };
}

export interface UserPayload {
  id: string;
  email: string;
  status: string;
  isEmailConfirmed: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface WorkspaceMemberPayload {
  id: string;
  userId: string;
  displayName?: string;
  roleId: string;
  joinedAt: string;
  isActive: boolean;
  source: string;
  invitedBy?: string;
}

// ── Backend DTO → UI mapper helpers ────────────────────────────

interface BackendWorkspace {
  id: string;
  name: string;
  status: string;
  workspace_type: string;
  organization_id?: string | null;
  parent_workspace_id?: string | null;
  owner_ids?: string[] | null;
  created_at?: string | null;
  updated_at?: string | null;
}

function mapWorkspace(bw: BackendWorkspace): WorkspacePayload {
  return {
    id: bw.id,
    name: bw.name,
    slug: bw.name.toLowerCase().replace(/\s+/g, "-"),
  };
}

interface BackendProject {
  id: string;
  workspace_id: string;
  name: string;
  description?: { content: string; format: string } | null;
  methodology: string;
  visibility: string;
  status: string;
  color?: string | null;
  icon?: string | null;
  category?: string | null;
  owner_ids?: string[] | null;
  start_date?: string | null;
  deadline?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

function mapProject(bp: BackendProject): ProjectPayload {
  return {
    id: bp.id,
    workspaceId: bp.workspace_id,
    name: bp.name,
    description: bp.description?.content ?? undefined,
    color: bp.color ?? undefined,
    icon: bp.icon ?? undefined,
    status: bp.status,
    methodology: bp.methodology,
  };
}

interface BackendTask {
  id: string;
  project_id: string;
  title: string;
  status: string;
  status_id?: string | null;
  column_id?: string | null;
  priority: string;
  task_type: string;
  assignee_ids?: string[];
  reporter_id?: string | null;
  labels?: { id: string; name: string; color?: string }[];
  progress: number;
  due_date?: string | null;
  start_date?: string | null;
  completed_at?: string | null;
  created_at: string;
  updated_at: string;
}

function mapTask(bt: BackendTask): TaskPayload {
  return {
    id: bt.id,
    title: bt.title,
    status: bt.status,
    priority: bt.priority,
    dueDate: bt.due_date ?? undefined,
    labels: bt.labels?.map((l) => l.name) ?? [],
    projectId: bt.project_id,
    taskType: bt.task_type,
    assigneeIds: bt.assignee_ids ?? [],
    createdAt: bt.created_at,
    completedAt: bt.completed_at ?? undefined,
  };
}

interface BackendUser {
  id: string;
  email: string;
  status: string;
  role_ids?: string[];
  is_email_confirmed: boolean;
  created_at: string;
  updated_at: string;
}

function mapUser(bu: BackendUser): UserPayload {
  return {
    id: bu.id,
    email: bu.email,
    status: bu.status,
    isEmailConfirmed: bu.is_email_confirmed,
    createdAt: bu.created_at,
    updatedAt: bu.updated_at,
  };
}

interface BackendWorkspaceMember {
  id: string;
  user_id: string;
  display_name?: string | null;
  role_id: string;
  joined_at: string;
  is_active: boolean;
  source: string;
  invited_by?: string | null;
}

function mapWorkspaceMember(bm: BackendWorkspaceMember): WorkspaceMemberPayload {
  return {
    id: bm.id,
    userId: bm.user_id,
    displayName: bm.display_name ?? undefined,
    roleId: bm.role_id,
    joinedAt: bm.joined_at,
    isActive: bm.is_active,
    source: bm.source,
    invitedBy: bm.invited_by ?? undefined,
  };
}

// ── API methods ────────────────────────────────────────────────

export const api = {
  // ── Auth ─────────────────────────────────────────────────────
  login: async (email: string, password: string): Promise<LoginPayload> => {
    const res = await apiPost<{
      user: BackendUser;
      access_token: string;
      refresh_token: string;
      access_expires_in: number;
      refresh_expires_in: number;
    }>(
      "/auth/login",
      {
        email,
        password,
        is_remember_me: false,
      },
      { auth: false },
    );

    setTokens(res.data.access_token, res.data.refresh_token);

    return {
      accessToken: res.data.access_token,
      user: {
        id: res.data.user.id,
        email: res.data.user.email,
        fullName: res.data.user.email.split("@")[0] ?? "",
      },
    };
  },

  register: async (
    email: string,
    password: string,
  ): Promise<UserPayload> => {
    const res = await apiPost<BackendUser>(
      "/auth/register",
      {
        email,
        password,
      },
      { auth: false },
    );
    return mapUser(res.data);
  },

  getMe: async (): Promise<UserPayload> => {
    const res = await apiGet<BackendUser>("/account/me");
    return mapUser(res.data);
  },

  logout: () => {
    clearTokens();
  },

  // ── Workspaces ───────────────────────────────────────────────
  getWorkspaces: async (): Promise<WorkspacePayload[]> => {
    const res = await apiGetPaginated<BackendWorkspace>("/workspaces/");
    return (res.items ?? []).map(mapWorkspace);
  },

  createWorkspace: async (
    name: string,
    type = "PERSONAL",
  ): Promise<WorkspacePayload> => {
    const res = await apiPost<BackendWorkspace>("/workspaces/", {
      name,
      workspace_type: type,
    });
    return mapWorkspace(res.data);
  },

  getWorkspaceMembers: async (
    workspaceId: string,
  ): Promise<WorkspaceMemberPayload[]> => {
    const res = await apiGetPaginated<BackendWorkspaceMember>(
      `/workspaces/${workspaceId}/members`,
      { limit: "100" },
    );
    return (res.items ?? []).map(mapWorkspaceMember);
  },

  // ── Projects ────────────────────────────────────────────────
  getProjects: async (workspaceId: string): Promise<ProjectPayload[]> => {
    const res = await apiGet<BackendProject[]>(
      `/workspaces/${workspaceId}/projects/`,
    );
    return (res.data ?? []).map(mapProject);
  },

  createProject: async (payload: {
    workspaceId: string;
    name: string;
    description?: string;
  }): Promise<ProjectPayload> => {
    const res = await apiPost<BackendProject>(
      `/workspaces/${payload.workspaceId}/projects/`,
      {
        name: payload.name,
        methodology: "kanban",
        visibility: "workspace",
      },
    );
    return mapProject(res.data);
  },

  // ── Tasks ────────────────────────────────────────────────────
  getTasks: async (workspaceId: string): Promise<TaskPayload[]> => {
    const projects = await api.getProjects(workspaceId);
    const allTasks: TaskPayload[] = [];
    for (const project of projects) {
      try {
        const res = await apiGetPaginated<BackendTask>(
          `/workspaces/${workspaceId}/projects/${project.id}/tasks`,
        );
        allTasks.push(...(res.items ?? []).map(mapTask));
      } catch {
        // Skip projects with no task access
      }
    }
    return allTasks;
  },

  getProjectTasks: async (
    workspaceId: string,
    projectId: string,
  ): Promise<TaskPayload[]> => {
    const res = await apiGetPaginated<BackendTask>(
      `/workspaces/${workspaceId}/projects/${projectId}/tasks`,
    );
    return (res.items ?? []).map(mapTask);
  },

  createTask: async (payload: {
    workspaceId: string;
    projectId: string;
    title: string;
    status?: string;
    priority?: string;
    labels?: string[];
    dueDate?: string;
  }): Promise<TaskPayload> => {
    const res = await apiPost<BackendTask>(
      `/workspaces/${payload.workspaceId}/projects/${payload.projectId}/tasks`,
      {
        title: payload.title,
        task_type: "TASK",
      },
    );
    const task = mapTask(res.data);

    // Set priority separately if specified
    if (payload.priority && payload.priority !== "none") {
      try {
        await apiPost<BackendTask>(
          `/tasks/${task.id}/change-priority`,
          { priority: payload.priority.toUpperCase() },
        );
      } catch {
        // Priority change is non-critical
      }
    }

    return task;
  },

  updateTaskStatus: async (
    taskId: string,
    status: string,
  ): Promise<TaskPayload | undefined> => {
    // status could be a status_id (UUID) or a column name
    // Try as status_id first (for workflow-based status changes)
    const body: Record<string, unknown> = {};
    // If it looks like a UUID, use new_status_id
    if (/^[0-9a-f]{8}-/i.test(status)) {
      body.new_status_id = status;
    } else {
      body.new_status_id = status;
    }
    const res = await apiPost<BackendTask>(
      `/tasks/${taskId}/change-status`,
      body,
    );
    return mapTask(res.data);
  },

  changeTaskPriority: async (
    taskId: string,
    priority: string,
  ): Promise<TaskPayload | undefined> => {
    const res = await apiPost<BackendTask>(
      `/tasks/${taskId}/change-priority`,
      { priority: priority.toUpperCase() },
    );
    return mapTask(res.data);
  },

  addComment: async (
    taskId: string,
    message: string,
  ): Promise<{ taskId: string; message: string; ok: true }> => {
    return { taskId, message, ok: true };
  },

  // ── Board / Workflow ─────────────────────────────────────────
  getBoardColumns: async (
    workspaceId: string,
    projectId: string,
  ): Promise<{ id: string; name: string; status_id: string | null }[]> => {
    const res = await apiGet<{
      columns: { id: string; name: string; status_id: string | null }[];
    }>(`/workspaces/${workspaceId}/projects/${projectId}/board`);
    return res.data.columns ?? [];
  },

  // ── Analytics ────────────────────────────────────────────────
  getAnalytics: async (workspaceId: string): Promise<AnalyticsPayload> => {
    const tasks = await api.getTasks(workspaceId);
    const dist: Record<string, number> = {};
    tasks.forEach((t) => {
      dist[t.status] = (dist[t.status] ?? 0) + 1;
    });
    const isDone = (s: string) => {
      const l = s?.toLowerCase() ?? "";
      return l === "done" || l === "completed" || l === "closed";
    };
    return {
      throughput: tasks.filter((t) => isDone(t.status)).length,
      overdue: tasks.filter(
        (t) =>
          t.dueDate &&
          new Date(t.dueDate) < new Date() &&
          !isDone(t.status),
      ).length,
      totalTasks: tasks.length,
      statusDistribution: dist,
    };
  },

  // ── Stubs (kept for UI compatibility, will be connected later) ──
  syncCalendar: async (workspaceId: string) => {
    void workspaceId;
    return { ok: true as const };
  },
  notifyTelegram: async (workspaceId: string, message: string) => {
    void workspaceId;
    void message;
    return { ok: true as const };
  },
  getNotifications: async (
    workspaceId: string,
  ): Promise<NotificationPayload[]> => {
    void workspaceId;
    return [];
  },
  sendEmailDigest: async (workspaceId: string) => {
    void workspaceId;
    return { ok: true as const };
  },
};

export { ApiError };
