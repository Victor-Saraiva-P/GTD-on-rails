# Calendar GTD Element Specification

## Problem Statement

The app currently supports captured stuff and next actions, but it does not have a first-class GTD calendar element for date-bound commitments. Calendar items need their own list family, processing path, and ongoing/done flow so the owner can see what is due today, what is late, what is ongoing, and what was completed today.

This feature also clarifies interface vocabulary. Existing top-level areas such as Inbox and Stuff Detail should be called views, while panel should mean a subdivision inside a view.

## Goals

- [ ] Add Calendar as an item-backed GTD element with required date, optional time, and status flow.
- [ ] Convert inbox stuff into calendars through processing with only date and optional time steps.
- [ ] Add the calendars page opened by `Space c`, with Today, Weekly, Completed, and Deleted subviews.
- [ ] Update the On Going page so on going next actions and on going calendars appear as separate panels.
- [ ] Rename user-facing and documentation vocabulary so top-level areas are views and nested subdivisions are panels.

## Out of Scope

| Feature | Reason |
| --- | --- |
| Multi-user or divergent edit reconciliation | The runtime assumptions explicitly exclude concurrent divergent-edit handling. |
| Cross-platform calendar integrations | The app targets the owner's Arch Linux desktop flow only. |
| Recurring calendar items | The requested v1 calendar item is one required date with optional time. |
| External calendar sync | This feature is internal GTD calendar behavior only. |
| Timezone conversion rules | Calendar date/time are local app values for v1. |

---

## User Stories

### P1: Calendar Item Model - MVP

**User Story**: As the project owner, I want calendar to be a first-class GTD item so that dated commitments are not forced into next actions.

**Why P1**: Calendar cannot be processed, listed, or completed until the backend owns the element and status model.

**Acceptance Criteria**:

1. WHEN a calendar item is created THEN the system SHALL store it as an `Item` with calendar-specific metadata.
2. WHEN a calendar item is created THEN the system SHALL require a local scheduled date.
3. WHEN a calendar item is created without a time THEN the system SHALL store the scheduled time as empty.
4. WHEN a calendar item is marked on going THEN the system SHALL set calendar status to `ONGOING` and register schedule start.
5. WHEN a calendar item is marked done THEN the system SHALL set calendar status to `DONE` and register schedule end.
6. WHEN a calendar item is restored from on going or done THEN the system SHALL return it to `CALENDAR` status and clear schedule start/end data.

**Independent Test**: Create a calendar item through the API, move it to on going, mark it done, restore it, and verify persisted status and schedule fields after each transition.

---

### P1: Process Stuff Into Calendar - MVP

**User Story**: As the project owner, I want to press `c` during processing so that a captured stuff item becomes a calendar item.

**Why P1**: Processing is the canonical path from unprocessed stuff into clarified GTD elements.

**Acceptance Criteria**:

1. WHEN processing starts on selected stuff THEN the initial processing step SHALL offer `n` for Next actions and `c` for Calendar.
2. WHEN the user chooses `c` THEN the processing flow SHALL ask for a scheduled date.
3. WHEN the date is provided THEN the processing flow SHALL ask for optional scheduled time.
4. WHEN the optional time step is confirmed THEN the frontend SHALL call `POST /inbox/{id}/calendar`.
5. WHEN `Escape` is pressed on the initial processing step THEN the system SHALL cancel processing without persisting changes.
6. WHEN `Escape` is pressed after the initial processing step THEN the system SHALL go back one step and preserve previous compatible choices.
7. WHEN the conversion succeeds THEN the source stuff SHALL leave the inbox and become a calendar item.

**Independent Test**: Create stuff, press `p`, choose `c`, enter date and optional time, confirm, and verify the item leaves Inbox and appears in Calendars.

---

### P1: Calendar Today View - MVP

**User Story**: As the project owner, I want `Space c` to show today's calendar commitments and today's completed calendar work so that the day is actionable from one page.

**Why P1**: This is the primary calendar page and the first screen for the feature.

**Acceptance Criteria**:

