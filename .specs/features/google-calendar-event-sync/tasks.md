# Google Calendar Event Sync Tasks

**Design**: `.specs/features/google-calendar-event-sync/design.md`
**Status**: Complete

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

## T3: Add in-memory Google event queue

**Status:** Complete

**Requirements:** GCE-07, GCE-08, GCE-09

**What:** Add an in-memory single-worker queue and status DTO for Google Calendar event sync.

**Where:** `apps/api/src/main/java/com/gtdonrails/api/services`, `apps/api/src/main/java/com/gtdonrails/api/dtos/sync`, `apps/api/src/test/java/com/gtdonrails/api/services`

**Done when:**

- Enqueue returns before Google gateway work executes.
- Pending work for the same item keeps the latest pending operation.
- Upsert execution loads the latest active calendar from the database.
- Delete execution uses the item id and removes all GTD Google events.
- Failed work retries 3 attempts before marking failed.

**Tests:** API unit tests with named fake queue dependencies.

**Gate:** `pnpm --filter @gtd-on-rails/api unitTest`

## T4: Route calendar lifecycle sync through the queue

**Status:** Complete

**Requirements:** GCE-07, GCE-08

**What:** Replace direct after-commit Google sync calls with queue enqueue calls.

**Where:** `InboxService`, `CalendarService`, `ItemService`, related tests

**Done when:**

- Conversion, schedule edit, status changes, recover, restore, delete, and title edits enqueue the correct Google operation after local commit.
- Body-only edits do not enqueue Google sync.
- Existing persistence sync behavior is unchanged.

**Tests:** API unit tests for service enqueue behavior.

**Gate:** `pnpm --filter @gtd-on-rails/api unitTest`

## T5: Expose Google Calendar sync status

**Status:** Complete

**Requirements:** GCE-10

**What:** Add Google Calendar status to `/sync/status` and desktop sync status types/indicator.

**Where:** `SyncStatusDto`, `SyncController`, `apps/desktop/src/features/sync-status`, `apps/desktop/src/assets/next-actions/google-calendar-icon.png`

**Done when:**

- `/sync/status` includes `googleCalendar`.
- Desktop types parse `googleCalendar`.
- Footer shows a Google Calendar indicator using the provided PNG.
- Tooltip includes state, last success, and last error.

**Tests:** API controller/unit tests and desktop unit tests where existing coverage applies.

**Gate:** `pnpm --filter @gtd-on-rails/api unitTest && pnpm --filter @gtd-on-rails/desktop test`

## T6: Make inbox calendar conversion remove locally after backend success

**Status:** Complete

**Requirements:** GCE-11

**What:** Avoid full inbox reload after successful process-to-calendar or process-to-next-action mutation.

**Where:** `apps/desktop/src/features/inbox/useInboxStuffsQuery.ts`, `apps/desktop/test`

**Done when:**

- Successful calendar conversion removes the processed stuff from local state without fetching the full inbox.
- Failed conversion leaves the stuff visible.
- Existing next-action processing remains correct.

**Tests:** Desktop unit test for local removal behavior.

**Gate:** `pnpm --filter @gtd-on-rails/desktop test`
