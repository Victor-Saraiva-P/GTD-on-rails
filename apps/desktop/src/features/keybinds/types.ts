export type ScreenId =
  | "inbox"
  | "contexts"
  | "deleted-inbox"
  | "calendars"
  | "calendar-detail-page"
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
  | "calendar-today-due-panel"
  | "calendar-today-done-panel"
  | "calendar-detail"
  | "calendar-completed-panel"
  | "calendar-deleted-panel"
  | "calendar-mon-panel"
  | "calendar-tue-panel"
  | "calendar-wed-panel"
  | "calendar-thu-panel"
  | "calendar-fri-panel"
  | "calendar-sat-panel"
  | "calendar-sun-panel"
  | "next-actions-list"
  | "next-action-detail"
  | "ongoing-calendars-list"
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