1. WHEN the user presses `Space c` THEN the system SHALL open Calendars with Today View focused.
2. WHEN Today View loads THEN panel `(1)` SHALL list calendar items whose scheduled date is today or earlier and whose status is `CALENDAR`.
3. WHEN Today View loads THEN panel `(1)` SHALL exclude deleted, on going, and done calendar items.
4. WHEN Today View loads THEN panel `(2)` SHALL list calendar items whose status is `DONE` and whose schedule end date is today.
5. WHEN Today View has focus and the user presses `1` THEN the system SHALL focus panel `(1)`.
6. WHEN Today View has focus and the user presses `2` THEN the system SHALL focus panel `(2)`.
7. WHEN a list panel has focus THEN `j` and `k` SHALL move selection down and up.
8. WHEN a selected calendar is in panel `(1)` THEN `o` SHALL mark it on going and `x` SHALL mark it done.
9. WHEN a selected calendar is eligible for deletion THEN `d` SHALL soft-delete it.
10. WHEN the Calendars page renders THEN its principal accent color SHALL match the Inbox red.
11. WHEN a calendar item renders in a list or panel THEN its item icon SHALL be the letter `C`.
12. WHEN completed calendars render in Today View panel `(2)` THEN their visual accent SHALL match the completed next-actions green.

**Independent Test**: Seed a late calendar, a today calendar, an ongoing calendar, and a done-today calendar, then open `Space c` and verify each appears only in the correct panel.

---

### P1: Calendar Detail View - MVP

**User Story**: As the project owner, I want selected calendars to have a detail view so that I can inspect and edit the title/body like existing GTD elements.

**Why P1**: Calendar items are still item-backed records and need the existing rich body workflow.

**Acceptance Criteria**:

1. WHEN a calendar is selected THEN Calendar Detail View SHALL render its title, scheduled date, optional time, and body.
2. WHEN Calendar Detail View renders body content THEN it SHALL use the same body rendering and asset behavior as stuff and next actions.
3. WHEN the user edits a calendar title or body THEN the system SHALL persist through existing item title/body endpoints.
4. WHEN the user presses `Space Enter` on a selected calendar THEN the system SHALL open the focused calendar detail page.
5. WHEN the focused calendar detail page is open THEN `Escape` SHALL return to Calendars when body editing is not active.

**Independent Test**: Open a calendar detail, edit title and body, navigate away and back, and verify the edits persisted.

---

### P2: Calendar Subviews

**User Story**: As the project owner, I want weekly, completed, and deleted calendar subviews so that I can review upcoming, finished, and recoverable calendar items.

**Why P2**: These views make the calendar useful beyond today's immediate commitments.

**Acceptance Criteria**:

1. WHEN the user opens Weekly subview THEN the system SHALL display seven columns from Monday through Sunday.
2. WHEN Weekly subview loads THEN each column SHALL list calendars scheduled for that date.
3. WHEN Completed subview loads THEN it SHALL show non-deleted calendars with status `DONE`.
4. WHEN Deleted subview loads THEN it SHALL show soft-deleted calendars.
5. WHEN a deleted calendar is selected THEN `r` SHALL recover it.
6. WHEN a completed calendar is selected THEN `r` SHALL restore it to `CALENDAR`.
7. WHEN subview navigation uses bracket-style switching THEN it SHALL not conflict with existing keybinds in the same screen and focus zone.

**Independent Test**: Create calendars across a week, complete one, delete one, and verify weekly placement plus completed/deleted recovery behavior.

---

### P2: Combined On Going Page

**User Story**: As the project owner, I want On Going to show both active next actions and active calendars so that currently active work is visible in one place.

**Why P2**: Calendar items can be on going, and the existing on going page should not hide them.

**Acceptance Criteria**:

1. WHEN the user presses `Space o` THEN the system SHALL open the On Going page.
2. WHEN the On Going page loads THEN panel `(1)` SHALL list next actions with status `ONGOING`.
3. WHEN the On Going page loads THEN panel `(2)` SHALL list calendars with status `ONGOING`.
4. WHEN the user presses `1` THEN the system SHALL focus the on going next actions panel.
5. WHEN the user presses `2` THEN the system SHALL focus the on going calendars panel.
6. WHEN a panel selection changes THEN the detail view SHALL show the selected item's matching detail type.
7. WHEN an on going next action is restored THEN it SHALL return to next action status.
8. WHEN an on going calendar is restored THEN it SHALL return to calendar status.

