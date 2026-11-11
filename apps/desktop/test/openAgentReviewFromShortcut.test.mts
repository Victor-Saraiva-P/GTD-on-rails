import assert from "node:assert/strict";
import test from "node:test";
import { openAgentReviewFromShortcut } from "../src/features/agent-processing/openAgentReviewFromShortcut.ts";

class FakeReviewElement {
  clicks = 0;
  focuses = 0;
  active = false;
  click() { this.clicks++; }
  focus() { this.focuses++; }
  getAttribute(name: string): string | null {
    return name === "data-agent-review-active" && this.active ? "true" : null;
  }
}

class FakeReviewDocument {
  nodes = new Map<string, FakeReviewElement>();
  getElementById(id: string): HTMLElement | null {
    return (this.nodes.get(id) as unknown as HTMLElement) ?? null;
  }
}

test("v clicks the selected pending Review button rather than only focusing it", () => {
  const page = new FakeReviewDocument();
  const first = new FakeReviewElement();
  const second = new FakeReviewElement();
  page.nodes.set("agent-review-trigger-first", first);
  page.nodes.set("agent-review-trigger-second", second);
  assert.equal(openAgentReviewFromShortcut("first", page), true);
  assert.equal(first.clicks, 1);
  assert.equal(first.focuses, 0);
  assert.equal(second.clicks, 0);
});

test("v reopens a recommendation after Decide later without requiring Enter", () => {
  const page = new FakeReviewDocument();
  const trigger = new FakeReviewElement();
  page.nodes.set("agent-review-trigger-first", trigger);
  assert.equal(openAgentReviewFromShortcut("first", page), true);
  assert.equal(openAgentReviewFromShortcut("first", page), true);
  assert.equal(trigger.clicks, 2);
});

test("v focuses an already expanded review and ignores inactive or missing reviews", () => {
  const page = new FakeReviewDocument();
  const expanded = new FakeReviewElement();
  expanded.active = true;
  page.nodes.set("agent-review-root-first", expanded);
  assert.equal(openAgentReviewFromShortcut("first", page), true);
  assert.equal(expanded.focuses, 1);
  assert.equal(openAgentReviewFromShortcut("second", page), false);
  assert.equal(openAgentReviewFromShortcut(undefined, page), false);
  expanded.active = false;
  assert.equal(openAgentReviewFromShortcut("first", page), false);
  assert.equal(expanded.focuses, 1);
});
