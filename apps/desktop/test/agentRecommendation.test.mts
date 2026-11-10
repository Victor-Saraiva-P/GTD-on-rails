import assert from "node:assert/strict";
import test from "node:test";
import { applyRecommendation, type RecommendationApproval } from "../src/features/agent-processing/applyRecommendation.ts";
import type { AgentRecommendationOption } from "../src/features/agent-processing/types.ts";
import type { Stuff } from "../src/features/inbox/types.ts";

const stuff: Stuff = {
  id: "example-stuff", title: "Captured thought", status: "INBOX",
  body: { text: "Keep original body", inlineMarks: [], lineBlocks: [], blockEntities: [] },
};

class FakeApprovalGateway {
  bodies: Array<string | null | undefined> = [];
  calls: Array<{ id: string; kind: string; title: string; minutes: number | null; date: string | null }> = [];
  approve: RecommendationApproval = async (id, option, title) => {
    this.bodies.push(option.body);
    this.calls.push({ id, kind: option.kind, title, minutes: option.minutes, date: option.scheduledDate });
  };
}

function proposal(kind: AgentRecommendationOption["kind"]): AgentRecommendationOption {
  return { kind, title: "New title", reason: "Relevant", energy: null, minutes: null, contextIds: [],
    deadline: null, scheduledDate: null, scheduledTime: null };
}

test("sends the approved Next Action and title together in a single request", async () => {
  const gateway = new FakeApprovalGateway();
  await applyRecommendation(stuff, { ...proposal("next-action"), energy: 4.5, minutes: 25 }, "  Email draft  ", gateway.approve);
  assert.deepEqual(gateway.calls, [{ id: stuff.id, kind: "next-action", title: "Email draft", minutes: 25, date: null }]);
});

test("supports Project and Someday / Maybe without additional title mutations", async () => {
  const gateway = new FakeApprovalGateway();
  await applyRecommendation(stuff, proposal("project"), "Move home", gateway.approve);
  await applyRecommendation(stuff, proposal("someday"), "Learn piano", gateway.approve);
  assert.deepEqual(gateway.calls.map(call => call.kind), ["project", "someday"]);
});

test("requires a scheduled date before sending any Calendar approval", async () => {
  const gateway = new FakeApprovalGateway();
  await assert.rejects(applyRecommendation(stuff, proposal("calendar"), "Dentist", gateway.approve), /scheduled date/);
  assert.deepEqual(gateway.calls, []);
  await applyRecommendation(stuff, { ...proposal("calendar"), scheduledDate: "2026-11-03", scheduledTime: "14:00" }, "Dentist", gateway.approve);
  assert.equal(gateway.calls[0].date, "2026-11-03");
});

test("passes the edited body for an atomic approval without inventing one when absent", async () => {
  const gateway = new FakeApprovalGateway();
  await applyRecommendation(stuff, { ...proposal("project"), body: "Polished context and intent." }, "Project outcome", gateway.approve);
  await applyRecommendation(stuff, proposal("project"), "Unchanged note", gateway.approve);
  assert.deepEqual(gateway.bodies, ["Polished context and intent.", undefined]);
});

test("invalid titles and estimates are rejected before persistence", async () => {
  const gateway = new FakeApprovalGateway();
  await assert.rejects(applyRecommendation(stuff, proposal("project"), "   ", gateway.approve), /title/);
  await assert.rejects(applyRecommendation(stuff, { ...proposal("next-action"), minutes: -1 }, "Action", gateway.approve), /Minutes/);
  await assert.rejects(applyRecommendation(stuff, { ...proposal("project"), body: "a".repeat(100_001) }, "Action", gateway.approve), /body exceeds/);
  assert.deepEqual(gateway.calls, []);
});
