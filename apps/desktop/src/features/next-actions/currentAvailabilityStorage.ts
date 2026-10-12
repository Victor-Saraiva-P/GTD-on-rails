export type PersistedCurrentAvailabilityCapacity = {
  currentEnergy: number | null;
  currentTimeMinutes: number | null;
};

const STORAGE_KEY = "gtd.current-availability.v1";

type AvailabilityCapacityStorage = Pick<Storage, "getItem" | "setItem">;

/** Loads machine-local energy and time availability from browser storage.
 *
 * @example const capacity = loadCurrentAvailabilityCapacity(window.localStorage)
 */
export function loadCurrentAvailabilityCapacity(storage: AvailabilityCapacityStorage): PersistedCurrentAvailabilityCapacity {
  const raw = storage.getItem(STORAGE_KEY);
  if (!raw) return emptyCapacity();
  try {
    return normalizeCapacity(JSON.parse(raw) as unknown);
  } catch {
    return emptyCapacity();
  }
}

/** Persists machine-local energy and time availability without synchronizing it.
 *
 * @example saveCurrentAvailabilityCapacity(window.localStorage, { currentEnergy: 6, currentTimeMinutes: 45 })
 */
export function saveCurrentAvailabilityCapacity(
  storage: AvailabilityCapacityStorage,
  capacity: PersistedCurrentAvailabilityCapacity
): void {
  storage.setItem(STORAGE_KEY, JSON.stringify(normalizeCapacity(capacity)));
}

function emptyCapacity(): PersistedCurrentAvailabilityCapacity {
  return { currentEnergy: null, currentTimeMinutes: null };
}

function normalizeCapacity(value: unknown): PersistedCurrentAvailabilityCapacity {
  if (!value || typeof value !== "object") return emptyCapacity();
  const record = value as Record<string, unknown>;
  return {
    currentEnergy: normalizeEnergy(record.currentEnergy),
    currentTimeMinutes: normalizeMinutes(record.currentTimeMinutes)
  };
}

function normalizeEnergy(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 10 ? value : null;
}

function normalizeMinutes(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : null;
}
