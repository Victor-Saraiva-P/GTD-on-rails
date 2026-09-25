import {
  beginSharedEntityMutation,
  completeSharedEntityMutation,
  rollbackSharedEntityMutation,
  type SharedEntity
} from "./sharedEntityStore.ts";

/**
 * Publishes an entity change immediately, then reconciles it with persistence.
 *
 * @example await mutateSharedEntityOptimistically(item, { ...item, title }, () => saveTitle(title))
 */
export async function mutateSharedEntityOptimistically<T extends SharedEntity>(
  snapshot: T,
  optimistic: T,
  mutate: () => Promise<T>
): Promise<T> {
  const token = beginSharedEntityMutation(snapshot, optimistic);
  try {
    const persisted = await mutate();
    completeSharedEntityMutation(token, persisted);
    return persisted;
  } catch (error) {
    rollbackSharedEntityMutation(token);
    throw error;
  }
}
