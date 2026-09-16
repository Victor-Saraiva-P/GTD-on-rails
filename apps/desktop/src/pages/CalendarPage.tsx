import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { ListView } from "../components/ListView";
import { ListWorkspace } from "../components/ListWorkspace";
import { RetryState } from "../components/RetryState";
import { CalendarDetails } from "../features/calendar/CalendarDetails";
import { CalendarList } from "../features/calendar/CalendarList";
import { CalendarScheduleEditDialog } from "../features/calendar/CalendarScheduleEditDialog";
import type { CalendarPanel } from "../features/calendar/calendarWorkspaceState";
import type { CalendarWorkspaceController } from "../features/calendar/useCalendarWorkspaceController";
import { prefetchNearbyInboxAssets } from "../features/inbox/inboxAssetPrefetch";
import type { ItemBody } from "../features/inbox/types";
import { LeaderMenu } from "../features/keybinds/LeaderMenu";
import { useActiveScreen, useKeybindScreen, useRegisterKeybinds } from "../features/keybinds/hooks";
import { calendarsListTheme, deletedCalendarsListTheme, doneCalendarsListTheme, type ListTheme } from "../features/lists/listThemes";
import { getMondayForOffset } from "../features/calendar/calendarDateUtils";
import { activePanelZone, buildCalendarKeybinds } from "../features/calendar/calendarKeybinds";
import { ProjectAssociateDialog } from "../features/projects/ProjectAssociateDialog";
import { useProjectAssociateDialog } from "../features/projects/useProjectAssociateDialog";
import type { Project } from "../features/projects/types";
import { useListTitleSearch } from "../features/title-search/useListTitleSearch";

type CalendarPageProps = Readonly<{
  controller: CalendarWorkspaceController;
  selectOnGoingCalendar: (id: string) => void;
  openOwnerProject?: (projectId: string, projectTitle?: string | null) => void;
  projects?: Project[];
}>;

type CalendarControllerProps = Readonly<{
  controller: CalendarWorkspaceController;
}>;

const LazyMarkdownAssetComboDialog = lazy(async () => {
  const module = await import("../features/inbox/MarkdownAssetComboDialog");
  return { default: module.MarkdownAssetComboDialog };
});

const LazyMarkdownLinkComboDialog = lazy(async () => {
  const module = await import("../features/inbox/MarkdownLinkComboDialog");
  return { default: module.MarkdownLinkComboDialog };
});

function useCalendarBindings(
  controller: CalendarWorkspaceController,
  openLink: () => void,
  openAsset: () => void,
  openScheduleEdit: () => void,
  selectOnGoingCalendar: (id: string) => void,
  openProjectAssociate: () => void,
  openOwnerProject?: (projectId: string, projectTitle?: string | null) => void,
  projects: Project[] = []
): void {
  const { setActiveScreen } = useActiveScreen();
  const bindings = useMemo(
    () =>
      buildCalendarKeybinds(
        controller,
        setActiveScreen,
        openScheduleEdit,
        selectOnGoingCalendar,
        openLink,
        openAsset,
        openProjectAssociate,
        openOwnerProject,
        projects
      ),
    [controller, setActiveScreen, openScheduleEdit, selectOnGoingCalendar, openLink, openAsset, openProjectAssociate, openOwnerProject, projects]
  );
  useRegisterKeybinds(bindings);
}

function useCalendarZone(controller: CalendarWorkspaceController): void {
  useEffect(() => {
    let valid = ["calendar-today-due-panel", "calendar-today-done-panel", "calendar-detail"];
    if (controller.activeSubview === "completed") valid = ["calendar-completed-panel", "calendar-detail"];
    if (controller.activeSubview === "deleted") valid = ["calendar-deleted-panel", "calendar-detail"];
    if (controller.activeSubview === "weekly") valid = ["calendar-mon-panel", "calendar-tue-panel", "calendar-wed-panel", "calendar-thu-panel", "calendar-fri-panel", "calendar-sat-panel", "calendar-sun-panel"];
    
    if (!valid.includes(controller.activeZone)) controller.setActiveZone(valid[0] as any);
  }, [controller.activeZone, controller.activeSubview, controller.setActiveZone]);
}

