import { useState } from "react";
import type { Project } from "./types";

function selectedProject(projects: Project[], selectedId: string | null): Project | null {
  return projects.find((project) => project.id === selectedId) ?? projects[0] ?? null;
}

function selectedProjectIndex(projects: Project[], selectedItem: Project | null): number {
  return selectedItem ? projects.findIndex((project) => project.id === selectedItem.id) : -1;
}

function selectByOffset(projects: Project[], selectedIndex: number, setSelectedId: (id: string | null) => void, offset: number) {
  if (projects.length === 0) return;
  const nextIndex = Math.min(Math.max(selectedIndex + offset, 0), projects.length - 1);
  setSelectedId(projects[nextIndex].id);
}

/**
 * Tracks selected project and bounded keyboard navigation.
 *
 * @example const selection = useProjectSelection(projects)
 */
export function useProjectSelection(projects: Project[]) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selectedItem = selectedProject(projects, selectedId);
  const selectedIndex = selectedProjectIndex(projects, selectedItem);
  return { selectedId, selectedItem, selectedIndex, setSelectedId, selectNext: () => selectByOffset(projects, selectedIndex, setSelectedId, 1), selectPrevious: () => selectByOffset(projects, selectedIndex, setSelectedId, -1) };
}
