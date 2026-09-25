import {
  useCallback,
  useSyncExternalStore,
  type Dispatch,
  type SetStateAction
} from "react";

export type SharedEntity = Readonly<{ id: string }>;

export type SharedCollectionSnapshot<T extends SharedEntity> = Readonly<{
  items: T[];
  loaded: boolean;
  version: number;
}>;

type StoredCollection = {
  ids: string[];
  loaded: boolean;
  version: number;
  snapshot: SharedCollectionSnapshot<any>;
};

export type SharedEntityMutationToken = Readonly<{
  entityId: string;
  sequence: number;
}>;

type PendingMutation = Readonly<{
  overlay: Record<string, unknown>;
  rollback: Record<string, unknown>;
}>;

const entities = new Map<string, SharedEntity>();
const collections = new Map<string, StoredCollection>();
const collectionKeysByEntityId = new Map<string, Set<string>>();
const pendingMutations = new Map<string, Map<number, PendingMutation>>();
const listeners = new Map<string, Set<() => void>>();
let nextMutationSequence = 1;

function emptyCollection(): StoredCollection {
  return {
    ids: [],
    loaded: false,
    version: 0,
    snapshot: { items: [], loaded: false, version: 0 }
  };
}

function collectionFor(key: string): StoredCollection {
  const existing = collections.get(key);
  if (existing) return existing;
  const created = emptyCollection();
  collections.set(key, created);
  return created;
}

function pendingOverlay(entityId: string): Record<string, unknown> {
  const mutations = pendingMutations.get(entityId);
  if (!mutations) return {};
  const overlay: Record<string, unknown> = {};
  for (const mutation of mutations.values()) Object.assign(overlay, mutation.overlay);
  return overlay;
}

function mergedEntity<T extends SharedEntity>(item: T): T {
  const existing = entities.get(item.id);
  const incoming = item as Record<string, unknown>;
  const current = existing as Record<string, unknown> | undefined;
  const preserveLoadedBody = incoming.bodyLoaded === false && current?.bodyLoaded === true;
  const merged = {
    ...(existing ?? {}),
    ...item,
    ...(preserveLoadedBody ? { body: current?.body, bodyLoaded: true } : {}),
    ...pendingOverlay(item.id)
  };
  entities.set(item.id, merged);
  return merged as T;
}

function mutationPatch<T extends SharedEntity>(snapshot: T, optimistic: T): Record<string, unknown> {
  const patch: Record<string, unknown> = {};
  for (const key of Object.keys(optimistic)) {
    if (key === "id") continue;
    const typedKey = key as keyof T;
    if (!Object.is(snapshot[typedKey], optimistic[typedKey])) patch[key] = optimistic[typedKey];
  }
  return patch;
}

function rollbackPatch(entityId: string, overlay: Record<string, unknown>, snapshot: SharedEntity): Record<string, unknown> {
  const current = entities.get(entityId) ?? snapshot;
  const rollback: Record<string, unknown> = {};
  for (const key of Object.keys(overlay)) {
    rollback[key] = (current as Record<string, unknown>)[key];
  }
  return rollback;
}

function rebuildCollection(key: string): void {
  const collection = collectionFor(key);
  const items = collection.ids
    .map((id) => entities.get(id))
    .filter((item): item is SharedEntity => item !== undefined);
  collection.version += 1;
  collection.snapshot = {
    items,
    loaded: collection.loaded,
    version: collection.version
  };
  emitCollection(key);
}

function emitCollection(key: string): void {
  for (const listener of listeners.get(key) ?? []) listener();
}

function updateCollectionMembership(key: string, previousIds: string[], nextIds: string[]): void {
  const previous = new Set(previousIds);
  const next = new Set(nextIds);

  for (const id of previous) {
    if (next.has(id)) continue;
    const keys = collectionKeysByEntityId.get(id);
    keys?.delete(key);
    if (keys?.size === 0) collectionKeysByEntityId.delete(id);
  }

  for (const id of next) {
    if (previous.has(id)) continue;
    const keys = collectionKeysByEntityId.get(id) ?? new Set<string>();
    keys.add(key);
    collectionKeysByEntityId.set(id, keys);
  }
}

function refreshCollectionsContaining(ids: Set<string>, exceptKey?: string): void {
  const keysToRefresh = new Set<string>();
  for (const id of ids) {
    for (const key of collectionKeysByEntityId.get(id) ?? []) {
      if (key !== exceptKey) keysToRefresh.add(key);
    }
  }
  for (const key of keysToRefresh) rebuildCollection(key);
}

