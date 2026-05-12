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

export const contextsListTheme: ListTheme = {
  id: "contexts",
  label: "Contexts",
  accentColor: "#97353d",
  accentColorRgb: "151, 53, 61"
};
