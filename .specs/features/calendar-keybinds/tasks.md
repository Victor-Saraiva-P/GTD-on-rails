# Calendar Keybinds Tasks

**Design**: N/A (Quick implementation)
**Status**: Draft

---

## Execution Plan

### Phase 1: Controller Modifications (Sequential)
T1

### Phase 2: UI Bindings (Sequential)
T2

---

## Task Breakdown

### T1: [Implement Controller Undo/Redo Logic]

**What**: Add `useUndoRedoHistory` and `undo`/`redo` functions to the calendar controller, and update `deleteSelected` to push to history.
**Where**: `apps/desktop/src/features/calendar/useCalendarWorkspaceController.ts`
**Depends on**: None
**Reuses**: `useUndoRedoHistory` from Inbox implementation
**Requirement**: CAL-KEY-01, CAL-KEY-02

**Tools**:
- MCP: `filesystem`
- Skill: NONE

**Done when**:
- [x] `useUndoRedoHistory` is imported and initialized in the model.
- [x] `undoCalendarAction` and `redoCalendarAction` are implemented and exported.
- [x] `deleteSelected` pushes the deleted item to the undo history.

**Tests**: none
**Gate**: quick

---

### T2: [Bind Keys in Calendar Views]

**What**: Map 'd', 'u', and 'ctrl+r' keybinds to the respective controller functions across all calendar subviews.
**Where**: `apps/desktop/src/pages/CalendarPage.tsx`
**Depends on**: T1
**Reuses**: Existing keybind definition structure

**Tools**:
- MCP: `filesystem`
- Skill: NONE

**Done when**:
- [x] 'd' is mapped to `deleteSelected` in weekly and today view panels.
- [x] 'u' is mapped to `undo` in all relevant panels.
- [x] 'ctrl+r' is mapped to `redo` in all relevant panels.

**Tests**: none
**Gate**: quick

---

## Task Granularity Check

| Task                            | Scope         | Status       |
| ------------------------------- | ------------- | ------------ |
| T1: Implement Controller Logic  | 1 file        | ✅ Granular  |
| T2: Bind Keys in Calendar Views | 1 file        | ✅ Granular  |

## Diagram-Definition Cross-Check

| Task | Depends On (task body) | Diagram Shows | Status |
| ---- | ---------------------- | ------------- | ------ |
| T1   | None                   | None          | ✅ Match |
| T2   | T1                     | T1 -> T2      | ✅ Match |

## Test Co-location Validation

| Task | Code Layer Created/Modified | Matrix Requires | Task Says | Status |
| ---- | --------------------------- | --------------- | --------- | ------ |
| T1   | React Hook                  | none            | none      | ✅ OK  |
| T2   | React Page Component        | none            | none      | ✅ OK  |
