# Calendar UX Fixes Tasks

**Spec**: `.specs/features/calendar-ux-fixes/spec.md`  
**Design**: Not created; implementation follows existing calendar, next-action metadata, and processing dialog patterns.  
**Status**: Draft

---

## Execution Plan

```text
T1 → T2 → T3 → T4 → T5 → T6
```

---

## Task Breakdown

### T1: Add Shared Calendar Display Helpers

**What**: Add pure helpers for calendar display time normalization, stated schedule metadata, actual schedule metadata, and weekly today/week movement.  
**Where**: `apps/desktop/src/features/calendar`  
**Depends on**: None  
**Reuses**: `formatScheduleDateTime`, `getMondayForOffset`, existing calendar unit-test style  
**Requirement**: CUX-03, CUX-04, CUX-06

**Done when**:

- [ ] `21:00:00` displays as `21:00`.
- [ ] `21:00` displays as `21:00`.
- [ ] Missing times remain absent.
- [ ] Calendar stated schedule formats scheduled date plus optional time.
- [ ] Actual schedule formats start/end values with the existing arrow style.
- [ ] Weekly helpers resolve previous week, next week, and today's weekday panel.

**Tests**: Desktop unit  
**Gate**: `pnpm --filter @gtd-on-rails/desktop test`  
**Commit**: `feat(desktop): add calendar display helpers`

---

### T2: Render Improved Calendar Detail Metadata

**What**: Replace the text-only calendar detail metadata header with compact schedule rows that match next-action detail metadata.  
**Where**: `InboxStuffDetails.tsx`, `CalendarDetails.tsx`, calendar metadata helper files  
**Depends on**: T1  
**Reuses**: `NextActionMetaIcon`, `next-action-meta` classes, schedule icon asset  
**Requirement**: CUX-04

**Done when**:

- [ ] Calendar detail line 1 shows the stated calendar schedule.
- [ ] Calendar detail line 2 shows actual start/end schedule only when present.
- [ ] Times in both metadata rows hide seconds.
- [ ] Calendar title/body rendering and editing behavior remain unchanged.

**Tests**: Desktop unit and visual/e2e regression where practical  
**Gate**: `pnpm --filter @gtd-on-rails/desktop test` and `pnpm --filter @gtd-on-rails/desktop check`  
**Commit**: `feat(desktop): improve calendar detail schedule metadata`

---

### T3: Add Calendar Schedule Edit Dialog

**What**: Create a focused calendar schedule edit dialog opened by `e`, using existing processing-style calendar date and time controls.  
**Where**: New file in `apps/desktop/src/features/calendar`, plus small integration in `CalendarPage.tsx`  
**Depends on**: T1  
**Reuses**: `ProcessingCalendarDateStep`, `ProcessingCalendarTimeStep`, `clockTimeDisplayValue`, existing modal keybind isolation  
**Requirement**: CUX-01, CUX-02

**Done when**:

- [ ] Dialog initializes from selected calendar `scheduledDate` and `scheduledTime`.
- [ ] Date step uses segmented `dd/mm/yyyy` keyboard input.
- [ ] Time step uses optional HH:mm keyboard input.
- [ ] `Escape` closes from date and goes back from time.
- [ ] Final confirm calls `onSave` with `scheduledDate` and `scheduledTime`.
- [ ] Dialog file and touched files stay under the 500-line file limit.

**Tests**: Desktop unit/e2e  
**Gate**: `pnpm --filter @gtd-on-rails/desktop test` and `pnpm --filter @gtd-on-rails/desktop check`  
**Commit**: `feat(desktop): edit calendar schedule from calendar views`

---

### T4: Wire Calendar Schedule Patching And Immediate Done State

**What**: Add controller/query support for schedule patching and update status mutation state so Today Done receives the returned done item immediately.  
**Where**: `useCalendarQuery.ts`, `useCalendarWorkspaceController.ts`, `api.ts` if needed  
**Depends on**: T3  
**Reuses**: Existing `patchCalendar`, `replaceCalendar`, sync status polling, selection pruning  
**Requirement**: CUX-01, CUX-05

**Done when**:

- [ ] Calendar controller exposes an `updateSchedule` action.
- [ ] Schedule patch replaces the selected calendar locally after success.
- [ ] Marking a Today calendar done removes it from due calendars.
- [ ] Marking done appends or replaces the returned item in `doneTodayCalendars` when its end date is today.
- [ ] Failed mutations do not add optimistic fake items.

**Tests**: Desktop unit/API tests and e2e  
**Gate**: `pnpm --filter @gtd-on-rails/desktop test` and `pnpm --filter @gtd-on-rails/desktop check`  
**Commit**: `fix(desktop): update calendar today state after done`

---

### T5: Update Calendar Keybindings

**What**: Register the new calendar keybindings and resolve Weekly `Enter` behavior.  
**Where**: `CalendarPage.tsx`, calendar workspace state/controller helpers  
**Depends on**: T3, T4  
**Reuses**: Existing keybind registration and leader `Space Enter` full-detail pattern  
**Requirement**: CUX-01, CUX-06, CUX-07

**Done when**:

- [ ] `e` opens the schedule edit dialog in Today, Weekly, Completed, Deleted, and Calendar Detail zones.
- [ ] Weekly `H` moves to the previous week.
- [ ] Weekly `L` moves to the next week.
- [ ] Weekly `t` resets to current week and focuses today.
- [ ] Weekly lowercase `h/l` still move by day.
- [ ] Weekly `Enter` starts title editing.
- [ ] Weekly `Space Enter` opens the full calendar detail page.

**Tests**: Desktop unit/e2e  
**Gate**: `pnpm --filter @gtd-on-rails/desktop test` and `pnpm --filter @gtd-on-rails/desktop check`  
**Commit**: `feat(desktop): add weekly calendar keybindings`

---

### T6: Add Regression Coverage And Documentation

**What**: Add tests and documentation for the new calendar editing, display, and Weekly keybinding behavior.  
**Where**: `apps/desktop/test`, `apps/desktop/e2e`, `docs/20 - GTD/shared/Global Shortcuts.md`, and any calendar-specific docs added by implementation  
**Depends on**: T1, T2, T3, T4, T5  
**Reuses**: Existing calendar e2e flow and shortcut documentation style  
**Requirement**: CUX-01, CUX-02, CUX-03, CUX-04, CUX-05, CUX-06, CUX-07

**Done when**:

- [ ] Unit tests cover time trimming and metadata formatting.
- [ ] Unit tests cover Weekly previous/next/today helpers.
- [ ] E2E covers `e` schedule editing.
- [ ] E2E covers `x` moving a Today calendar into Done immediately.
- [ ] E2E covers Weekly `H`, `L`, `t`, `Enter`, and `Space Enter`.
- [ ] Docs list the new calendar keybindings in English.
- [ ] Full verification passes or any skipped gate is recorded.

**Tests**: Desktop unit/e2e and full repo gate  
**Gate**: `pnpm test`  
**Commit**: `test(desktop): cover calendar ux fixes`
