import assert from "node:assert/strict";
import test from "node:test";

import {
  applyAutomaticContexts,
  applyCurrentAvailabilityCapacity,
  applyManualAvailability,
  clearCurrentAvailability,
  INITIAL_CURRENT_AVAILABILITY,
  restoreCurrentAvailabilityCapacity,
  resumeAutomaticAvailability
} from "../src/features/next-actions/currentAvailabilityState.ts";
import {
  loadCurrentAvailabilityCapacity,
  saveCurrentAvailabilityCapacity
} from "../src/features/next-actions/currentAvailabilityStorage.ts";
import { fetchAvailabilityEnvironmentSignals } from "../src/features/availability-automation/native.ts";
import { resolveAutomaticContexts } from "../src/features/availability-automation/resolveAutomaticContexts.ts";
import {
  loadAvailabilityAutomationSettings,
  saveAvailabilityAutomationSettings
} from "../src/features/availability-automation/storage.ts";
import type { ContextItem } from "../src/features/contexts/types.ts";
import type { AvailabilityEnvironmentSignals } from "../src/features/availability-automation/types.ts";
import { readAvailabilityEnvironment } from "../src/features/availability-automation/useAvailabilityEnvironment.ts";

class FakeAvailabilityEnvironmentReader {
  private readonly result: AvailabilityEnvironmentSignals | Error;

  constructor(result: AvailabilityEnvironmentSignals | Error) {
    this.result = result;
  }

  async read(): Promise<AvailabilityEnvironmentSignals> {
    if (this.result instanceof Error) throw this.result;
    return this.result;
  }
}

class MemoryStorage {
  private readonly values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}

const home: ContextItem = { id: "home", name: "Home" };
const notebook: ContextItem = { id: "notebook", name: "Notebook" };
const ipad: ContextItem = { id: "ipad", name: "iPad" };
const signals: AvailabilityEnvironmentSignals = {
  device: { label: "nitro", deviceType: "notebook" },
  locations: [{ id: "home-network", label: "Home Wi-Fi", connectionType: "802-11-wireless" }],
  locationError: null
};

test("native availability detection rejects browser runtime instead of inventing cross-platform signals", async () => {
  await assert.rejects(fetchAvailabilityEnvironmentSignals, /expected native Tauri desktop runtime/);
});

test("availability environment reader returns injected signals", async () => {
  const reader = new FakeAvailabilityEnvironmentReader(signals);
  assert.deepEqual(await readAvailabilityEnvironment(() => reader.read()), { signals, error: null });
});

test("availability environment reader clears stale signals when native detection fails", async () => {
  const reader = new FakeAvailabilityEnvironmentReader(new Error("nmcli failed"));
  assert.deepEqual(await readAvailabilityEnvironment(() => reader.read()), { signals: null, error: "nmcli failed" });
});

test("automatic availability resolves device and current location mappings", () => {
  const resolved = resolveAutomaticContexts([home, notebook, ipad], signals, {
    deviceContextId: notebook.id,
    locationContextIds: { "home-network": home.id }
  });

  assert.deepEqual(resolved, [notebook, home]);
});

test("automatic availability deduplicates context mappings and ignores deleted contexts", () => {
  const resolved = resolveAutomaticContexts([home], signals, {
    deviceContextId: home.id,
    locationContextIds: { "home-network": "deleted-context" }
  });

  assert.deepEqual(resolved, [home]);
});

test("manual context mode ignores newly detected contexts until automatic mode resumes", () => {
  const automatic = applyAutomaticContexts(INITIAL_CURRENT_AVAILABILITY, [home, notebook]);
  const manual = applyManualAvailability(automatic, [ipad], 7, 60);
  const refreshed = applyAutomaticContexts(manual, [home]);

  assert.equal(refreshed.contextMode, "manual");
  assert.deepEqual(refreshed.contexts, [ipad]);
  assert.deepEqual(refreshed.automaticContexts, [home]);

  const resumed = resumeAutomaticAvailability(refreshed, [home]);
  assert.equal(resumed.contextMode, "automatic");
  assert.deepEqual(resumed.contexts, [home]);
  assert.equal(resumed.currentEnergy, 7);
  assert.equal(resumed.currentTimeMinutes, 60);
});

test("clearing availability stays manual so automatic detection cannot immediately undo it", () => {
  const automatic = applyAutomaticContexts(INITIAL_CURRENT_AVAILABILITY, [home]);
  const cleared = clearCurrentAvailability(automatic);
  const refreshed = applyAutomaticContexts(cleared, [notebook]);

  assert.equal(refreshed.contextMode, "manual");
  assert.deepEqual(refreshed.contexts, []);
  assert.deepEqual(refreshed.automaticContexts, [notebook]);
});

test("availability automation settings round-trip through machine-local storage", () => {
  const storage = new MemoryStorage();
  saveAvailabilityAutomationSettings(storage, {
    deviceContextId: notebook.id,
    locationContextIds: { "home-network": home.id }
  });

  assert.deepEqual(loadAvailabilityAutomationSettings(storage), {
    deviceContextId: notebook.id,
    locationContextIds: { "home-network": home.id }
  });
});

test("invalid stored availability settings safely fall back to defaults", () => {
  const storage = new MemoryStorage();
  storage.setItem("gtd.availability-automation.v1", "not-json");

  assert.deepEqual(loadAvailabilityAutomationSettings(storage), {
    deviceContextId: null,
    locationContextIds: {}
  });
});

test("agent capacity update preserves automatic contexts and mode", () => {
  const automatic = applyAutomaticContexts(INITIAL_CURRENT_AVAILABILITY, [home, notebook]);
  const updated = applyCurrentAvailabilityCapacity(automatic, 3.5, 40);

  assert.equal(updated.contextMode, "automatic");
  assert.deepEqual(updated.contexts, [home, notebook]);
  assert.equal(updated.currentEnergy, 3.5);
  assert.equal(updated.currentTimeMinutes, 40);
});

test("current energy and time round-trip through machine-local storage", () => {
  const storage = new MemoryStorage();
  saveCurrentAvailabilityCapacity(storage, { currentEnergy: 6.5, currentTimeMinutes: 90 });

  assert.deepEqual(loadCurrentAvailabilityCapacity(storage), {
    currentEnergy: 6.5,
    currentTimeMinutes: 90
  });
});

test("persisted capacity restores without changing automatic context state", () => {
  const restored = restoreCurrentAvailabilityCapacity(INITIAL_CURRENT_AVAILABILITY, {
    currentEnergy: 4,
    currentTimeMinutes: 25
  });

  assert.equal(restored.contextMode, "automatic");
  assert.deepEqual(restored.contexts, []);
  assert.equal(restored.currentEnergy, 4);
  assert.equal(restored.currentTimeMinutes, 25);
});

test("invalid persisted capacity values degrade independently to unset", () => {
  const storage = new MemoryStorage();
  storage.setItem("gtd.current-availability.v1", JSON.stringify({ currentEnergy: 12, currentTimeMinutes: 30 }));

  assert.deepEqual(loadCurrentAvailabilityCapacity(storage), {
    currentEnergy: null,
    currentTimeMinutes: 30
  });
});