**Independent Test**: Mark one next action and one calendar on going, open `Space o`, switch panels with `1` and `2`, and verify detail and restore behavior for both item types.

---

### P2: Vocabulary Reformulation

**User Story**: As the project owner, I want consistent view and panel vocabulary so that documentation and UI concepts match the new calendar layout.

**Why P2**: Calendar introduces nested panels, so the old top-level "panel" wording becomes ambiguous.

**Acceptance Criteria**:

1. WHEN documentation refers to top-level areas such as Inbox or Stuff Detail THEN it SHALL call them views.
2. WHEN code exposes user-facing labels or discoverable descriptions for top-level areas THEN it SHALL use view vocabulary.
3. WHEN code names the nested selectable subdivisions used by Calendar Today or On Going THEN it SHALL use panel vocabulary.
4. WHEN reusable layout components are renamed THEN behavior and visual styling SHALL remain unchanged unless explicitly required by the calendar layout.
5. WHEN documentation is updated THEN all text SHALL remain in English.

**Independent Test**: Search docs and user-facing strings for obsolete top-level panel wording and verify new calendar nested panels remain intentionally named panels.

---

## Edge Cases

- WHEN scheduled date is missing during calendar conversion THEN the API SHALL reject the request with an error naming the offending value and expected date shape.
- WHEN scheduled time is malformed THEN the API SHALL reject the request with an error naming the offending value and expected `HH:mm` shape.
- WHEN a past calendar is not done and not on going THEN Today panel `(1)` SHALL include it as late.
- WHEN a calendar is deleted THEN Today, Weekly, Completed, and On Going active views SHALL exclude it.
- WHEN all calendar lists are empty THEN each view or panel SHALL show an English empty state.
- WHEN a modal dialog is active THEN page-level calendar or on going keybinds outside that modal SHALL not run.
- WHEN a body editor is in Vim insert mode THEN direct page keybinds SHALL not override text entry.
- WHEN the weekly range crosses a month or year boundary THEN the seven displayed columns SHALL still be consecutive local dates.
- WHEN `Space c` is added THEN it SHALL not conflict with `Space C` for Contexts.

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| --- | --- | --- | --- |
| CAL-01 | P1: Calendar Item Model | Design | Pending |
| CAL-02 | P1: Calendar Item Model | Design | Pending |
| CAL-03 | P1: Calendar Item Model | Design | Pending |
| CAL-04 | P1: Process Stuff Into Calendar | Design | Pending |
| CAL-05 | P1: Process Stuff Into Calendar | Design | Pending |
| CAL-06 | P1: Calendar Today View | Design | Pending |
| CAL-07 | P1: Calendar Today View | Design | Pending |
| CAL-08 | P1: Calendar Detail View | Design | Pending |
| CAL-09 | P2: Calendar Subviews | Design | Pending |
| CAL-10 | P2: Combined On Going Page | Design | Pending |
| CAL-11 | P2: Vocabulary Reformulation | Design | Pending |

**Coverage**: 11 total, 0 mapped to tasks, 11 unmapped.

---

## Success Criteria

- [ ] The owner can process inbox stuff into a calendar using `p`, then `c`, then date and optional time.
- [ ] `Space c` opens Calendars and shows due or late calendars in panel `(1)` and done-today calendars in panel `(2)`.
- [ ] Calendar items can move through `CALENDAR`, `ONGOING`, and `DONE` without losing title/body content.
- [ ] Calendar views use the Inbox red as the principal color, render calendar item icons as `C`, and use completed next-actions green for completed calendars in Today View.
- [ ] Weekly view displays seven Monday-Sunday columns with the correct local dates.
- [ ] `Space o` shows on going next actions and on going calendars as separate panels.
- [ ] Documentation and user-facing terminology consistently use views for top-level areas and panels for nested subdivisions.
- [ ] `pnpm test`, `pnpm --filter @gtd-on-rails/desktop check`, and `pnpm --filter @gtd-on-rails/api test` pass.
