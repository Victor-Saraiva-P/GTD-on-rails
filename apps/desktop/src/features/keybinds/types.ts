export type ScreenId = "inbox" | "contexts";

export type FocusZoneId = "inbox-list" | "stuff-detail" | "context-list" | "context-detail";

export type KeybindDefinition = {
  id: string;
  key: string;
  description: string;
  handler: () => void;
  screen?: ScreenId;
  zone?: FocusZoneId;
  leader?: boolean;
  sequence?: string[];
};
