import assert from "node:assert/strict";
import test, { describe, mock } from "node:test";

import {
  deleteProjectItemAction,
  executeProjectItemRedo,
  executeProjectItemUndo
} from "../src/features/projects/projectDetailItemActions.ts";
import type { ProjectItem } from "../src/features/projects/projectItems.ts";
import type { HistoryAction } from "../src/features/history/useUndoRedoHistory.ts";

function createItem(id: string, kind: ProjectItem["kind"], title: string): ProjectItem {
  return {
    id,
    kind,
    title,
    projectId: "p-1",
    status: kind === "CALENDAR" ? "CALENDAR" : kind === "NEXT_ACTION" ? "NEXT_ACTION" : "STUFF",
    body: { text: "", inlineMarks: [], lineBlocks: [], blockEntities: [] },
    createdAt: new Date().toISOString()
  };
}

describe("projectDetailItemActions", () => {
  describe("deleteProjectItemAction", () => {
    test("does nothing when item is null", async () => {
      const deleteItem = mock.fn(async () => {});
      const pushUndo = mock.fn();
      const clearDraft = mock.fn();
      const clearEdit = mock.fn();
      const reload = mock.fn();

      await deleteProjectItemAction(null, "__draft__", deleteItem, pushUndo, clearDraft, clearEdit, reload);

      assert.equal(deleteItem.mock.callCount(), 0);
      assert.equal(pushUndo.mock.callCount(), 0);
      assert.equal(clearDraft.mock.callCount(), 0);
      assert.equal(clearEdit.mock.callCount(), 0);
      assert.equal(reload.mock.callCount(), 0);
    });

    test("clears draft without calling API or pushUndo when item is draft", async () => {
      const draftItem = createItem("__draft__", "STUFF", "");
      const deleteItem = mock.fn(async () => {});
      const pushUndo = mock.fn();
      const clearDraft = mock.fn();
      const clearEdit = mock.fn();
      const reload = mock.fn();

      await deleteProjectItemAction(draftItem, "__draft__", deleteItem, pushUndo, clearDraft, clearEdit, reload);

      assert.equal(deleteItem.mock.callCount(), 0);
      assert.equal(pushUndo.mock.callCount(), 0);
      assert.equal(clearDraft.mock.callCount(), 1);
      assert.equal(clearEdit.mock.callCount(), 0);
      assert.equal(reload.mock.callCount(), 0);
    });

    test("deletes item, pushes undo, clears edit, and reloads for persisted item", async () => {
      const item = createItem("item-1", "NEXT_ACTION", "Write tests");
      const deleteItem = mock.fn(async (id: string) => {
        assert.equal(id, "item-1");
      });
      const pushUndo = mock.fn((action: HistoryAction<ProjectItem>) => {
        assert.deepEqual(action, { type: "DELETE", payload: item });
      });
      const clearDraft = mock.fn();
      const clearEdit = mock.fn();
      const reload = mock.fn();

      await deleteProjectItemAction(item, "__draft__", deleteItem, pushUndo, clearDraft, clearEdit, reload);

      assert.equal(deleteItem.mock.callCount(), 1);
      assert.equal(pushUndo.mock.callCount(), 1);
      assert.equal(clearDraft.mock.callCount(), 0);
      assert.equal(clearEdit.mock.callCount(), 1);
      assert.equal(reload.mock.callCount(), 1);
    });
  });

  describe("executeProjectItemUndo", () => {
    test("does nothing when action is null", async () => {
      const restoreItem = mock.fn(async () => {});
      const deleteItem = mock.fn(async () => {});
      const setSelectedId = mock.fn();
      const reload = mock.fn();

      await executeProjectItemUndo(null, restoreItem, deleteItem, setSelectedId, reload);

      assert.equal(restoreItem.mock.callCount(), 0);
      assert.equal(deleteItem.mock.callCount(), 0);
      assert.equal(setSelectedId.mock.callCount(), 0);
      assert.equal(reload.mock.callCount(), 0);
    });

    test("restores item, sets selection, and reloads on DELETE action", async () => {
      const item = createItem("item-1", "STUFF", "Task");
      const restoreItem = mock.fn(async (id: string) => {
        assert.equal(id, "item-1");
      });
      const deleteItem = mock.fn(async () => {});
      const setSelectedId = mock.fn((id: string | null) => {
        assert.equal(id, "item-1");
      });
      const reload = mock.fn();

      await executeProjectItemUndo({ type: "DELETE", payload: item }, restoreItem, deleteItem, setSelectedId, reload);

      assert.equal(restoreItem.mock.callCount(), 1);
      assert.equal(deleteItem.mock.callCount(), 0);
      assert.equal(setSelectedId.mock.callCount(), 1);
      assert.equal(reload.mock.callCount(), 1);
    });

    test("deletes item and reloads on RESTORE action", async () => {
      const item = createItem("item-1", "STUFF", "Task");
      const restoreItem = mock.fn(async () => {});
      const deleteItem = mock.fn(async (id: string) => {
        assert.equal(id, "item-1");
      });
      const setSelectedId = mock.fn();
      const reload = mock.fn();

      await executeProjectItemUndo({ type: "RESTORE", payload: item }, restoreItem, deleteItem, setSelectedId, reload);

      assert.equal(restoreItem.mock.callCount(), 0);
      assert.equal(deleteItem.mock.callCount(), 1);
      assert.equal(reload.mock.callCount(), 1);
    });
  });

  describe("executeProjectItemRedo", () => {
    test("does nothing when action is null", async () => {
      const restoreItem = mock.fn(async () => {});
      const deleteItem = mock.fn(async () => {});
      const setSelectedId = mock.fn();
      const reload = mock.fn();

      await executeProjectItemRedo(null, restoreItem, deleteItem, setSelectedId, reload);

      assert.equal(restoreItem.mock.callCount(), 0);
      assert.equal(deleteItem.mock.callCount(), 0);
    });

    test("deletes item and reloads on RESTORE action", async () => {
      const item = createItem("item-1", "STUFF", "Task");
      const restoreItem = mock.fn(async () => {});
      const deleteItem = mock.fn(async (id: string) => {
        assert.equal(id, "item-1");
      });
      const setSelectedId = mock.fn();
      const reload = mock.fn();

      await executeProjectItemRedo({ type: "RESTORE", payload: item }, restoreItem, deleteItem, setSelectedId, reload);

      assert.equal(deleteItem.mock.callCount(), 1);
      assert.equal(restoreItem.mock.callCount(), 0);
      assert.equal(reload.mock.callCount(), 1);
    });

    test("restores item, sets selection, and reloads on DELETE action", async () => {
      const item = createItem("item-1", "STUFF", "Task");
      const restoreItem = mock.fn(async (id: string) => {
        assert.equal(id, "item-1");
      });
      const deleteItem = mock.fn(async () => {});
      const setSelectedId = mock.fn((id: string | null) => {
        assert.equal(id, "item-1");
      });
      const reload = mock.fn();

      await executeProjectItemRedo({ type: "DELETE", payload: item }, restoreItem, deleteItem, setSelectedId, reload);

      assert.equal(restoreItem.mock.callCount(), 1);
      assert.equal(deleteItem.mock.callCount(), 0);
      assert.equal(setSelectedId.mock.callCount(), 1);
      assert.equal(reload.mock.callCount(), 1);
    });
  });
});
