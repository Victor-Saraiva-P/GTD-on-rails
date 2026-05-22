# Calendar Page Refactor Specification

## Problem Statement

The calendar page currently uses a leader submenu under `Space c` for Today, Weekly, Completed, and Deleted calendar subviews. That adds an extra keypress to the primary calendar workflow and makes calendar navigation inconsistent with the bracket-based archive navigation already used by next actions.

The Today calendar layout also reads as three independent panes. The desired view groups the two Today lists together on the left, with the calendar detail as a separate pane on the right.

## Goals

- [ ] Make `Space c` open the Calendars page directly on Today view.
- [ ] Remove all `Space c ...` calendar submenu keybindings.
- [ ] Keep Weekly, Completed, and Deleted subviews available through `[` and `]`.
- [ ] Rework Today view so the two list panes are grouped under a Today section and the detail pane remains separate.
- [ ] Preserve existing calendar item actions, detail editing, body formatting, and asset behavior.

## Out of Scope

| Feature | Reason |
| --- | --- |
| Backend API changes | This refactor changes desktop navigation and layout only. |
| Calendar persistence changes | Existing calendar data model and status flow remain valid. |
| New calendar creation flow | Calendar creation still happens through inbox processing. |
| External calendar integrations | The existing feature is internal GTD calendar behavior. |
| Cross-platform layout variants | The desktop app targets the owner's Arch Linux/Hyprland flow. |

---

## User Stories

### P1: Direct Calendar Navigation

**User Story**: As the project owner, I want `Space c` to open Calendars directly on Today view so that the primary calendar page is one leader sequence away.

**Why P1**: Today is the main calendar view and should not require a submenu.

**Acceptance Criteria**:

1. WHEN the user presses `Space c` from any non-modal app screen THEN the system SHALL open Calendars directly.
2. WHEN Calendars opens from `Space c` THEN the active subview SHALL be Today.
3. WHEN Calendars opens from `Space c` THEN the active panel SHALL be the Today calendar list panel.
4. WHEN Calendars opens from `Space c` THEN title/body editing state SHALL be cleared.
5. WHEN the leader menu is opened with `Space` THEN `c` SHALL appear as a direct action, not as a submenu parent.
6. WHEN the user presses `Space c t`, `Space c w`, `Space c c`, or `Space c d` THEN those sequences SHALL NOT navigate calendar subviews.
7. WHEN `Space c` is added THEN it SHALL NOT conflict with `Space C` for Contexts.

**Independent Test**: Start from Inbox, press `Space`, then `c`, and verify Calendars opens on Today without showing a `Space c` submenu or requiring a third key.

---

### P1: Bracket Calendar Subview Navigation

**User Story**: As the project owner, I want calendar subviews to move with `[` and `]` like next actions so that archive-style navigation is consistent.

**Why P1**: Weekly, Completed, and Deleted still need to exist after removing calendar leader subkeys.

**Acceptance Criteria**:

1. WHEN Calendars is on Today and the user presses `]` THEN the system SHALL open Weekly.
2. WHEN Calendars is on Weekly and the user presses `]` THEN the system SHALL open Completed.
3. WHEN Calendars is on Completed and the user presses `]` THEN the system SHALL open Deleted.
4. WHEN Calendars is on Deleted and the user presses `]` THEN the system SHALL open Today.
5. WHEN Calendars is on Today and the user presses `[` THEN the system SHALL open Deleted.
6. WHEN Calendars is on Deleted and the user presses `[` THEN the system SHALL open Completed.
7. WHEN Calendars is on Completed and the user presses `[` THEN the system SHALL open Weekly.
8. WHEN Calendars is on Weekly and the user presses `[` THEN the system SHALL open Today.
9. WHEN switching to Today THEN the active panel SHALL be the Today calendar list panel.
10. WHEN switching to Weekly THEN the active panel SHALL be Monday.
11. WHEN switching to Completed THEN the active panel SHALL be Completed.
12. WHEN switching to Deleted THEN the active panel SHALL be Deleted.
13. WHEN a title or body edit is active THEN `[` and `]` SHALL NOT switch calendar subviews.
14. WHEN a modal dialog is active THEN calendar page-level bracket keybinds SHALL NOT run.

**Independent Test**: Open Calendars with `Space c`, press `]` four times and verify Today, Weekly, Completed, Deleted, Today order; press `[` four times and verify the reverse order.

---

### P1: Today Layout Grouping

