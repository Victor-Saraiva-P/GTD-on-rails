# Calendar Page Refactor Tasks

**Spec**: `.specs/features/calendar-page-refactor/spec.md`  
**Design**: Not created; implementation follows existing calendar and next-action page patterns.  
**Status**: Draft

---

## Execution Plan

This is a desktop-only refactor. Implement state/navigation first, then layout, then docs and regression coverage.

```text
T1 → T2 → T3 → T4
```

---

## Task Breakdown

### T1: Refactor Calendar Navigation State

**What**: Add explicit calendar subview navigation helpers and remove the need for global submenu targets.  
**Where**: `apps/desktop/src/features/calendar/calendarWorkspaceState.ts`, `apps/desktop/src/features/calendar/useCalendarWorkspaceController.ts`  
**Depends on**: None  
**Reuses**: Existing calendar panel focus, pruning, and next-action bracket navigation patterns  
**Requirement**: CPR-01, CPR-02, CPR-03, CPR-04

**Tools**:

- MCP: NONE
- Skill: `tlc-spec-driven`

**Done when**:

- [x] Calendar subviews cycle in the order `today -> weekly -> completed -> deleted -> today`.
- [x] Reverse cycling follows `today -> deleted -> completed -> weekly -> today`.
- [x] Switching subviews focuses the first valid panel for the target subview: `due`, `mon`, `completed`, or `deleted`.
- [x] Switching subviews clears calendar title/body edit state.
- [x] `resetWorkspace()` still returns Calendars to Today with the due/calendar panel focused.
- [x] Unit tests cover forward cycle, reverse cycle, target panel selection, and edit clearing.

**Tests**: Desktop unit  
**Gate**: `pnpm test`  
**Commit**: `fix(desktop): refactor calendar subview state`

---

### T2: Replace Calendar Leader Submenu With Direct `Space c`

**What**: Change global calendar navigation so `Space c` opens Today directly, and add `[` / `]` subview keybinds inside the calendar page.  
**Where**: `apps/desktop/src/pages/AppShell.tsx`, `apps/desktop/src/pages/CalendarPage.tsx`  
**Depends on**: T1  
**Reuses**: `NextActionsPage` and `ArchivedNextActionsPage` bracket keybinding patterns  
**Requirement**: CPR-01, CPR-02, CPR-03, CPR-04

**Tools**:

- MCP: NONE
- Skill: `tlc-spec-driven`

**Done when**:

- [x] Global navigation registers one calendar leader binding with sequence `["c"]`.
- [x] Global navigation no longer registers `["c", "t"]`, `["c", "w"]`, `["c", "c"]`, or `["c", "d"]`.
- [x] Pressing `Space c` resets the calendar workspace and opens Calendars on Today.
- [x] Calendar list and detail zones bind `]` to next subview and `[` to previous subview.
- [x] Bracket keybinds do nothing while title or body editing is active.
- [x] Existing calendar actions, detail opening, formatting leader bindings, and asset/link dialogs remain available.

**Tests**: Desktop unit/e2e  
**Gate**: `pnpm test`  
**Commit**: `fix(desktop): open calendars with direct leader key`

---

### T3: Rebuild Today Calendar Layout

**What**: Rework Today view so Calendar and Done lists share a left Today group, with Calendar detail in a separate right pane.  
**Where**: `apps/desktop/src/pages/CalendarPage.tsx`, `apps/desktop/src/styles/layouts-and-views.css`, `apps/desktop/src/styles/responsive.css`  
**Depends on**: T2  
**Reuses**: Existing `ListView`, list-pane styling, responsive layout rules, and calendar detail rendering  
**Requirement**: CPR-05, CPR-06

**Tools**:

- MCP: NONE
- Skill: `tlc-spec-driven`

**Done when**:

- [x] Today view renders a calendar-specific layout instead of a flat three-pane grid.
- [x] The left Today group contains the two list panes side by side on desktop.
- [x] The first Today list pane is titled `Calendar`.
- [x] The second Today list pane is titled `Done`.
- [x] Calendar detail remains a separate right-side pane on desktop.
- [x] Active focus styling remains visible for panel `1`, panel `2`, and detail.
- [x] Narrow viewports stack without text or pane overlap.
- [x] Empty states for due/late and done-today lists remain in English.

**Tests**: Desktop e2e visual/behavior assertions  
**Gate**: `pnpm test`  
**Commit**: `fix(desktop): group calendar today panes`

---

### T4: Update Documentation and Regression Coverage

**What**: Align shortcut docs and e2e coverage with direct calendar navigation and bracket subview switching.  
**Where**: `docs/20 - GTD/shared/Global Shortcuts.md`, `docs/20 - GTD/next-action/Next Actions.md` if referenced for parity, `apps/desktop/e2e/calendar-gtd-flow.spec.ts`, desktop unit tests  
**Depends on**: T2, T3  
**Reuses**: Existing calendar GTD e2e flow and calendar workspace unit tests  
**Requirement**: CPR-07, CPR-08

**Tools**:

- MCP: NONE
- Skill: `tlc-spec-driven`

**Done when**:

- [x] Global shortcut docs list `Space c` as direct Calendars navigation.
- [x] Calendar documentation or test comments no longer describe `Space c t`, `Space c w`, `Space c c`, or `Space c d`.
- [x] E2E coverage verifies `Space c` opens Today directly.
- [x] E2E coverage verifies `[` and `]` reach Weekly, Completed, and Deleted.
- [x] E2E coverage verifies the Today view exposes `Calendar`, `Done`, and `Calendar Detail`.
- [x] `pnpm test` passes.

**Tests**: Desktop unit/e2e plus full project test command  
**Gate**: `pnpm test`  
**Commit**: `test(desktop): cover calendar page refactor`

---

## Requirement Mapping

| Requirement ID | Task | Verification |
| --- | --- | --- |
| CPR-01 | T1, T2 | `Space c` resets and opens Today directly. |
| CPR-02 | T2, T4 | Removed calendar submenu bindings and updated docs/tests. |
| CPR-03 | T1, T2 | `]` cycles Today, Weekly, Completed, Deleted. |
| CPR-04 | T1, T2 | `[` cycles Deleted, Completed, Weekly, Today. |
| CPR-05 | T3 | Today left group contains `Calendar` and `Done`. |
| CPR-06 | T3 | Detail pane remains separate and responsive layout holds. |
| CPR-07 | T4 | Docs document direct `Space c` and bracket navigation. |
| CPR-08 | T4 | Unit/e2e tests cover new behavior. |

---

## Final Verification

- [x] `pnpm test`
- [ ] Manual desktop check: `Space c` opens Today directly.
- [ ] Manual desktop check: `[` and `]` cycle all calendar subviews in order.
- [ ] Manual desktop check: Today layout matches the provided sketch at the target desktop resolution.
