export type ScreenId = "inbox" | "contexts" | "deleted-inbox" | "stuff-detail";

export type FocusZoneId =
  | "inbox-list"
  | "stuff-detail"
  | "deleted-inbox-list"
  | "deleted-stuff-detail"
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
  ctrl?: boolean;
};
