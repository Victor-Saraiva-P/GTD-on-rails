export interface OptimisticMutationOptions<TState, TResult> {
  current: () => TState;
  applyOptimistic: (current: TState) => TState;
  set: (next: TState) => void;
  mutate: () => Promise<TResult>;
  onSuccess?: (result: TResult) => void;
  onError?: (error: unknown, rollbackState: TState) => void;
}

/**
 * Optimistically updates client state before running an async mutation,
 * rolling back to the snapshot if the mutation rejects.
 *
 * @example await optimisticMutate({ current: () => items, applyOptimistic: (s) => s.filter(x => x.id !== id), set: setItems, mutate: () => deleteItem(id) })
 */
export async function optimisticMutate<TState, TResult>(
  options: OptimisticMutationOptions<TState, TResult>
): Promise<TResult> {
  const snapshot = options.current();
  const optimisticState = options.applyOptimistic(snapshot);
  options.set(optimisticState);

  try {
    const result = await options.mutate();
    options.onSuccess?.(result);
    return result;
  } catch (error) {
    options.set(snapshot);
    options.onError?.(error, snapshot);
    throw error;
  }
}