**User Story**: As the project owner, I want Today calendars grouped visually on the left and details on the right so that the page matches the intended calendar workspace shape.

**Why P1**: The current three-pane layout does not communicate that the first two lists are both part of Today.

**Acceptance Criteria**:

1. WHEN Today view renders THEN the page SHALL show one left Today group and one right Calendar detail pane.
2. WHEN Today view renders THEN the Today group SHALL contain two side-by-side list panes.
3. WHEN Today view renders THEN the first list pane SHALL be titled `Calendar`.
4. WHEN Today view renders THEN the second list pane SHALL be titled `Done`.
5. WHEN the first list pane renders THEN it SHALL list due or late calendar items whose status is `CALENDAR`.
6. WHEN the second list pane renders THEN it SHALL list calendars completed today.
7. WHEN the Calendar detail pane renders THEN it SHALL continue to show the selected calendar details and body content.
8. WHEN the user focuses panel `1` or `2` THEN the active border/focus styling SHALL remain visible inside the Today group.
9. WHEN the viewport is narrow THEN the layout SHALL stack without overlapping text or panes.
10. WHEN Today lists are empty THEN each pane SHALL keep its existing English empty state behavior.

**Independent Test**: Seed one due calendar and one done-today calendar, open `Space c`, and verify both appear inside the left Today group while the selected item detail appears on the right.

---

### P2: Calendar Documentation and Test Alignment

**User Story**: As the project owner, I want docs and regression tests to describe the new calendar behavior so that future changes do not reintroduce the submenu or old layout assumptions.

**Why P2**: The old e2e flow and shortcut docs currently encode the removed `Space c ...` behavior.

**Acceptance Criteria**:

1. WHEN shortcut documentation is updated THEN it SHALL document `Space c` as the direct Calendars shortcut.
2. WHEN calendar subview documentation is updated THEN it SHALL document `[` and `]` as the subview navigation keys.
3. WHEN tests are updated THEN no test SHALL expect a `Space c` submenu.
4. WHEN tests are updated THEN at least one test SHALL verify `Space c` opens Today directly.
5. WHEN tests are updated THEN at least one test SHALL verify bracket navigation reaches Weekly, Completed, and Deleted.
6. WHEN documentation is updated THEN all text SHALL remain in English.

**Independent Test**: Run the desktop e2e calendar flow and verify it uses `Space c` and bracket navigation only.

---

## Edge Cases

- WHEN the active focus target is a text input, textarea, select, contenteditable element, or Vim insert-mode editor THEN direct page keybinds SHALL NOT run.
- WHEN the active focus target is a Vim normal or visual editor THEN existing Vim handling SHALL remain unchanged.
- WHEN switching subviews after a selected item disappears from the active collection THEN selection SHALL fall back to the first visible item or empty selection.
- WHEN Weekly has no items for a day THEN that day column SHALL preserve its current empty-state behavior.
- WHEN Completed or Deleted are empty THEN each subview SHALL preserve its current English empty state.
- WHEN body formatting leader bindings are available in calendar detail THEN `Space m ...`, `Space t ...`, and `Space g d` SHALL remain unchanged.

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| --- | --- | --- | --- |
| CPR-01 | Direct Calendar Navigation | Execute | Complete |
| CPR-02 | Direct Calendar Navigation | Execute | Complete |
| CPR-03 | Bracket Calendar Subview Navigation | Execute | Complete |
| CPR-04 | Bracket Calendar Subview Navigation | Execute | Complete |
| CPR-05 | Today Layout Grouping | Execute | Complete |
| CPR-06 | Today Layout Grouping | Execute | Complete |
| CPR-07 | Calendar Documentation and Test Alignment | Execute | Complete |
| CPR-08 | Calendar Documentation and Test Alignment | Execute | Complete |

**Coverage**: 8 total, 8 mapped to tasks, 0 unmapped.

---

## Success Criteria

- [x] `Space c` opens Calendars directly on Today view.
- [x] There are no calendar navigation bindings for `Space c t`, `Space c w`, `Space c c`, or `Space c d`.
- [x] `[` and `]` cycle calendar subviews in the order Today, Weekly, Completed, Deleted.
- [x] Today view visually groups `Calendar` and `Done` list panes on the left.
- [x] Calendar detail remains a separate right-side pane in Today view.
- [x] Existing calendar list actions, detail editing, rich body formatting, and asset insertion still work.
- [x] Shortcut documentation and calendar e2e tests match the refactored behavior.
- [x] `pnpm test` passes.
