import assert from "node:assert/strict";
import test from "node:test";

import { interpretCurrentAvailabilityWithAgent } from "../src/features/next-actions/currentAvailabilityAgent.ts";

test("availability check-in requires the native desktop runtime", async () => {
  await assert.rejects(
    interpretCurrentAvailabilityWithAgent("I am tired and have 30 minutes."),
    /requires the native desktop runtime/
  );
});
