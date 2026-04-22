export type ListTheme = {
  id: string;
  label: string;
  iconSrc: string;
  accentColor: string;
  accentColorRgb: string;
};

export const inboxListTheme: ListTheme = {
  id: "inbox",
  label: "Inbox",
  iconSrc: "/inbox/inbox icon.png",
  accentColor: "#c85a53",
  accentColorRgb: "200, 90, 83"
};

export const stuffDetailListTheme: ListTheme = {
  id: "stuff-detail",
  label: "Stuff Detail",
  iconSrc: "/inbox/stuff icon.png",
  accentColor: "#c85a53",
  accentColorRgb: "200, 90, 83"
};
