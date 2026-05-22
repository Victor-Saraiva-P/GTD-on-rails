# Calendar Weekly View Refactor

## Context & Vision
Refactor the weekly calendar view to support horizontal navigation across days and weeks. The UI must be updated to a column-based grid layout, closely following the provided handwritten mockup. 

## Requirements

### Navigation & Logic
- **[REQ-01]** The system must track a `weekOffset` (or absolute date) for the weekly view to enable week-switching.
- **[REQ-02]** Users must be able to use `h` (left) and `l` (right) to shift focus between the days of the week (Monday through Sunday) in the `weekly` subview.
- **[REQ-03]** Pressing `h` while focused on the first day of the week (Monday) must load the previous week's data and place the user's focus on Sunday.
- **[REQ-04]** Pressing `l` while focused on the last day of the week (Sunday) must load the next week's data and place the user's focus on Monday.
- **[REQ-05]** Users must be able to use `j` (down) and `k` (up) to navigate through items vertically within a selected day column.
- **[REQ-06]** A week must always start on Monday and end on Sunday.

### User Interface
- **[REQ-07]** The top of the weekly view must display a Month/Year header (e.g., "November 2026") that matches the currently visible week.
- **[REQ-08]** The layout must use a grid of seven vertical columns, with borders separating each day.
- **[REQ-09]** Each column header must display the abbreviated day name (Mon, Tue, Wed, etc.) and the numeric date of the month, aligned to the right.
- **[REQ-10]** The numeric date corresponding to the current real-world date ("today") must be highlighted with a distinctive circular background indicator.
- **[REQ-11]** Calendar items within the columns must be rendered as rounded cards.
- **[REQ-12]** Calendar items with an associated time range must display a clock icon alongside the text `HH:MM - HH:MM`.

## Scope
- State: Update calendar query and workspace controllers to support week shifting.
- Keybinds: Add `h`/`l` bindings mapped to boundary-crossing day navigation.
- UI Components: Refactor `WeeklyCalendarPanel` and `CalendarViews` in `CalendarPage.tsx` to match the grid styling and header requirements.
