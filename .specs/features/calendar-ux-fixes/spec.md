# Calendar UX Fixes Specification

## Problem Statement

The calendar workspace has several gaps that make daily and weekly calendar work slower than the rest of the GTD app. Calendar scheduling cannot be edited from the calendar views, time values expose backend seconds, calendar detail metadata is hard to scan, the Today done action does not update the visible Done panel immediately, and Weekly navigation is missing the documented week-level shortcuts.

## Goals

- [ ] Add an `e` keybind to edit selected calendar schedule metadata from every Calendars subview.
- [ ] Reuse the existing processing-style segmented date and optional time controls for calendar schedule editing.
- [ ] Display scheduled times as `HH:mm` instead of `HH:mm:ss` in calendar lists and details.
- [ ] Render calendar detail metadata in the same compact visual style as next-action detail metadata.
- [ ] Update Today view immediately when `x` marks a calendar done.
- [ ] Add Weekly `H`, `L`, and `t` navigation shortcuts.
- [ ] Make Weekly `Enter` edit the selected calendar title, while `Space Enter` remains the full-detail shortcut.

## Out of Scope

| Feature | Reason |
| --- | --- |
| Backend schema changes | Existing calendar fields already support scheduled date, scheduled time, and done schedule window. |
| New calendar creation flow | Calendar creation remains part of inbox processing. |
| Recurring calendars | The current calendar model is single-date only. |
| Cross-platform behavior | The desktop app is optimized for the owner's Arch Linux/Hyprland workflow. |

---

## User Stories

### P1: Edit Calendar Schedule From Calendar Views

**User Story**: As the project owner, I want to press `e` on any selected calendar so that I can change its scheduled date and optional time without leaving the calendar page.

**Why P1**: Calendar date/time is core metadata and should be editable where calendars are reviewed.

**Acceptance Criteria**:

1. WHEN a selected calendar is visible in Today, Weekly, Completed, Deleted, or Calendar Detail focus THEN pressing `e` SHALL open an edit dialog.
2. WHEN the dialog opens THEN the date step SHALL use the same segmented `dd/mm/yyyy` keyboard control used by inbox processing.
3. WHEN the user confirms a valid date THEN the dialog SHALL move to the optional time step.
4. WHEN the user confirms the time step THEN the desktop SHALL call `PATCH /calendars/{id}` with `scheduledDate` and `scheduledTime`.
5. WHEN the selected calendar already has a scheduled time THEN the time step SHALL initialize with that time.
6. WHEN the selected calendar has no scheduled time THEN the time step SHALL initialize empty and save `scheduledTime: null`.
7. WHEN `Escape` is pressed on the date step THEN the dialog SHALL close without persisting changes.
8. WHEN `Escape` is pressed on the time step THEN the dialog SHALL return to the date step and preserve the selected date.
9. WHEN the dialog is active THEN page-level calendar keybinds SHALL not run.

**Independent Test**: Open Calendars, select a calendar, press `e`, change date/time with keyboard controls, confirm, and verify the card/detail show the updated schedule.

---

### P1: Human Calendar Time Display

**User Story**: As the project owner, I want calendar times to show only hour and minute so that Today and Weekly cards do not show unnecessary seconds.

**Why P1**: The backend returns `HH:mm:ss`, but the UI should show normal human clock time.

**Acceptance Criteria**:

1. WHEN a calendar card renders a scheduled time with seconds THEN it SHALL display only `HH:mm`.
2. WHEN calendar detail renders scheduled time metadata THEN it SHALL display only `HH:mm`.
3. WHEN a time already has `HH:mm` shape THEN the display SHALL remain unchanged.
4. WHEN a time is missing THEN the UI SHALL keep the existing no-time behavior.

**Independent Test**: Render a calendar with `scheduledTime: "21:00:00"` and verify list/detail text is `21:00`.

---

### P1: Calendar Detail Metadata Layout

**User Story**: As the project owner, I want calendar detail dates to use the compact next-action schedule style so that stated schedule and done schedule are easier to read.

**Why P1**: The current `scheduled: date | time` wording wastes space and does not visually connect the two date concepts.

**Acceptance Criteria**:

1. WHEN Calendar Detail renders THEN line 1 SHALL show the calendar's stated scheduled date and optional scheduled time as one compact schedule item.
2. WHEN the calendar has `schedule.dateStart` or `schedule.dateEnd` THEN line 2 SHALL show the actual schedule window using the same arrow style as next actions.
3. WHEN the actual schedule has no time values THEN line 2 SHALL show dates only.
4. WHEN the calendar has no actual schedule window THEN line 2 SHALL be omitted.
5. WHEN detail metadata renders THEN it SHALL use the existing next-action metadata icon/style system where practical.