function useCalendarAssetPreload(controller: CalendarWorkspaceController): void {
  useEffect(() => {
    if (controller.selectedIndex < 0) return;
    prefetchNearbyInboxAssets(controller.stuffs, controller.selectedIndex);
  }, [controller.selectedIndex, controller.stuffs]);
}

function calendarWorkspaceTheme(activeSubview: CalendarWorkspaceController["activeSubview"]): ListTheme {
  if (activeSubview === "completed") return doneCalendarsListTheme;
  if (activeSubview === "deleted") return deletedCalendarsListTheme;
  return calendarsListTheme;
}

function commitCalendarTitle(controller: CalendarWorkspaceController): void {
  void controller.commitTitle().catch((error: unknown) => console.error("Failed to update calendar title", error));
}

function CalendarPanelBody(props: CalendarControllerProps & Readonly<{ panel: CalendarPanel }>) {
  if (props.controller.isLoading) return <p className="pane-state">Loading calendars...</p>;
  if (props.controller.errorMessage) return <RetryState message={props.controller.errorMessage} onRetry={props.controller.reload} />;
  
  let items = props.controller.dueCalendars;
  if (props.panel === "done-today") items = props.controller.doneTodayCalendars;
  if (props.panel === "completed") items = props.controller.completedCalendars;
  if (props.panel === "deleted") items = props.controller.deletedCalendars;
  if (["mon", "tue", "wed", "thu", "fri", "sat", "sun"].includes(props.panel)) {
    const index = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"].indexOf(props.panel);
    items = props.controller.weeklyCalendars.filter(c => new Date(c.scheduledDate + "T00:00:00").getDay() === index);
  }

  if (items.length === 0) return <p className="pane-state">{emptyPanelMessage(props.panel)}</p>;
  return <CalendarPanelReady controller={props.controller} items={items} panel={props.panel} />;
}

function emptyPanelMessage(panel: CalendarPanel): string {
  if (panel === "done-today") return "No calendars completed today.";
  if (panel === "completed") return "No completed calendars.";
  if (panel === "deleted") return "No deleted calendars.";
  if (["mon", "tue", "wed", "thu", "fri", "sat", "sun"].includes(panel)) return "";
  return "No due or late calendars.";
}

function CalendarPanelReady({ controller, items, panel }: CalendarControllerProps & Readonly<{ items: CalendarWorkspaceController["stuffs"], panel: CalendarPanel }>) {
  return (
    <CalendarList
      items={items}
      archiveStatus={panel === "deleted" ? "deleted" : undefined}
      editingTitleError={controller.editingTitleError}
      selectedId={controller.selectedItem?.id ?? ""}
      editingId={controller.editingId}
      editingTitle={controller.editingTitle}
      onSelect={controller.setSelectedId}
      onEditingTitleChange={controller.setEditingTitle}
      onStartEditing={controller.startTitleEdit}
      onCommitEditing={() => commitCalendarTitle(controller)}
      onCommitEditingAndContinue={() => commitCalendarTitle(controller)}
      onCancelEditing={controller.cancelTitleEdit}
    />
  );
}

function CalendarDetailBody({ controller }: CalendarControllerProps) {
  if (controller.isLoading) return <p className="pane-state">Loading calendar details...</p>;
  if (controller.errorMessage) return <p className="pane-state">Calendar details are unavailable while loading fails.</p>;
  if (!controller.selectedItem) return <p className="pane-state">Select a calendar to inspect its details.</p>;
  return <CalendarDetailReady controller={controller} />;
}

function CalendarDetailReady({ controller }: CalendarControllerProps) {
  const item = controller.selectedItem;
  if (!item) return null;
  return (
    <CalendarDetails
      item={item}
      editing={controller.editingBodyId === item.id}
      onAutosaveEditing={(body) => controller.autosaveBody(body)}
      onCommitEditing={(body) => controller.commitBody(body)}
      onExitEditingFromNormalMode={(body) => exitCalendarBodyEditing(controller, body)}
      onCancelEditing={controller.cancelBodyEdit}
      onVimModeChange={controller.setVimMode}
    />
  );
}

async function exitCalendarBodyEditing(controller: CalendarWorkspaceController, body: ItemBody): Promise<void> {
  await controller.commitBody(body);
  controller.setActiveZone(activePanelZone(controller.activePanel));
}

