import assert from "node:assert/strict";
import test, { after } from "node:test";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
const server = await createServer({
  configFile: false,
  logLevel: "silent",
  root: fileURLToPath(new URL("../", import.meta.url)),
  server: { middlewareMode: true, hmr: false }
});
after(() => server.close());
const { AgentReviewBodyDiff, AgentReviewTitleDiff } = await server.ssrLoadModule(
  "/src/features/agent-processing/AgentRecommendationDiff.tsx"
);
import { selectedReviewOption, updateActiveAgentReview } from "../src/features/agent-processing/reviewPreviewSelection.ts";
import type { AgentRecommendationOption } from "../src/features/agent-processing/types.ts";
import type { Stuff } from "../src/features/inbox/types.ts";

const option: AgentRecommendationOption = {
  kind: "project", title: "Fix the poster", body: "Check whether tape is enough",
  reason: "Requires planning", energy: null, minutes: null, contextIds: [],
  deadline: null, scheduledDate: null, scheduledTime: null
};
const stuff: Stuff = {
  id: "poster", title: "need tape for poster", status: "INBOX", bodyLoaded: true,
  body: { text: "will tape work", inlineMarks: [], lineBlocks: [], blockEntities: [] }
};

test("a review preview is cleared by its own Stuff but not by another row", () => {
  const preview = updateActiveAgentReview(null, stuff.id, option);
  assert.equal(selectedReviewOption(preview, "other"), null);
  assert.equal(selectedReviewOption(preview, stuff.id), option);
  assert.equal(updateActiveAgentReview(preview, "other", null), preview);
  assert.equal(updateActiveAgentReview(preview, stuff.id, null), null);
});

test("the right-hand title preview marks original and proposed text", () => {
  const html = renderToStaticMarkup(createElement(AgentReviewTitleDiff, { original: stuff.title, proposed: option.title }));
  assert.match(html, /role="heading"/);
  assert.match(html, /agent-detail-diff__line--remove/);
  assert.match(html, /agent-detail-diff__line--add/);
  assert.match(html, /need tape for poster/);
  assert.match(html, /Fix the poster/);
});

test("the right-hand body preview highlights replacements and preserves unchanged lines", () => {
  const html = renderToStaticMarkup(createElement(AgentReviewBodyDiff, { item: stuff, proposed: option.body! }));
  assert.match(html, /aria-label="Body preview"/);
  assert.match(html, /agent-detail-diff__line--remove/);
  assert.match(html, /agent-detail-diff__line--add/);
  assert.match(html, /will tape work/);
  assert.match(html, /Check whether tape is enough/);
});

test("equal title text has no colored diff", () => {
  const html = renderToStaticMarkup(createElement(AgentReviewTitleDiff, { original: stuff.title, proposed: stuff.title }));
  assert.doesNotMatch(html, /agent-detail-diff__line--remove/);
  assert.match(html, /need tape for poster/);
});
