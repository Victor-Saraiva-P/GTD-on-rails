import assert from "node:assert/strict";
import test, { describe } from "node:test";

import {
  filterActiveProjects,
  initialProjectIndex,
  nextFocusedProjectIndex,
  resolveProjectAssociateSelection,
  resolveProjectItemClass
} from "../src/features/projects/projectAssociateLogic.ts";
import type { Project } from "../src/features/projects/types.ts";

function createProject(id: string, title: string): Project {
  return { id, title, deadline: null, doneDate: null, doneTime: null };
}

describe("project associate logic", () => {
  const projects = [
    createProject("p1", "Alpha Project"),
    createProject("p2", "Beta Project"),
    createProject("p3", "Gamma Plan")
  ];

  test("filterActiveProjects filters case-insensitively", () => {
    assert.equal(filterActiveProjects(projects, "").length, 3);
    assert.equal(filterActiveProjects(projects, "   ").length, 3);
    assert.deepEqual(
      filterActiveProjects(projects, "alpha").map((p) => p.id),
      ["p1"]
    );
    assert.deepEqual(
      filterActiveProjects(projects, "PROJECT").map((p) => p.id),
      ["p1", "p2"]
    );
    assert.deepEqual(filterActiveProjects(projects, "nonexistent"), []);
  });

  test("initialProjectIndex targets matching project or 0", () => {
    assert.equal(initialProjectIndex(projects, "Beta Project"), 1);
    assert.equal(initialProjectIndex(projects, "Unknown"), 0);
    assert.equal(initialProjectIndex(projects, null), 0);
    assert.equal(initialProjectIndex(projects, undefined), 0);
  });

  test("nextFocusedProjectIndex clamps within bounds", () => {
    assert.equal(nextFocusedProjectIndex(0, 1, 3), 1);
    assert.equal(nextFocusedProjectIndex(2, 1, 3), 2);
    assert.equal(nextFocusedProjectIndex(0, -1, 3), 0);
    assert.equal(nextFocusedProjectIndex(0, 1, 0), 0);
  });

  test("resolveProjectAssociateSelection resolves targeted project id", () => {
    const outcome = resolveProjectAssociateSelection(0, projects, false);
    assert.deepEqual(outcome, { selected: true, projectId: "p1" });
  });

  test("resolveProjectAssociateSelection unassigns when remove option is focused", () => {
    const outcome = resolveProjectAssociateSelection(3, projects, true);
    assert.deepEqual(outcome, { selected: true, projectId: null });
  });

  test("resolveProjectAssociateSelection returns selected false when out of bounds", () => {
    const outcome = resolveProjectAssociateSelection(5, projects, false);
    assert.deepEqual(outcome, { selected: false });
  });

  test("resolveProjectItemClass adds focus and checked modifier classes", () => {
    assert.equal(resolveProjectItemClass(false, false), "processing-dialog__list-item");
    assert.equal(resolveProjectItemClass(true, false), "processing-dialog__list-item processing-dialog__list-item--focused");
    assert.equal(resolveProjectItemClass(false, true), "processing-dialog__list-item processing-dialog__list-item--checked");
    assert.equal(resolveProjectItemClass(true, true), "processing-dialog__list-item processing-dialog__list-item--focused processing-dialog__list-item--checked");
  });
});
