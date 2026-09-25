import { bodyForPersistence } from "./itemBodyUtils.ts";
import type { ItemBody } from "./types.ts";

export type ItemBodyPersistenceState = "saved" | "unsaved" | "saving" | "error";

export type ItemBodyPersistenceQueue = {
  queue: (body: ItemBody) => void;
  flush: (body?: ItemBody) => Promise<void>;
};

type ItemBodyPersistenceOptions = Readonly<{
  persist: (body: ItemBody) => Promise<void>;
  onStateChange?: (state: ItemBodyPersistenceState) => void;
  debounceMs?: number;
}>;

/**
 * Buffers editor snapshots and serializes persistence without putting storage
 * latency on CodeMirror's editing path.
 *
 * @example const queue = createItemBodyPersistenceQueue({ persist: saveBody })
 */
export function createItemBodyPersistenceQueue(
  options: ItemBodyPersistenceOptions
): ItemBodyPersistenceQueue {
  const state = createPersistenceState(options);
  return {
    queue: (body) => queueBodySnapshot(state, body),
    flush: (body) => flushBodySnapshot(state, body)
  };
}

type PersistenceState = {
  options: ItemBodyPersistenceOptions;
  latestBody: ItemBody | null;
  latestVersion: number;
  enqueuedVersion: number;
  timer: ReturnType<typeof setTimeout> | null;
  chain: Promise<void>;
};

function createPersistenceState(options: ItemBodyPersistenceOptions): PersistenceState {
  return {
    options,
    latestBody: null,
    latestVersion: 0,
    enqueuedVersion: 0,
    timer: null,
    chain: Promise.resolve()
  };
}

function queueBodySnapshot(state: PersistenceState, body: ItemBody): void {
  rememberBodySnapshot(state, body);
  clearPersistenceTimer(state);
  const delay = state.options.debounceMs ?? 350;
  state.timer = setTimeout(() => enqueueLatestSnapshot(state), delay);
}

async function flushBodySnapshot(state: PersistenceState, body?: ItemBody): Promise<void> {
  if (body) rememberBodySnapshot(state, body);
  clearPersistenceTimer(state);
  enqueueLatestSnapshot(state);
  await state.chain;
}

function rememberBodySnapshot(state: PersistenceState, body: ItemBody): void {
  state.latestBody = bodyForPersistence(body);
  state.latestVersion += 1;
  state.options.onStateChange?.("unsaved");
}

function clearPersistenceTimer(state: PersistenceState): void {
  if (state.timer === null) return;
  clearTimeout(state.timer);
  state.timer = null;
}

function enqueueLatestSnapshot(state: PersistenceState): void {
  state.timer = null;
  if (!state.latestBody || state.enqueuedVersion === state.latestVersion) return;
  const body = state.latestBody;
  const version = state.latestVersion;
  state.enqueuedVersion = version;
  state.chain = state.chain.catch(() => undefined).then(() => persistSnapshot(state, body, version));
}

async function persistSnapshot(
  state: PersistenceState,
  body: ItemBody,
  version: number
): Promise<void> {
  state.options.onStateChange?.("saving");
  try {
    await state.options.persist(body);
    setSuccessfulPersistenceState(state, version);
  } catch (error) {
    state.options.onStateChange?.("error");
    throw error;
  }
}

function setSuccessfulPersistenceState(state: PersistenceState, version: number): void {
  const current = version === state.latestVersion;
  state.options.onStateChange?.(current ? "saved" : "unsaved");
}
