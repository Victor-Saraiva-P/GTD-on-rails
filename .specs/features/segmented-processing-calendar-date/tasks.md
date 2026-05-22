# Segmented Processing Calendar Date Tasks

**Spec**: `.specs/features/segmented-processing-calendar-date/spec.md`  
**Design**: Not created; implementation follows the existing processing dialog and keyboard input patterns.  
**Status**: Draft

---

## Execution Plan

```text
T1 → T2 → T3
```

---

## Task Breakdown

### T1: Add Segmented Date Input State Helpers

**What**: Add pure helper functions for segmented date state, movement, digit input, display formatting, ISO conversion, and validation.  
**Where**: `apps/desktop/src/features/processing`  
**Depends on**: None  
**Reuses**: `nextClockTimeDigits`, `clockTimeDisplayValue`, and existing processing unit-test style  
**Requirement**: SPCD-01, SPCD-02, SPCD-03, SPCD-05

**Done when**:

- [ ] Helpers model `day`, `month`, and `year` as explicit segments.
- [ ] The local current date can initialize a segmented `dd/mm/yyyy` state.
- [ ] Digit input overwrites the focused segment from the first digit.
- [ ] Day and month auto-advance after 2 digits; year auto-advances after 4 digits.
- [ ] `h` and `l` move between segments with wall behavior.
- [ ] `Backspace` is represented as blocked/no-op behavior.
- [ ] Real calendar validation rejects impossible dates and handles leap years.
- [ ] Valid segmented state converts to `YYYY-MM-DD`.

**Tests**: Desktop unit  
**Gate**: `pnpm --filter @gtd-on-rails/desktop test`  
**Commit**: `feat(desktop): add segmented calendar date helpers`

---

### T2: Replace Calendar Date Step Input

**What**: Replace the native date input with a read-only segmented keyboard control in the processing dialog.  
**Where**: `ProcessingCalendarDateStep.tsx`, `processing-dialog.css`  
**Depends on**: T1  
**Reuses**: `ProcessingCalendarTimeStep` keyboard handling and dialog styling patterns  
**Requirement**: SPCD-01, SPCD-02, SPCD-03, SPCD-04, SPCD-05

**Done when**:

- [ ] The step displays `Scheduled date:` and a single terminal-style date control.
- [ ] The active segment is visually highlighted.
- [ ] The day segment is active when the step opens.
- [ ] Number keys, `h`, `l`, `Enter`, `Escape`, and `Backspace` follow the spec.
- [ ] Invalid dates show an English inline error and do not advance.
- [ ] Valid dates call `onDateSelected` with `YYYY-MM-DD`.
- [ ] The control keeps modal keyboard isolation by preventing event propagation.

**Tests**: Desktop unit/component or e2e  
**Gate**: `pnpm --filter @gtd-on-rails/desktop test` and `pnpm --filter @gtd-on-rails/desktop check`  
**Commit**: `feat(desktop): use segmented calendar date input`

---

### T3: Add Processing Acceptance Coverage

**What**: Extend processing coverage for the keyboard-only date flow.  
**Where**: `apps/desktop/test`, optionally `apps/desktop/e2e/processing-flow.spec.ts`  
**Depends on**: T2  
**Reuses**: Existing processing flow tests and Playwright support helpers  
**Requirement**: SPCD-01, SPCD-02, SPCD-03, SPCD-04, SPCD-05

**Done when**:

- [ ] Tests verify default `dd/mm/yyyy` display for the date step.
- [ ] Tests verify digit auto-advance through day, month, year, and back to day.
- [ ] Tests verify `h` and `l` segment movement.
- [ ] Tests verify `Backspace` leaves the date unchanged.
- [ ] Tests verify invalid dates block `Enter`.
- [ ] Tests verify a valid date advances to scheduled time and preserves `YYYY-MM-DD` payload behavior.

**Tests**: Desktop unit/e2e  
**Gate**: `pnpm --filter @gtd-on-rails/desktop test`, `pnpm --filter @gtd-on-rails/desktop check`, and `pnpm test` before merge  
**Commit**: `test(desktop): cover segmented processing date input`
