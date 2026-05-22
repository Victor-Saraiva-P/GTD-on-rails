# Calendar Weekly View Tasks

## Implementation Breakdown

### 1. State Management (Navigation)
- [ ] **Task 1.1: Add Week Offset State**
  - **What:** Introduce `weekOffset` into `CalendarDataState` and `useCalendarQuery.ts`.
  - **Where:** `apps/desktop/src/features/calendar/useCalendarQuery.ts`
  - **Done when:** `fetchWeekCalendars` loads data offset by the correct number of weeks based on the `weekOffset` state.
  - **Reuses:** Existing API `fetchWeekCalendars(start: string)`.

- [ ] **Task 1.2: Controller Navigation Actions**
  - **What:** Add `loadPreviousWeek()` and `loadNextWeek()` to `useCalendarWorkspaceController`. Add logic for `moveCalendarColumnSelection` to handle moving between `mon`..`sun` and shifting the week offset when going beyond boundaries.
  - **Where:** `apps/desktop/src/features/calendar/useCalendarWorkspaceController.ts`
  - **Depends on:** Task 1.1
  - **Done when:** Controller exposes actions capable of resolving column boundary shifts.

### 2. Keybind Integration
- [ ] **Task 2.1: Implement `h` and `l` Keybinds**
  - **What:** Add `h` and `l` shortcuts in `buildPanelBindings` when `activeSubview === "weekly"`.
  - **Where:** `apps/desktop/src/pages/CalendarPage.tsx`
  - **Depends on:** Task 1.2
  - **Done when:** Pressing `h`/`l` focuses the correct adjacent day or triggers week shift.

### 3. UI and Layout
- [ ] **Task 3.1: Weekly Header & Grid Styling**
  - **What:** Add Month/Year header and vertical borders between columns.
  - **Where:** `apps/desktop/src/pages/CalendarPage.tsx` and associated CSS (if applicable, or inline classes).
  - **Done when:** The layout renders as a bordered grid with "Month Year" on top.

- [ ] **Task 3.2: Day Column Headers**
  - **What:** Update `WeeklyCalendarPanel` to render "Mon 24" format (day name left, numeric date right). Apply circular highlight for the current system date.
  - **Where:** `apps/desktop/src/pages/CalendarPage.tsx`
  - **Done when:** Dates dynamically calculate based on the current `weekOffset` Monday and highlight the current "today".

- [ ] **Task 3.3: Item Cards & Time Icons**
  - **What:** Ensure `CalendarList` elements display as rounded cards and show a clock icon if the item has scheduled hours.
  - **Where:** `apps/desktop/src/features/calendar/CalendarList.tsx` or `CalendarPage.tsx`
  - **Done when:** Calendar items visually match the mockup cards.
