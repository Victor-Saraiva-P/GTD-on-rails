import { useUndoRedoHistory } from "../history/useUndoRedoHistory";
import { useActiveZone } from "../keybinds/hooks";
import type { NextAction } from "./types";
import {
  useNextActionsFilterState,
  useNextActionSelection,
  useNextActionEditState,
  useNextActionsActions,
  useNextActionsPruning,
  buildController
} from "./useNextActionsWorkspaceController";
import { useOnGoingNextActionsQuery } from "./useOnGoingNextActionsQuery";

function useOnGoingNextActionsModel() {
  const query = useOnGoingNextActionsQuery();
  const selection = useNextActionSelection(query.items);
  const edit = useNextActionEditState();
  const zone = useActiveZone();
  const history = useUndoRedoHistory<NextAction>();
  return { edit, query, selection, zone, filter: { context: null, orderBy: null } };
}

/**
 * Composes on going next action list, selection, and editing state.
 *
 * @example const controller = useOnGoingNextActionsWorkspaceController()
 */
export function useOnGoingNextActionsWorkspaceController() {
  const model = useOnGoingNextActionsModel();
  const actions = {
    ...useNextActionsActions(model as any),
    toggleOrder: () => {}
  };
  useNextActionsPruning(model as any);
  return buildController(model as any, actions as any);
}

export type OnGoingNextActionsWorkspaceController = ReturnType<typeof useOnGoingNextActionsWorkspaceController>;