**Independent Test**: Render a done calendar with `scheduledDate`, `scheduledTime`, and schedule start/end values, then verify the header has two metadata lines.

---

### P1: Today Done Action Updates Immediately

**User Story**: As the project owner, I want pressing `x` in Today to move the calendar into the Done panel immediately so that the screen reflects the completed state without leaving and returning.

**Why P1**: The current behavior hides the item from Calendar and only shows it in Done after a reload or navigation.

**Acceptance Criteria**:

1. WHEN `x` marks a Today Calendar panel item done THEN the item SHALL disappear from the Calendar panel.
2. WHEN the done API response returns THEN the same item SHALL appear in the Today Done panel immediately if its done date is today.
3. WHEN the selected item moved to Done THEN selection SHALL remain valid and focus SHALL remain in the Today workspace.
4. WHEN the done mutation fails THEN existing error/logging behavior SHALL remain unchanged and no fake Done item SHALL be added.

**Independent Test**: Press `x` on a Today calendar and verify the Done panel count and card update before navigating away.

---

### P2: Weekly View Navigation And Editing

**User Story**: As the project owner, I want Weekly view keybindings to support week-level movement, return-to-today, and title editing so that Weekly works like the rest of the app.

**Why P2**: Weekly currently supports day-level movement but lacks the requested week-level shortcuts and title editing behavior.

**Acceptance Criteria**:

1. WHEN Weekly view has focus and the user presses `H` THEN the visible week SHALL move one week backward and keep the same weekday column focused.
2. WHEN Weekly view has focus and the user presses `L` THEN the visible week SHALL move one week forward and keep the same weekday column focused.
3. WHEN Weekly view has focus and the user presses `t` THEN the visible week SHALL reset to the current week and focus today's weekday column.
4. WHEN Weekly view has focus and the user presses lowercase `h` or `l` THEN day-level movement SHALL keep the existing behavior.
5. WHEN Weekly view has a selected calendar and the user presses `Enter` THEN the selected title SHALL enter inline edit mode.
6. WHEN Weekly view has a selected calendar and the user presses `Space Enter` THEN the full calendar detail page SHALL open.
7. WHEN a title or body edit is active THEN Weekly navigation keybinds SHALL not run.

**Independent Test**: Open Weekly, verify `H/L` changes the week header, `t` returns to current week, and `Enter` edits the selected card title.

---

## Edge Cases

- WHEN a calendar is deleted or completed and still selected THEN `e` SHALL patch its schedule but not change its status.
- WHEN the patched scheduled date moves a weekly item outside the visible week THEN the item SHALL leave the current weekly column after local state updates or reload.
- WHEN API time values contain seconds THEN display formatting SHALL not mutate the API payload.
- WHEN modal editing is active THEN global page keybindings SHALL remain isolated by the existing modal keybind rule.
- WHEN no calendar is selected THEN `e`, `Enter`, `x`, `H`, `L`, and `t` SHALL not throw.
- WHEN Weekly `t` is pressed on Sunday THEN focus SHALL resolve to the Sunday column of the current Monday-start week.

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| --- | --- | --- | --- |
| CUX-01 | Edit Calendar Schedule From Calendar Views | Specify | Draft |
| CUX-02 | Edit Calendar Schedule From Calendar Views | Specify | Draft |
| CUX-03 | Human Calendar Time Display | Specify | Draft |
| CUX-04 | Calendar Detail Metadata Layout | Specify | Draft |
| CUX-05 | Today Done Action Updates Immediately | Specify | Draft |
| CUX-06 | Weekly View Navigation And Editing | Specify | Draft |
| CUX-07 | Weekly View Navigation And Editing | Specify | Draft |

**Coverage**: 7 total, 0 mapped to implementation, 7 pending.

---

## Success Criteria

- [ ] `e` edits calendar scheduled date/time from all calendar subviews.
- [ ] Calendar time displays hide seconds in list cards and detail metadata.
- [ ] Calendar detail shows stated schedule on line 1 and actual/done schedule on line 2.
- [ ] Pressing `x` in Today moves the card into Done immediately.
- [ ] Weekly `H`, `L`, `t`, `Enter`, and `Space Enter` follow the requested behavior.
- [ ] Shortcut documentation and regression tests cover the new behavior.
- [ ] `pnpm test` passes.
