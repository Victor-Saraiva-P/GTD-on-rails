export type ScreenId =
  | "inbox"
  | "contexts"
  | "deleted-inbox"
  | "next-actions"
  | "ongoing-next-actions"
  | "done-next-actions"
  | "deleted-next-actions"
  | "stuff-detail"
  | "next-action-detail-page"
  | "ongoing-next-action-detail-page";

export type FocusZoneId =
  | "inbox-list"
  | "stuff-detail"
  | "deleted-inbox-list"
  | "deleted-stuff-detail"
  | "next-actions-list"
  | "next-action-detail"
  | "done-next-actions-list"
  | "done-next-action-detail"
  | "deleted-next-actions-list"
  | "deleted-next-action-detail"
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
