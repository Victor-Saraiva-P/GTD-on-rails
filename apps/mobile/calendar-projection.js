/** Returns the device-local civil date without converting through UTC. Example: localIsoDate(new Date()). */
export function localIsoDate(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** Returns the delay until the next device-local midnight. Example: millisecondsUntilNextLocalDay(new Date()). */
export function millisecondsUntilNextLocalDay(date = new Date()) {
  const nextDay = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1);
  return Math.max(1, nextDay.getTime() - date.getTime());
}

/** Resolves Calendar projections for one local date, reclassifying cached data when needed. Example: calendarEntriesForDate(bootstrap, "2026-10-09"). */
export function calendarEntriesForDate(bootstrap, localDate) {
  if (bootstrap.calendarLocalDate === localDate && Array.isArray(bootstrap.calendarEntries)) {
    return bootstrap.calendarEntries;
  }
  return deriveCalendarEntries(bootstrap, localDate);
}

/** Filters projections for Today or the local Monday-to-Sunday week. Example: filterCalendarEntries(entries, "week", "2026-10-09"). */
export function filterCalendarEntries(entries, range, localDate) {
  if (range === "today") {
    return entries.filter((item) => item.temporalState !== "WEEK");
  }
  const start = mondayForLocalDate(localDate);
  const end = new Date(start);
  end.setDate(end.getDate() + 7);
  return entries.filter((item) => {
    const date = parseLocalDate(item.date);
    return date >= start && date < end;
  });
}

/** Maps Today temporal state to its visible group heading. Example: calendarGroupLabel("OVERDUE"). */
export function calendarGroupLabel(temporalState) {
  if (temporalState === "SCHEDULED_TODAY") return "Scheduled today";
  if (temporalState === "OVERDUE") return "Overdue";
  if (temporalState === "DUE_TODAY") return "Due today";
  return null;
}

/** Orders Calendar projections using Today groups or within-day temporal precedence. Example: entries.sort((a, b) => compareCalendarEntries(a, b, "today")). */
export function compareCalendarEntries(left, right, range) {
  if (range === "today") {
    const group = todayRank(left.temporalState) - todayRank(right.temporalState);
    if (group !== 0) return group;
  }
  const date = left.date.localeCompare(right.date);
  if (date !== 0) return date;
  const rank = withinDateRank(left) - withinDateRank(right);
  if (rank !== 0) return rank;
  const time = (left.scheduledTime || "").localeCompare(right.scheduledTime || "");
  if (time !== 0) return time;
  const created = (left.createdAt || "").localeCompare(right.createdAt || "");
  return created !== 0 ? created : left.id.localeCompare(right.id);
}

function deriveCalendarEntries(bootstrap, localDate) {
  const calendars = (bootstrap.calendar || [])
    .filter((item) => item.status === "CALENDAR")
    .map((item) => calendarEntry(item, localDate));
  const nextActions = (bootstrap.nextActions || [])
    .filter((item) => item.status === "NEXT_ACTION" && item.deadline)
    .map((item) => nextActionEntry(item, localDate));
  return [...calendars, ...nextActions].sort((left, right) => compareCalendarEntries(left, right, "week"));
}

function calendarEntry(item, localDate) {
  const temporalState = classifyCalendarDate(item.scheduledDate, item.scheduledTime, localDate);
  return { ...item, sourceKind: "CALENDAR", temporalState, date: item.scheduledDate, deadline: null, createdAt: null };
}

function nextActionEntry(item, localDate) {
  const temporalState = classifyDeadline(item.deadline, localDate);
  return { ...item, sourceKind: "NEXT_ACTION", temporalState, date: item.deadline, scheduledTime: null };
}

function classifyCalendarDate(date, time, localDate) {
  if (date < localDate) return "OVERDUE";
  if (date > localDate) return "WEEK";
  return time ? "SCHEDULED_TODAY" : "DUE_TODAY";
}

function classifyDeadline(deadline, localDate) {
  if (deadline < localDate) return "OVERDUE";
  return deadline === localDate ? "DUE_TODAY" : "WEEK";
}

function todayRank(state) {
  if (state === "SCHEDULED_TODAY") return 0;
  if (state === "OVERDUE") return 1;
  return 2;
}

function withinDateRank(item) {
  if (item.sourceKind === "NEXT_ACTION") return 2;
  return item.scheduledTime ? 0 : 1;
}

function mondayForLocalDate(value) {
  const date = parseLocalDate(value);
  const day = date.getDay();
  date.setDate(date.getDate() - (day === 0 ? 6 : day - 1));
  return date;
}

function parseLocalDate(value) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}
