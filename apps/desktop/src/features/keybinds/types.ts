export type ScreenId = "inbox" | "contexts" | "stuff-detail";

export type FocusZoneId =
  | "inbox-list"
  | "stuff-detail"
  | "context-list"
  | "context-detail"
  | "context-icon-editor";

export type KeybindDefinition = {
  id: string;
  key: string;
  description: string;
  runKeybind: () => void;
  screen?: ScreenId;
  zone?: FocusZoneId;
  leader?: boolean;
  sequence?: string[];
};
