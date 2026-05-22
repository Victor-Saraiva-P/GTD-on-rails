# Segmented Processing Calendar Date Specification

## Problem Statement

The processing calendar date step currently uses a native browser date input. That input displays and behaves according to browser/platform rules, which conflicts with the app's keyboard-first workflow and the desired Vim-like movement model.

The calendar date step should keep the current processing dialog appearance, but collect scheduled dates through a deterministic keyboard-only segmented control.

## Goals

- [ ] Display the scheduled date as `dd/mm/yyyy` in the processing calendar date step.
- [ ] Default the scheduled date to the local current date when the date step opens.
- [ ] Let the owner type day, month, and year without leaving the keyboard.
- [ ] Use `h` and `l` to move between date segments with wall behavior at the edges.
- [ ] Preserve the existing calendar conversion payload shape as `YYYY-MM-DD`.

## Out of Scope

| Feature | Reason |
| --- | --- |
| Backend calendar API changes | This is a desktop input behavior change only. |
| Date picker UI | The intended flow is keyboard-only. |
| Recurring dates or timezone conversion | The calendar feature stores one local scheduled date. |
| Mouse-first editing behavior | The target interaction is Vim-like keyboard input. |

---

## User Stories

### P1: Keyboard-Only Segmented Date Entry

**User Story**: As the project owner, I want to enter the scheduled date with only number keys and Vim-style segment movement so that processing stays fast and keyboard-centered.

**Why P1**: Processing is the main path from inbox stuff into GTD elements, and the date step should not interrupt the keyboard workflow.

**Acceptance Criteria**:

1. WHEN the user enters the calendar date processing step THEN the control SHALL display today's local date as `dd/mm/yyyy`.
2. WHEN the date step opens THEN the active segment SHALL be the day segment.
3. WHEN the user types a digit in a segment THEN the system SHALL overwrite that segment from the first typed digit.
4. WHEN the day segment receives two digits THEN focus SHALL move to month.
5. WHEN the month segment receives two digits THEN focus SHALL move to year.
6. WHEN the year segment receives four digits THEN focus SHALL move back to day.
7. WHEN the user presses `l` on day or month THEN focus SHALL move one segment right.
8. WHEN the user presses `l` on year THEN focus SHALL stay on year.
9. WHEN the user presses `h` on month or year THEN focus SHALL move one segment left.
10. WHEN the user presses `h` on day THEN focus SHALL stay on day.
11. WHEN the user presses `Backspace` THEN the system SHALL block the key and leave the date unchanged.
12. WHEN the user presses `Enter` with a valid date THEN the processing flow SHALL continue to scheduled time.
13. WHEN the user presses `Enter` with an impossible date THEN the processing flow SHALL stay on the date step and show an English inline error.
14. WHEN the user presses `Escape` THEN the processing flow SHALL keep existing back behavior and return to the initial processing step.
15. WHEN the user confirms a valid displayed date THEN the frontend SHALL store and submit it as `YYYY-MM-DD`.

**Independent Test**: Open processing from Inbox, choose Calendar, type a complete date using only digits, move between segments with `h` and `l`, press `Enter`, and verify the flow advances only after a valid date.

---

## Edge Cases

- WHEN the user types `31/02/2026` and presses `Enter` THEN the date step SHALL remain active and show an invalid-date message.
- WHEN the user types `29/02/2028` THEN the date SHALL be accepted because 2028 is a leap year.
- WHEN the user types `29/02/2026` THEN the date SHALL be rejected because 2026 is not a leap year.
- WHEN a segment contains only one typed digit THEN the date SHALL not be confirmable until the segment has its required length.
- WHEN the modal dialog is active THEN page-level keybinds outside the modal SHALL not run.

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| --- | --- | --- | --- |
| SPCD-01 | Keyboard-Only Segmented Date Entry | Tasks | Pending |
| SPCD-02 | Keyboard-Only Segmented Date Entry | Tasks | Pending |
| SPCD-03 | Keyboard-Only Segmented Date Entry | Tasks | Pending |
| SPCD-04 | Keyboard-Only Segmented Date Entry | Tasks | Pending |
| SPCD-05 | Keyboard-Only Segmented Date Entry | Tasks | Pending |

**Coverage**: 5 total, 5 mapped to tasks, 0 unmapped.

---

## Success Criteria

- [ ] The date step no longer uses a native browser `type="date"` input.
- [ ] The displayed date order is always `dd/mm/yyyy`.
- [ ] Typing digits advances through day, month, year, then returns to day.
- [ ] `h` and `l` move between segments with wall behavior.
- [ ] `Backspace` is blocked and does not mutate the date.
- [ ] Invalid dates block `Enter` locally.
- [ ] Valid dates continue to the optional scheduled time step and submit as `YYYY-MM-DD`.
- [ ] Desktop unit tests and type checks pass.
