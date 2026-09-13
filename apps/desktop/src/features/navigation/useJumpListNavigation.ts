import { useCallback, useState } from "react";
import type { ScreenId } from "../keybinds/types";
import type { Project } from "../projects/types";
import type { ProjectItem } from "../projects/projectItems";
import { resolveProjectItemDestination } from "./projectItemDestination";
import { applyJumpEntry, getCurrentJumpEntry, type JumpControllers } from "./jumpEntryState";
import { createJumpList, jumpBack, jumpForward, pushJump, type JumpEntry, type JumpListState } from "./jumpList";

export type UseJumpListNavigationProps = {
  activeScreen: ScreenId;
  setActiveScreen: (screen: ScreenId) => void;
  controllers: JumpControllers;
  projectDetailProject: Project | null;
  setProjectDetailProject: (project: Project | null) => void;
};

/**
 * Manages navigation history using a jump list supporting Ctrl+o and Ctrl+i.
 *
 * @example
 * const navigation = useJumpListNavigation({ activeScreen, setActiveScreen, controllers, projectDetailProject, setProjectDetailProject });
 */
export function useJumpListNavigation(props: UseJumpListNavigationProps) {
  const { activeScreen, controllers, projectDetailProject, setActiveScreen, setProjectDetailProject } = props;
  const [jumpList, setJumpList] = useState<JumpListState>(() => createJumpList());

  const jumpTo = useCallback((target: JumpEntry) => {
    const current = getCurrentJumpEntry(activeScreen, controllers, projectDetailProject);
    setJumpList((prev) => pushJump(prev, current, target));
    applyJumpEntry(target, controllers, setActiveScreen, setProjectDetailProject);
  }, [activeScreen, controllers, projectDetailProject, setActiveScreen, setProjectDetailProject]);

  const goBack = useCallback(() => {
    const result = jumpBack(jumpList);
    if (!result) return;
    setJumpList(result.state);
    applyJumpEntry(result.entry, controllers, setActiveScreen, setProjectDetailProject);
  }, [controllers, jumpList, setActiveScreen, setProjectDetailProject]);

  const goForward = useCallback(() => {
    const result = jumpForward(jumpList);
    if (!result) return;
    setJumpList(result.state);
    applyJumpEntry(result.entry, controllers, setActiveScreen, setProjectDetailProject);
  }, [controllers, jumpList, setActiveScreen, setProjectDetailProject]);

  const openOwnerProject = useCallback((projectId: string, projectTitle?: string | null, targetItemId?: string | null) => {
    jumpTo({
      screen: "project-detail",
      zone: "project-actions-list",
      projectId,
      projectTitle,
      selectedItemId: targetItemId ?? null
    });
  }, [jumpTo]);

  const openProjectItemDestination = useCallback((item: ProjectItem) => {
    const target = resolveProjectItemDestination(item);
    if (target) jumpTo(target);
  }, [jumpTo]);

  const jumpToScreen = useCallback((screen: ScreenId, beforeNavigate?: () => void) => {
    beforeNavigate?.();
    const current = getCurrentJumpEntry(activeScreen, controllers, projectDetailProject);
    setJumpList((prev) => pushJump(prev, current, { screen }));
    setActiveScreen(screen);
  }, [activeScreen, controllers, projectDetailProject, setActiveScreen]);

  return { goBack, goForward, jumpList, jumpTo, jumpToScreen, openOwnerProject, openProjectItemDestination };
}
