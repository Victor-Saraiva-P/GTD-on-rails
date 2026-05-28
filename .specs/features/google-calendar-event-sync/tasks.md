# Google Calendar Event Sync Tasks

## T1: Add Google event sync port and service

**Status:** Complete

**Requirements:** GCE-01, GCE-02, GCE-03, GCE-04, GCE-05, GCE-06

**What:** Add a project-owned Google event gateway and a calendar event sync service that maps GTD calendar state to Google event upsert/delete operations.

**Where:** `apps/api/src/main/java/com/gtdonrails/api/services`

**Done when:**

- Calendar and On Going events use `scheduledDate` and optional `scheduledTime`, with timed events ending 30 minutes after start.
- Done events use `ScheduleWindow`, preserving all-day windows and exact timed start/end values.
- Sync skips when credentials or GTD Google calendar IDs are unavailable.
- Previous-status Google events are deleted during status moves.

**Tests:** API unit tests with a named fake Google event gateway.

**Gate:** `pnpm --filter @gtd-on-rails/api unitTest`

## T2: Invoke event sync from calendar lifecycle changes

**Status:** Complete

**Requirements:** GCE-01, GCE-03, GCE-04, GCE-06

**What:** Call the sync service after stuff-to-calendar conversion and calendar patch/status updates.

**Where:** `InboxService`, `CalendarService`, related unit/integration tests

**Done when:**

- Conversion syncs a Calendar-status item.
- Schedule patch and reset status sync Calendar-status state.
- Mark ongoing and mark done sync the target status.
- Existing controller flows still pass.

**Tests:** API unit tests and integration tests updated for the new dependency.

**Gate:** `pnpm --filter @gtd-on-rails/api test`
