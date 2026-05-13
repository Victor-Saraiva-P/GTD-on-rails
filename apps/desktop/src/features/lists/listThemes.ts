export type ListTheme = {
  id: string;
  label: string;
  accentColor: string;
  accentColorRgb: string;
};

export const inboxListTheme: ListTheme = {
  id: "inbox",
  label: "Inbox",
  accentColor: "#c85a53",
  accentColorRgb: "200, 90, 83"
};

export const stuffDetailListTheme: ListTheme = {
  id: "stuff-detail",
  label: "Stuff Detail",
  accentColor: "#c85a53",
  accentColorRgb: "200, 90, 83"
};

export const deletedInboxListTheme: ListTheme = {
  id: "deleted-inbox",
  label: "Deleted Stuff",
  accentColor: "#b84b45",
  accentColorRgb: "184, 75, 69"
};

export const nextActionsListTheme: ListTheme = {
  id: "next-actions",
  label: "Next Actions",
  accentColor: "#4F9768",
  accentColorRgb: "79, 151, 104"
};

export const onGoingNextActionsListTheme: ListTheme = {
  id: "ongoing-next-actions",
  label: "On Going Actions",
  accentColor: "#9B5AB7",
  accentColorRgb: "155, 90, 183"
};

export const onGoingNextActionDetailListTheme: ListTheme = {
  id: "ongoing-next-action-detail-page",
  label: "On Going Action Detail",
  accentColor: onGoingNextActionsListTheme.accentColor,
  accentColorRgb: onGoingNextActionsListTheme.accentColorRgb
};

export const nextActionDetailListTheme: ListTheme = {
  id: "next-action-detail-page",
  label: "Next Action Detail",
  accentColor: nextActionsListTheme.accentColor,
  accentColorRgb: nextActionsListTheme.accentColorRgb
};

export const doneNextActionsListTheme: ListTheme = {
  id: "done-next-actions",
  label: "Completed Next Actions",
  accentColor: nextActionsListTheme.accentColor,
  accentColorRgb: nextActionsListTheme.accentColorRgb
};

export const deletedNextActionsListTheme: ListTheme = {
  id: "deleted-next-actions",
  label: "Deleted Next Actions",
  accentColor: nextActionsListTheme.accentColor,
  accentColorRgb: nextActionsListTheme.accentColorRgb
};

export const contextsListTheme: ListTheme = {
  id: "contexts",
  label: "Contexts",
  accentColor: "#97353d",
  accentColorRgb: "151, 53, 61"
};
