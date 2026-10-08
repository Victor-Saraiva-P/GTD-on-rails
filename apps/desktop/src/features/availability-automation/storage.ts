import { EMPTY_AVAILABILITY_AUTOMATION_SETTINGS, type AvailabilityAutomationSettings } from "./types.ts";

const STORAGE_KEY = "gtd.availability-automation.v1";
export const AVAILABILITY_AUTOMATION_SETTINGS_CHANGED = "gtd:availability-automation-settings-changed";

type AvailabilityStorage = Pick<Storage, "getItem" | "setItem">;

/** Loads machine-local automatic availability mappings from browser storage.
 *
 * @example const settings = loadAvailabilityAutomationSettings(window.localStorage)
 */
export function loadAvailabilityAutomationSettings(storage: AvailabilityStorage): AvailabilityAutomationSettings {
  const raw = storage.getItem(STORAGE_KEY);
  if (!raw) return structuredClone(EMPTY_AVAILABILITY_AUTOMATION_SETTINGS);
  try {
    return normalizeSettings(JSON.parse(raw) as unknown);
  } catch {
    return structuredClone(EMPTY_AVAILABILITY_AUTOMATION_SETTINGS);
  }
}

/** Saves machine-local automatic availability mappings and notifies same-window consumers.
 *
 * @example saveAvailabilityAutomationSettings(window.localStorage, settings)
 */
export function saveAvailabilityAutomationSettings(storage: AvailabilityStorage, settings: AvailabilityAutomationSettings): void {
  const normalized = normalizeSettings(settings);
  storage.setItem(STORAGE_KEY, JSON.stringify(normalized));
  if (typeof window !== "undefined") window.dispatchEvent(new Event(AVAILABILITY_AUTOMATION_SETTINGS_CHANGED));
}

function normalizeSettings(value: unknown): AvailabilityAutomationSettings {
  if (!value || typeof value !== "object") return structuredClone(EMPTY_AVAILABILITY_AUTOMATION_SETTINGS);
  const record = value as Record<string, unknown>;
  return {
    deviceContextId: typeof record.deviceContextId === "string" && record.deviceContextId ? record.deviceContextId : null,
    locationContextIds: normalizeLocationContextIds(record.locationContextIds)
  };
}

function normalizeLocationContextIds(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter((entry): entry is [string, string] => Boolean(entry[0]) && typeof entry[1] === "string" && Boolean(entry[1]))
  );
}