function DueCalendarPanel({ controller }: CalendarControllerProps) {
  const meta = `${controller.dueCalendars.length} ${controller.dueCalendars.length === 1 ? "item" : "items"}`;
  return (
    <ListView title="Calendar" meta={meta} panelIndex={1} active={controller.activeZone === "calendar-today-due-panel"} bodyClassName="list-pane__body--flush" className="inbox-pane inbox-pane--list">
      <CalendarPanelBody controller={controller} panel="due" />
    </ListView>
  );
}

function DoneTodayCalendarPanel({ controller }: CalendarControllerProps) {
  const meta = `${controller.doneTodayCalendars.length} ${controller.doneTodayCalendars.length === 1 ? "item" : "items"}`;
  return (
    <ListView title="Done" meta={meta} panelIndex={2} active={controller.activeZone === "calendar-today-done-panel"} bodyClassName="list-pane__body--flush" className="inbox-pane inbox-pane--list calendar-pane--done">
      <CalendarPanelBody controller={controller} panel="done-today" />
    </ListView>
  );
}

function CompletedCalendarPanel({ controller }: CalendarControllerProps) {
  const meta = `${controller.completedCalendars.length} ${controller.completedCalendars.length === 1 ? "item" : "items"}`;
  return (
    <ListView title="Completed" meta={meta} panelIndex={1} active={controller.activeZone === "calendar-completed-panel"} bodyClassName="list-pane__body--flush" className="inbox-pane inbox-pane--list">
      <CalendarPanelBody controller={controller} panel="completed" />
    </ListView>
  );
}

function DeletedCalendarPanel({ controller }: CalendarControllerProps) {
  const meta = `${controller.deletedCalendars.length} ${controller.deletedCalendars.length === 1 ? "item" : "items"}`;
  return (
    <ListView title="Deleted" meta={meta} panelIndex={1} active={controller.activeZone === "calendar-deleted-panel"} bodyClassName="list-pane__body--flush" className="inbox-pane inbox-pane--list">
      <CalendarPanelBody controller={controller} panel="deleted" />
    </ListView>
  );
}

function WeeklyCalendarPanel({ controller, day, index }: CalendarControllerProps & Readonly<{ day: CalendarPanel, index: number }>) {
  const dayName = day.charAt(0).toUpperCase() + day.slice(1);
  const monday = getMondayForOffset(controller.weekOffset);
  const columnDate = new Date(monday);
  columnDate.setDate(monday.getDate() + index - 1);
  
  const today = new Date();
  const isToday = columnDate.getFullYear() === today.getFullYear() &&
                  columnDate.getMonth() === today.getMonth() &&
                  columnDate.getDate() === today.getDate();

  const zoneId = activePanelZone(day);
  const active = controller.activeZone === zoneId;

  return (
    <section className={`list-pane ${active ? "list-pane--active" : ""} inbox-pane inbox-pane--list`}>
      <header className="weekly-column-header">
        <span className="weekly-column-day">{dayName}</span>
        <span className={`weekly-column-date ${isToday ? "weekly-column-date--today" : ""}`}>
          {columnDate.getDate()}
        </span>
      </header>
      <div className="list-pane__body list-pane__body--flush">
        <CalendarPanelBody controller={controller} panel={day} />
      </div>
    </section>
  );
}

function CalendarDetailView({ controller }: CalendarControllerProps) {
  return (
    <ListView title="Calendar Detail" viewIndex={2} active={controller.activeZone === "calendar-detail"} bodyClassName="list-pane__body--detail" className="inbox-pane inbox-pane--detail">
      <CalendarDetailBody controller={controller} />
    </ListView>
  );
}

/** Computes "Month Year" label for the weekly view header (REQ-07). */
function weeklyMonthLabel(weekOffset: number): string {
  const monday = getMondayForOffset(weekOffset);
  return monday.toLocaleDateString("en-GB", { month: "long", year: "numeric" });
}

function WeeklyCalendarHeader({ weekOffset }: Readonly<{ weekOffset: number }>) {
  return (
    <header className="weekly-calendar-header">
      {weeklyMonthLabel(weekOffset)}
    </header>
  );
}

