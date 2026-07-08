import assert from "node:assert/strict";
import test, { afterEach, describe, mock } from "node:test";

import { deleteProject, fetchDeletedProjects, fetchDoneProjects, fetchProjects, markProjectDone, patchProject, processStuffToProject, recoverProject, resetProjectStatus } from "../src/features/projects/api.ts";
import { createProjectStuff, fetchProjectActions } from "../src/features/projects/projectItems.ts";
import type { Stuff } from "../src/features/inbox/types.ts";

describe("projects API", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  test("fetchProjects loads project cards", async () => {
    globalThis.fetch = mock.fn(async (input) => {
      assert.ok(input.toString().endsWith("/projects"));
      return new Response(JSON.stringify([{ id: "project-1", title: "Launch", deadline: "2028-02-29", doneDate: null, doneTime: null }]), { status: 200 });
    });

    const projects = await fetchProjects();

    assert.deepEqual(projects, [{ id: "project-1", title: "Launch", deadline: "2028-02-29", doneDate: null, doneTime: null }]);
  });

  test("fetchDoneProjects loads completed project cards", async () => {
    globalThis.fetch = mock.fn(async (input) => {
      assert.ok(input.toString().endsWith("/projects/done"));
      return new Response(JSON.stringify([{ id: "project-1", title: "Launch", deadline: null, doneDate: "2028-02-29", doneTime: "10:15:00" }]), { status: 200 });
    });

    const projects = await fetchDoneProjects();

    assert.deepEqual(projects, [{ id: "project-1", title: "Launch", deadline: null, doneDate: "2028-02-29", doneTime: "10:15:00" }]);
  });

  test("fetchDeletedProjects loads deleted project cards", async () => {
    globalThis.fetch = mock.fn(async (input) => {
      assert.ok(input.toString().endsWith("/projects/deleted"));
      return new Response(JSON.stringify([{ id: "project-1", title: "Launch", deadline: null, doneDate: null, doneTime: null }]), { status: 200 });
    });

    const projects = await fetchDeletedProjects();

    assert.deepEqual(projects, [{ id: "project-1", title: "Launch", deadline: null, doneDate: null, doneTime: null }]);
  });

  test("processStuffToProject posts optional deadline", async () => {
    globalThis.fetch = mock.fn(async (input, init) => {
      assert.ok(input.toString().endsWith("/inbox/stuff-1/project"));
      assert.equal(init?.method, "POST");
      assert.equal(init?.body, JSON.stringify({ deadline: null }));
      return new Response(null, { status: 204 });
    });

    await processStuffToProject(stuff("stuff-1"), null);
  });

  test("patchProject sends title and deadline patch", async () => {
    const patch = { title: "New title", clearDeadline: true };
    globalThis.fetch = mock.fn(async (input, init) => {
      assert.ok(input.toString().endsWith("/projects/project-1"));
      assert.equal(init?.method, "PATCH");
      assert.equal(init?.body, JSON.stringify(patch));
      return new Response(JSON.stringify({ id: "project-1", title: "New title", deadline: null, doneDate: null, doneTime: null }), { status: 200 });
    });

    const project = await patchProject("project-1", patch);

    assert.equal(project.title, "New title");
    assert.equal(project.deadline, null);
  });

  test("markProjectDone posts status move", async () => {
    globalThis.fetch = mock.fn(async (input, init) => {
      assert.ok(input.toString().endsWith("/projects/project-1/done"));
      assert.equal(init?.method, "POST");
      return new Response(JSON.stringify({ id: "project-1", title: "Done", deadline: null, doneDate: "2028-02-29", doneTime: "10:15:00" }), { status: 200 });
    });

    const project = await markProjectDone("project-1");

    assert.equal(project.doneDate, "2028-02-29");
  });

  test("resetProjectStatus posts active restore", async () => {
    globalThis.fetch = mock.fn(async (input, init) => {
      assert.ok(input.toString().endsWith("/projects/project-1/reset-status"));
      assert.equal(init?.method, "POST");
      return new Response(JSON.stringify({ id: "project-1", title: "Active", deadline: null, doneDate: null, doneTime: null }), { status: 200 });
    });

    const project = await resetProjectStatus("project-1");

    assert.equal(project.doneDate, null);
  });

  test("deleteProject sends project delete request", async () => {
    globalThis.fetch = mock.fn(async (input, init) => {
      assert.ok(input.toString().endsWith("/projects/project-1"));
      assert.equal(init?.method, "DELETE");
      return new Response(null, { status: 204 });
    });

    await deleteProject("project-1");
  });

  test("recoverProject posts project recover request", async () => {
    globalThis.fetch = mock.fn(async (input, init) => {
      assert.ok(input.toString().endsWith("/projects/project-1/recover"));
      assert.equal(init?.method, "POST");
      return new Response(JSON.stringify({ id: "project-1", title: "Recovered", deadline: null, doneDate: null, doneTime: null }), { status: 200 });
    });

    const project = await recoverProject("project-1");

    assert.equal(project.title, "Recovered");
  });

  test("fetchProjectActions loads mixed project items", async () => {
    globalThis.fetch = mock.fn(async (input) => {
      assert.ok(input.toString().endsWith("/projects/project-1/items/actions"));
      return new Response(JSON.stringify([{ id: "item-1", projectId: "project-1", kind: "STUFF", title: "Buy paste", body: null, status: "STUFF", createdAt: "2026-01-01T00:00:00Z" }]), { status: 200 });
    });

    const items = await fetchProjectActions("project-1");

    assert.equal(items[0].kind, "STUFF");
    assert.equal(items[0].body.text, "");
  });

  test("createProjectStuff posts project-scoped stuff", async () => {
    globalThis.fetch = mock.fn(async (input, init) => {
      assert.ok(input.toString().endsWith("/projects/project-1/items/stuff"));
      assert.equal(init?.method, "POST");
      assert.equal(init?.body, JSON.stringify({ title: "Buy paste" }));
      return new Response(JSON.stringify({ id: "item-1", projectId: "project-1", kind: "STUFF", title: "Buy paste", body: null, status: "STUFF", createdAt: "2026-01-01T00:00:00Z" }), { status: 201 });
    });

    const item = await createProjectStuff("project-1", "Buy paste");

    assert.equal(item.projectId, "project-1");
    assert.equal(item.title, "Buy paste");
  });
});

function stuff(id: string): Stuff {
  return { id, title: "Stuff", body: { text: "", inlineMarks: [], lineBlocks: [], blockEntities: [] }, status: "STUFF", createdAt: "2026-01-01T00:00:00Z" };
}