export function replaceSharedCollection<T extends SharedEntity>(
  key: string,
  items: T[]
): void {
  const changedIds = new Set<string>();
  const normalizedItems = items.map((item) => {
    changedIds.add(item.id);
    return mergedEntity(item);
  });
  const collection = collectionFor(key);
  const nextIds = normalizedItems.map((item) => item.id);
  updateCollectionMembership(key, collection.ids, nextIds);
  collection.ids = nextIds;
  collection.loaded = true;
  rebuildCollection(key);
  refreshCollectionsContaining(changedIds, key);
}

export function upsertSharedEntity<T extends SharedEntity>(item: T): void {
  mergedEntity(item);
  refreshCollectionsContaining(new Set([item.id]));
}

export function beginSharedEntityMutation<T extends SharedEntity>(
  snapshot: T,
  optimistic: T
): SharedEntityMutationToken {
  const overlay = mutationPatch(snapshot, optimistic);
  const sequence = nextMutationSequence++;
  const mutations = pendingMutations.get(snapshot.id) ?? new Map<number, PendingMutation>();
  mutations.set(sequence, {
    overlay,
    rollback: rollbackPatch(snapshot.id, overlay, snapshot)
  });
  pendingMutations.set(snapshot.id, mutations);
  upsertSharedEntity({ id: snapshot.id, ...overlay });
  return { entityId: snapshot.id, sequence };
}

export function completeSharedEntityMutation<T extends SharedEntity>(
  token: SharedEntityMutationToken,
  persisted: T
): void {
  removePendingMutation(token);
  upsertSharedEntity(persisted);
}

export function rollbackSharedEntityMutation(token: SharedEntityMutationToken): void {
  const mutation = pendingMutations.get(token.entityId)?.get(token.sequence);
  if (!mutation) return;
  removePendingMutation(token);
  upsertSharedEntity({ id: token.entityId, ...mutation.rollback });
}

export function isSharedEntityPending(entityId: string): boolean {
  return (pendingMutations.get(entityId)?.size ?? 0) > 0;
}

function removePendingMutation(token: SharedEntityMutationToken): void {
  const mutations = pendingMutations.get(token.entityId);
  if (!mutations) return;
  mutations.delete(token.sequence);
  if (mutations.size === 0) pendingMutations.delete(token.entityId);
}

export function getSharedEntitySnapshot<T extends SharedEntity>(id: string): T | undefined {
  return entities.get(id) as T | undefined;
}

export function getSharedCollectionSnapshot<T extends SharedEntity>(
  key: string
): SharedCollectionSnapshot<T> {
  return collectionFor(key).snapshot as SharedCollectionSnapshot<T>;
}

export function subscribeSharedCollection(
  key: string,
  listener: () => void
): () => void {
  const keyListeners = listeners.get(key) ?? new Set<() => void>();
  keyListeners.add(listener);
  listeners.set(key, keyListeners);
  return () => {
    keyListeners.delete(listener);
    if (keyListeners.size === 0) listeners.delete(key);
  };
}

export function useSharedCollectionState<T extends SharedEntity>(
  key: string
): SharedCollectionSnapshot<T> & { setItems: Dispatch<SetStateAction<T[]>> } {
  const getSnapshot = () => getSharedCollectionSnapshot<T>(key);
  const snapshot = useSyncExternalStore(
    (listener) => subscribeSharedCollection(key, listener),
    getSnapshot,
    getSnapshot
  );
  const setItems = useCallback<Dispatch<SetStateAction<T[]>>>(
    (action) => replaceSharedCollection(key, resolveCollectionUpdate(key, action)),
    [key]
  );
  return { ...snapshot, setItems };
}

function resolveCollectionUpdate<T extends SharedEntity>(
  key: string,
  action: SetStateAction<T[]>
): T[] {
  const current = getSharedCollectionSnapshot<T>(key).items;
  return typeof action === "function"
    ? (action as (items: T[]) => T[])(current)
    : action;
}

export function resetSharedEntityStore(): void {
  entities.clear();
  collections.clear();
  collectionKeysByEntityId.clear();
  pendingMutations.clear();
  listeners.clear();
  nextMutationSequence = 1;
}
