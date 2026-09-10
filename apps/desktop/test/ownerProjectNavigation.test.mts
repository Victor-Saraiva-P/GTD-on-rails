import assert from "node:assert/strict";
import test, { describe } from "node:test";

import {
  openOwnerProject,
  resolveOwnerProject,
  type OwnerProjectCandidate
} from "../src/features/projects/ownerProjectNavigation.ts";
import type { Project } from "../src/features/projects/types.ts";

function createProject(id: string, title: string): Project {
  return { id, title, deadline: null, doneDate: null, doneTime: null };
}

describe("ownerProjectNavigation", () => {
  const projects: Project[] = [
    createProject("p-1", "Alpha Project"),
    createProject("p-2", "Beta Project")
  ];

  test("returns null when item is null or undefined", () => {
    assert.equal(resolveOwnerProject(null, projects), null);
    assert.equal(resolveOwnerProject(undefined, projects), null);
  });

  test("returns null when item has neither projectId nor projectTitle", () => {
    const item: OwnerProjectCandidate = { projectId: null, projectTitle: null };
    assert.equal(resolveOwnerProject(item, projects), null);
  });

  test("resolves by projectId and uses project title from list", () => {
    const item: OwnerProjectCandidate = { projectId: "p-1", projectTitle: "Old Title" };
    const result = resolveOwnerProject(item, projects);
    assert.deepEqual(result, { projectId: "p-1", projectTitle: "Alpha Project" });
  });

  test("resolves by projectId and falls back to candidate projectTitle or default", () => {
    const itemWithTitle: OwnerProjectCandidate = { projectId: "p-unknown", projectTitle: "Custom Project" };
    assert.deepEqual(resolveOwnerProject(itemWithTitle, projects), {
      projectId: "p-unknown",
      projectTitle: "Custom Project"
    });

    const itemWithoutTitle: OwnerProjectCandidate = { projectId: "p-unknown" };
    assert.deepEqual(resolveOwnerProject(itemWithoutTitle, projects), {
      projectId: "p-unknown",
      projectTitle: "Project"
    });
  });

  test("resolves by projectTitle matching known project case-insensitively", () => {
    const item: OwnerProjectCandidate = { projectTitle: "beta project" };
    const result = resolveOwnerProject(item, projects);
    assert.deepEqual(result, { projectId: "p-2", projectTitle: "Beta Project" });
  });

  test("returns null when projectTitle does not match any project", () => {
    const item: OwnerProjectCandidate = { projectTitle: "Unknown Title" };
    assert.equal(resolveOwnerProject(item, projects), null);
  });

  test("openOwnerProject calls callback when project is resolved", () => {
    let calledWith: { id: string; title?: string | null } | null = null;
    const item: OwnerProjectCandidate = { projectId: "p-1" };

    openOwnerProject(item, (id, title) => {
      calledWith = { id, title };
    }, projects);

    assert.deepEqual(calledWith, { id: "p-1", title: "Alpha Project" });
  });

  test("openOwnerProject does nothing when project cannot be resolved or callback omitted", () => {
    let called = false;
    const callback = () => {
      called = true;
    };

    openOwnerProject(null, callback, projects);
    assert.equal(called, false);

    const unassignedItem: OwnerProjectCandidate = {};
    openOwnerProject(unassignedItem, callback, projects);
    assert.equal(called, false);

    assert.doesNotThrow(() => {
      openOwnerProject({ projectId: "p-1" }, undefined, projects);
    });
  });
});