function CalendarViews({ controller }: CalendarControllerProps) {
  if (controller.activeSubview === "today") {
    return (
      <section className="calendar-today-layout" aria-label="Calendars">
        <section className="calendar-today-group" aria-label="Today calendars">
          <DueCalendarPanel controller={controller} />
          <DoneTodayCalendarPanel controller={controller} />
        </section>
        <CalendarDetailView controller={controller} />
      </section>
    );
  } else if (controller.activeSubview === "completed") {
    return (
      <section className="inbox-terminal-layout" aria-label="Calendars">
        <CompletedCalendarPanel controller={controller} />
        <CalendarDetailView controller={controller} />
      </section>
    );
  } else if (controller.activeSubview === "deleted") {
    return (
      <section className="inbox-terminal-layout" aria-label="Calendars">
        <DeletedCalendarPanel controller={controller} />
        <CalendarDetailView controller={controller} />
      </section>
    );
  } else if (controller.activeSubview === "weekly") {
    return (
      <section className="weekly-calendar-wrapper" aria-label="Calendars">
        <WeeklyCalendarHeader weekOffset={controller.weekOffset} />
        <section className="weekly-terminal-layout">
          <WeeklyCalendarPanel day="mon" index={1} controller={controller} />
          <WeeklyCalendarPanel day="tue" index={2} controller={controller} />
          <WeeklyCalendarPanel day="wed" index={3} controller={controller} />
          <WeeklyCalendarPanel day="thu" index={4} controller={controller} />
          <WeeklyCalendarPanel day="fri" index={5} controller={controller} />
          <WeeklyCalendarPanel day="sat" index={6} controller={controller} />
          <WeeklyCalendarPanel day="sun" index={7} controller={controller} />
        </section>
      </section>
    );
  }
  return null;
}

/**
 * Renders the Calendar workspace with subviews and selected detail.
 *
 * @example <CalendarPage controller={controller} />
 */
export function CalendarPage({ controller, selectOnGoingCalendar, openOwnerProject, projects = [] }: CalendarPageProps) {
  const [isLinkOpen, setIsLinkOpen] = useState(false);
  const [isAssetOpen, setIsAssetOpen] = useState(false);
  const [isScheduleEditOpen, setIsScheduleEditOpen] = useState(false);
  const projectAssociate = useProjectAssociateDialog();
  const openLink = useCallback(() => setIsLinkOpen(true), []);
  const openAsset = useCallback(() => setIsAssetOpen(true), []);
  const openScheduleEdit = useCallback(() => setIsScheduleEditOpen(true), []);
  useKeybindScreen("calendars");
  useCalendarZone(controller);
  useCalendarAssetPreload(controller);
  useCalendarBindings(controller, openLink, openAsset, openScheduleEdit, selectOnGoingCalendar, projectAssociate.open, openOwnerProject, projects);
  const titleSearch = useListTitleSearch({
    disabled: Boolean(controller.editingTitle !== "" || controller.editingBodyId),
    items: controller.stuffs,
    screen: "calendars",
    selectedId: controller.selectedItem?.id ?? null,
    setSelectedId: controller.setSelectedId,
    zone: [
      "calendar-today-due-panel",
      "calendar-today-done-panel",
      "calendar-completed-panel",
      "calendar-deleted-panel",
      "calendar-mon-panel",
      "calendar-tue-panel",
      "calendar-wed-panel",
      "calendar-thu-panel",
      "calendar-fri-panel",
      "calendar-sat-panel",
      "calendar-sun-panel"
    ]
  });

  return (
    <ListWorkspace theme={calendarWorkspaceTheme(controller.activeSubview)} currentLabel="Calendars" modeLabel={controller.vimMode ?? undefined} titleSearch={titleSearch}>
      <CalendarViews controller={controller} />
      <LeaderMenu />
      <Suspense fallback={null}>
        {isLinkOpen ? <LazyMarkdownLinkComboDialog onClose={() => setIsLinkOpen(false)} /> : null}
        {isAssetOpen && controller.selectedItem ? <LazyMarkdownAssetComboDialog itemId={controller.selectedItem.id} onClose={() => setIsAssetOpen(false)} /> : null}
        {isScheduleEditOpen && controller.selectedItem ? <CalendarScheduleEditDialog item={controller.selectedItem} onClose={() => setIsScheduleEditOpen(false)} onSave={controller.updateSchedule} /> : null}
        <ProjectAssociateDialog
          item={controller.selectedItem}
          isOpen={projectAssociate.isOpen}
          onClose={projectAssociate.close}
          onAssociate={controller.assignSelectedProject}
        />
      </Suspense>
    </ListWorkspace>
  );
}
