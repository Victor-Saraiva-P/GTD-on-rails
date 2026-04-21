export type ScreenId = "inbox";

export type FocusZoneId = "inbox-list" | "stuff-detail";

export type KeybindDefinition = {
  id: string;
  key: string;
  description: string;
  handler: () => void;
  screen?: ScreenId;
  zone?: FocusZoneId;
  leader?: boolean;
};
