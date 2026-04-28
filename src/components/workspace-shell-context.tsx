"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { api, ProjectPayload, WorkspacePayload } from "@/lib/api";

type WorkspaceShellContextValue = {
  workspaces: WorkspacePayload[];
  projects: ProjectPayload[];
  activeWorkspaceId: string;
  activeProjectId: string;
  setActiveWorkspaceId: (workspaceId: string) => void;
  setActiveProjectId: (projectId: string) => void;
  refreshProjects: () => Promise<void>;
};

const WorkspaceShellContext = createContext<WorkspaceShellContextValue | null>(null);

type WorkspaceShellProviderProps = {
  children: React.ReactNode;
};

export function WorkspaceShellProvider({ children }: WorkspaceShellProviderProps) {
  const [workspaces, setWorkspaces] = useState<WorkspacePayload[]>([]);
  const [projects, setProjects] = useState<ProjectPayload[]>([]);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState("");
  const [activeProjectId, setActiveProjectId] = useState("");

  useEffect(() => {
    const load = async () => {
      const workspaceList = await api.getWorkspaces();
      setWorkspaces(workspaceList);
      if (workspaceList[0]) {
        setActiveWorkspaceId(workspaceList[0].id);
      }
    };
    void load();
  }, []);

  const refreshProjects = useCallback(async () => {
    if (!activeWorkspaceId) return;
    const projectList = await api.getProjects(activeWorkspaceId);
    setProjects(projectList);
    setActiveProjectId((current) =>
      projectList.some((project) => project.id === current) ? current : (projectList[0]?.id ?? ""),
    );
  }, [activeWorkspaceId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refreshProjects();
  }, [refreshProjects]);

  const value = useMemo(
    () => ({
      workspaces,
      projects,
      activeWorkspaceId,
      activeProjectId,
      setActiveWorkspaceId,
      setActiveProjectId,
      refreshProjects,
    }),
    [workspaces, projects, activeWorkspaceId, activeProjectId, refreshProjects],
  );

  return (
    <WorkspaceShellContext.Provider value={value}>
      {children}
    </WorkspaceShellContext.Provider>
  );
}

export function useWorkspaceShell() {
  const context = useContext(WorkspaceShellContext);
  if (!context) {
    throw new Error("useWorkspaceShell must be used within WorkspaceShellProvider");
  }
  return context;
}
