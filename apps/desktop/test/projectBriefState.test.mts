import assert from "node:assert/strict";
import test, { describe } from "node:test";

import {
  beginProjectBriefLoad,
  emptyProjectBriefState,
  failProjectBriefLoad,
  finishProjectBriefEditing,
  resolveProjectBriefLoad,
  setProjectBriefBody,
  setProjectBriefError,
  setProjectBriefVimMode,
  startProjectBriefEditing
} from "../src/features/projects/projectBriefState.ts";

const body = { text: "Project context", inlineMarks: [], lineBlocks: [], blockEntities: [] };

describe("project brief state", () => {
  test("starts loading a fresh canonical body for the selected project", () => {
    assert.deepEqual(beginProjectBriefLoad("project-1"), {
      body: null,
      errorMessage: null,
      isEditing: false,
      isLoading: true,
      projectId: "project-1",
      vimMode: null
    });
  });

  test("keeps a newer project selection when a prior request resolves", () => {
    const current = beginProjectBriefLoad("project-2");

    assert.equal(resolveProjectBriefLoad(current, "project-1", body), current);
  });

  test("exposes a loaded brief body for editing", () => {
    const loaded = resolveProjectBriefLoad(beginProjectBriefLoad("project-1"), "project-1", body);

    assert.deepEqual(startProjectBriefEditing(loaded), { ...loaded, isEditing: true });
  });

  test("does not enter edit mode before the canonical body is available", () => {
    assert.equal(startProjectBriefEditing(beginProjectBriefLoad("project-1")).isEditing, false);
  });

  test("updates the optimistic body and clears edit state after normal-mode exit", () => {
    const loaded = resolveProjectBriefLoad(beginProjectBriefLoad("project-1"), "project-1", body);
    const editing = setProjectBriefVimMode(startProjectBriefEditing(loaded), "NORMAL");
    const nextBody = { ...body, text: "Updated context" };

    assert.deepEqual(finishProjectBriefEditing(setProjectBriefBody(editing, nextBody)), {
      ...loaded,
      body: nextBody,
      isEditing: false,
      vimMode: null
    });
  });

  test("records a body-load error for the current project only", () => {
    const failed = failProjectBriefLoad(beginProjectBriefLoad("project-1"), "project-1", "Request failed");

    assert.equal(failed.errorMessage, "Request failed");
    assert.equal(failed.isLoading, false);
    assert.equal(setProjectBriefError(failed, "Unable to save body").errorMessage, "Unable to save body");
    assert.equal(emptyProjectBriefState().projectId, null);
  });
});
