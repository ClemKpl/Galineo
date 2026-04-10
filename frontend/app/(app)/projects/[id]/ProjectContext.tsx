'use client';

import { createContext, useContext } from 'react';

export type ProjectMember = {
  id: number;
  name: string;
  email: string;
  role_id: number;
  role_name: string;
  last_login_at?: string | null;
  avatar?: string | null;
};

export type Project = {
  id: number;
  title: string;
  description: string | null;
  deadline: string | null;
  owner_id: number;
  owner_name?: string;
  members?: ProjectMember[];
  invitations?: any[];
  my_role_id?: number;
  avatar?: string | null;
  is_favorite?: number;
  status: 'active' | 'completed' | 'deleted';
};

const ProjectContext = createContext<Project | null>(null);

export function ProjectProvider({ value, children }: { value: Project; children: React.ReactNode }) {
  return <ProjectContext.Provider value={value}>{children}</ProjectContext.Provider>;
}

export function useProject() {
  const project = useContext(ProjectContext);
  if (!project) throw new Error('useProject must be used within a ProjectProvider');
  return project;
}

