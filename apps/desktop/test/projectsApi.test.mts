import assert from "node:assert/strict";
import test, { afterEach, describe, mock } from "node:test";

import { fetchProjects, patchProject, processStuffToProject } from "../src/features/projects/api.ts";
import type { Stuff } from "../src/features/inbox/types.ts";

describe("projects API", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  test("fetchProjects loads project cards", async () => {
    globalThis.fetch = mock.fn(async (input) => {
      assert.ok(input.toString().endsWith("/projects"));
      return new Response(JSON.stringify([{ id: "project-1", title: "Launch", deadline: "2028-02-29" }]), { status: 200 });
    });

    const projects = await fetchProjects();

    assert.deepEqual(projects, [{ id: "project-1", title: "Launch", deadline: "2028-02-29" }]);
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
      return new Response(JSON.stringify({ id: "project-1", title: "New title", deadline: null }), { status: 200 });
    });

    const project = await patchProject("project-1", patch);

    assert.equal(project.title, "New title");
    assert.equal(project.deadline, null);
  });
});

function stuff(id: string): Stuff {
  return { id, title: "Stuff", body: { text: "", inlineMarks: [], lineBlocks: [], blockEntities: [] }, status: "STUFF", createdAt: "2026-01-01T00:00:00Z" };
}
