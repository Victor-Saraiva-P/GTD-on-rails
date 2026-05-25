# Calendar Keybinds Specification

## Problem Statement

Users need a quick way to delete and undo deletions of calendar items across all calendar views. Currently, the delete ('d') keybind only works in the due calendar panel, and there is no undo ('u') functionality in the calendar workspace, causing friction when managing scheduled tasks.

## Goals

- [ ] Unify delete functionality ('d') across the weekly and today calendar views.
- [ ] Introduce undo functionality ('u') for calendar item deletions, mirroring the behavior present in the inbox workspace.

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature     | Reason         |
| ----------- | -------------- |
| Global undo for all actions | We are only implementing undo/redo for calendar deletions in this iteration, matching the scope of the inbox. |

---

## User Stories

### P1: Delete Calendar Items ⭐ MVP

**User Story**: As a user, I want to press 'd' to delete a focused calendar item in any calendar view (today, weekly) so that I can quickly manage my schedule without using the mouse.

**Why P1**: Core to the GTD workflow.

**Acceptance Criteria**:

1. WHEN the user presses 'd' while focused on a calendar item in the today view THEN the system SHALL delete the item.
2. WHEN the user presses 'd' while focused on a calendar item in any day column of the weekly view THEN the system SHALL delete the item.
3. WHEN the user presses 'd' in the calendar detail view THEN the system SHALL delete the currently viewed item.

**Independent Test**: Can demo by opening the weekly view, highlighting an item, pressing 'd', and observing the item disappear.

---

### P1: Undo and Redo Calendar Deletion ⭐ MVP

**User Story**: As a user, I want to press 'u' to undo the last calendar deletion, and 'ctrl+r' to redo it, so that I can easily recover from accidental mistakes or revert my undos.

**Why P1**: Deleting without confirmation requires a fast undo/redo mechanism.

**Acceptance Criteria**:

1. WHEN the user deletes an item and then presses 'u' THEN the system SHALL restore the deleted item to its original state.
2. WHEN the user presses 'u' and there is no prior action THEN the system SHALL do nothing.
3. WHEN the user undoes a deletion and presses 'ctrl+r' THEN the system SHALL re-delete the item.

**Independent Test**: Can demo by pressing 'd' to delete an item, pressing 'u' to restore it, and then pressing 'ctrl+r' to see the item disappear again.

---

## Edge Cases

- WHEN pressing 'd' on an empty list THEN system SHALL do nothing gracefully.
- WHEN pressing 'u' multiple times THEN system SHALL undo actions in reverse chronological order up to the history limit.

---

## Requirement Traceability

| Requirement ID | Story       | Phase  | Status  |
| -------------- | ----------- | ------ | ------- |
| CAL-KEY-01      | P1: Delete | Specify | Pending |
| CAL-KEY-02      | P1: Undo/Redo | Specify | Pending |

**Coverage:** 2 total, 0 mapped to tasks, 2 unmapped ⚠️

---

## Success Criteria

How we know the feature is successful:

- [ ] User can press 'd' to delete items in the weekly calendar view.
- [ ] User can press 'd' to delete items in the today calendar view.
- [ ] User can press 'u' to undo calendar deletions.
- [ ] User can press 'ctrl+r' to redo calendar deletions.
