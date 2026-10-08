export type AvailabilityContextMode = "automatic" | "manual";

export type AvailabilityDeviceSignal = {
  label: string;
  deviceType: string;
};

export type AvailabilityLocationSignal = {
  id: string;
  label: string;
  connectionType: string;
};

export type AvailabilityEnvironmentSignals = {
  device: AvailabilityDeviceSignal;
  locations: AvailabilityLocationSignal[];
  locationError: string | null;
};

export type AvailabilityAutomationSettings = {
  deviceContextId: string | null;
  locationContextIds: Record<string, string>;
};

export const EMPTY_AVAILABILITY_AUTOMATION_SETTINGS: AvailabilityAutomationSettings = {
  deviceContextId: null,
  locationContextIds: {}
};
