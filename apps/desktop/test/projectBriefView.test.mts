import assert from "node:assert/strict";
import test, { describe } from "node:test";

import { projectBriefEditorConfig, projectBriefPresentation, type ProjectBriefProps } from "../src/features/projects/projectBriefView.ts";

const emptyBody = { text: "", inlineMarks: [], lineBlocks: [], blockEntities: [] };
const callbacks = {
  onAutosave: async () => {},
  onExitNormalMode: async () => {},
  onSave: async () => {},
  onVimModeChange: () => {}
};

function briefProps(overrides: Partial<ProjectBriefProps> = {}): ProjectBriefProps {
  return { body: emptyBody, errorMessage: null, isEditing: false, isLoading: false, projectId: "project-1", ...callbacks, ...overrides };
}

describe("project brief view", () => {
  test("selects a distinct state for missing, loading, and failed project bodies", () => {
    assert.equal(projectBriefPresentation(briefProps({ projectId: null, body: null })), "no-project");
    assert.equal(projectBriefPresentation(briefProps({ body: null, isLoading: true })), "loading");
    assert.equal(projectBriefPresentation(briefProps({ body: null, errorMessage: "Request failed" })), "error");
  });

  test("shows an empty state only for a read-only brief without text or attachments", () => {
    assert.equal(projectBriefPresentation(briefProps()), "empty");
    assert.equal(projectBriefPresentation(briefProps({ isEditing: true })), "editor");
    assert.equal(projectBriefPresentation(briefProps({ body: { ...emptyBody, blockEntities: [{ id: "entity-1", type: "file", from: 0, to: 0, assetId: "asset-1" }] } })), "editor");
  });

  test("passes the project's backing item and callbacks through to the shared editor", () => {
    const body = { ...emptyBody, text: "Project context" };
    const props = briefProps({ body, isEditing: true });
    const config = projectBriefEditorConfig(props);

    assert.deepEqual(config, { ...callbacks, initialBody: body, itemId: "project-1", readOnly: false });
    assert.equal(projectBriefEditorConfig(briefProps({ body: null })), null);
  });
});
