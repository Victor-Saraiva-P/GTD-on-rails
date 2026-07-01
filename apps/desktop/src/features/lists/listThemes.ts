export type ListTheme = {
  id: string;
  label: string;
  accentColor: string;
  accentColorRgb: string;
};

export const inboxListTheme: ListTheme = {
  id: "inbox",
  label: "Inbox",
  accentColor: "#CC782F",
  accentColorRgb: "204, 120, 47"
};

export const stuffDetailListTheme: ListTheme = {
  id: "stuff-detail",
  label: "Stuff Detail",
  accentColor: "#CC782F",
  accentColorRgb: "204, 120, 47"
};

export const deletedInboxListTheme: ListTheme = {
  id: "deleted-inbox",
  label: "Deleted Stuff",
  accentColor: "#9B9B9B",
  accentColorRgb: "155, 155, 155"
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
  accentColor: "#2D8C8A",
  accentColorRgb: "45, 140, 138"
};

export const projectsListTheme: ListTheme = {
  id: "projects",
  label: "Projects",
  accentColor: "#9B5AB7",
  accentColorRgb: "155, 90, 183"
};

export const onGoingNextActionDetailListTheme: ListTheme = {
  id: "ongoing-next-action-detail-page",
  label: "On Going Action Detail",
  accentColor: onGoingNextActionsListTheme.accentColor,
  accentColorRgb: onGoingNextActionsListTheme.accentColorRgb
};

export const onGoingCalendarDetailListTheme: ListTheme = {
  id: "ongoing-calendar-detail-page",
  label: "On Going Calendar Detail",
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
  accentColor: "#7F8D3F",
  accentColorRgb: "127, 141, 63"
};

export const doneProjectsListTheme: ListTheme = {
  id: "done-projects",
  label: "Completed Projects",
  accentColor: doneNextActionsListTheme.accentColor,
  accentColorRgb: doneNextActionsListTheme.accentColorRgb
};

export const deletedNextActionsListTheme: ListTheme = {
  id: "deleted-next-actions",
  label: "Deleted Next Actions",
  accentColor: "#9B9B9B",
  accentColorRgb: "155, 155, 155"
};

export const calendarsListTheme: ListTheme = {
  id: "calendars",
  label: "Calendars",
  accentColor: "#c85a53",
  accentColorRgb: "200, 90, 83"
};

export const doneCalendarsListTheme: ListTheme = {
  id: "done-calendars",
  label: "Completed Calendars",
  accentColor: doneNextActionsListTheme.accentColor,
  accentColorRgb: doneNextActionsListTheme.accentColorRgb
};

export const deletedCalendarsListTheme: ListTheme = {
  id: "deleted-calendars",
  label: "Deleted Calendars",
  accentColor: deletedInboxListTheme.accentColor,
  accentColorRgb: deletedInboxListTheme.accentColorRgb
};

export const calendarItemIconText = "C";

export const contextsListTheme: ListTheme = {
  id: "contexts",
  label: "Contexts",
  accentColor: "#97353d",
  accentColorRgb: "151, 53, 61"
};

export const googleCalendarIntegrationTheme: ListTheme = {
  id: "google-calendar-integration",
  label: "Google Calendar Integration",
  accentColor: "#4285F4",
  accentColorRgb: "66, 133, 244"
};
