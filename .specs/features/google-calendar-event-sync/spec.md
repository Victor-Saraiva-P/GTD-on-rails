# Google Calendar Event Sync Specification

## Problem Statement

Google Calendar event mirroring currently happens after database commit but still on the HTTP request thread. Calendar actions feel slow because the UI waits for Google API calls before the local workflow can continue. GTD local persistence must be the source of truth, and Google Calendar must become an asynchronous derived mirror with visible global sync status.

## Goals
- [x] Create or update Google events after stuff is converted to a GTD calendar item.

- [x] Move Google events between Calendar, On Going, and Done calendars as GTD status changes.
- [x] Keep Google Calendar as derived state from GTD without supporting edits from Google.
- [x] Return local GTD mutations without waiting for Google Calendar API calls.
- [x] Show Google Calendar mirror state in the existing global sync status bar.
- [x] Keep inbox processing responsive by avoiding a full inbox reload after successful local conversion.

## Out of Scope

| Feature | Reason |
| --- | --- |
| Reading edits from Google Calendar | The user guarantees GTD is the source of truth |
| Concurrent conflict reconciliation | Single-owner workflow excludes divergent concurrent edits |
| Durable Google sync jobs across app restarts | The user will not close the app while any sync indicator is not green |
| Per-item Google sync status markers | Global status bar is enough for the first implementation |
| Calendar body mirroring to Google event descriptions | Current Google event payload mirrors title and schedule only |

## User Stories

### P1: Sync active calendar items

**User Story**: As the GTD user, I want a newly processed calendar item to appear in my Google Calendar agenda so that my scheduled commitments are visible there.

**Acceptance Criteria**:

1. WHEN stuff becomes a calendar THEN the system SHALL upsert a Google event in the "Calendar" Google calendar.
2. WHEN the calendar has only `scheduledDate` THEN the Google event SHALL be all-day on that date.
3. WHEN the calendar has `scheduledTime` THEN the Google event SHALL start at that local time and end 30 minutes later.
4. WHEN `scheduledDate` or `scheduledTime` is updated THEN the system SHALL redo the same upsert behavior.

### P1: Sync ongoing calendar items

**User Story**: As the GTD user, I want an ongoing calendar item to move into my On Going agenda so that current work is visible there.

**Acceptance Criteria**:

1. WHEN a calendar item is marked ongoing THEN the system SHALL upsert the event in the "On Going" Google calendar.
2. WHEN moving to ongoing THEN the system SHALL remove the matching event from the "Calendar" Google calendar.
3. WHEN creating the ongoing event THEN the system SHALL use the same `scheduledDate` and optional `scheduledTime` rules as active calendar items.

### P1: Sync done calendar items

**User Story**: As the GTD user, I want a done calendar item to move into my Done agenda using the actual schedule window so that completion history is accurate.

**Acceptance Criteria**:

1. WHEN a calendar item is marked done THEN the system SHALL upsert the event in the "Done" Google calendar.
2. WHEN moving to done THEN the system SHALL remove the matching event from "Calendar" and "On Going" Google calendars.
3. WHEN the schedule window is all-day THEN the Google event SHALL also be all-day.
4. WHEN the schedule window has start and end dates and times THEN the Google event SHALL use those exact start and end values.

### P1: Queue Google event mirror work

**User Story**: As the GTD user, I want calendar actions to complete after local persistence so that Vim-like workflows stay responsive.

**Acceptance Criteria**:

1. WHEN a calendar conversion, schedule edit, status change, delete, recover, restore, or title edit commits locally THEN the system SHALL enqueue Google mirror work and return without waiting for Google API completion.
2. WHEN multiple pending operations target the same calendar item THEN the queue SHALL keep the latest pending intent for that item.
3. WHEN an upsert operation executes THEN the worker SHALL load the latest active calendar state from the database before calling Google.
4. WHEN a delete operation executes THEN the worker SHALL delete the derived event from all GTD Google calendars using the item id.
5. WHEN delete and recover happen close together THEN the latest committed intent SHALL win.

### P1: Report global Google sync status

**User Story**: As the GTD user, I want to see whether Google Calendar mirroring is synced, pending, running, failed, or disabled so that I know when it is safe to close the app.

**Acceptance Criteria**:

1. WHEN Google sync work is queued THEN `/sync/status` SHALL expose Google Calendar as pending or syncing.
2. WHEN Google sync succeeds THEN `/sync/status` SHALL expose the latest success time and clear the last error.
3. WHEN Google sync fails after bounded retries THEN `/sync/status` SHALL expose failed state and the last error.
4. WHEN the desktop renders sync indicators THEN it SHALL include the provided Google Calendar icon.

### P1: Keep inbox processing responsive

**User Story**: As the GTD user, I want processed stuff to disappear from the inbox as soon as the local conversion succeeds so that I can keep processing.

**Acceptance Criteria**:

1. WHEN stuff converts to a calendar successfully THEN the frontend SHALL remove that stuff locally without fetching the full inbox list.
2. WHEN the local conversion request fails THEN the stuff SHALL remain visible in the inbox.
3. WHEN Google Calendar sync later fails THEN the item SHALL remain a calendar and the global Google sync indicator SHALL show the failure.

## Edge Cases

- WHEN Google Calendar is not connected or GTD Google calendars are not created THEN local GTD persistence SHALL still succeed and external sync SHALL be skipped.
- WHEN a target Google event already exists THEN sync SHALL update it instead of creating a duplicate.
- WHEN a stale event exists in a previous GTD calendar THEN sync SHALL delete it from that previous calendar.
- WHEN Google Calendar API fails transiently THEN sync SHALL retry with bounded backoff before reporting failure.
- WHEN the app closes while Google sync is pending THEN pending work may be lost by design.

## Requirement Traceability

| Requirement ID | Story | Status |
| --- | --- | --- |
| GCE-01 | Active calendar item event upsert | Complete |
| GCE-02 | Active calendar timed/all-day mapping | Complete |
| GCE-03 | Ongoing calendar move | Complete |
| GCE-04 | Done calendar move | Complete |
| GCE-05 | Done schedule window mapping | Complete |
| GCE-06 | Skip external sync when integration unavailable | Complete |
| GCE-07 | Async Google sync queue after local commit | Complete |
| GCE-08 | Latest database state loaded for queued upserts | Complete |
| GCE-09 | Bounded retry and failure status | Complete |
| GCE-10 | Google Calendar status in global sync endpoint and footer | Complete |
| GCE-11 | Responsive inbox calendar conversion without full reload | Complete |

**Coverage:** 11 total, 11 complete.

## Success Criteria

- [x] Calendar conversion, schedule patches, ongoing, done, and reset status trigger the expected Google event sync behavior.
- [x] Existing local persistence behavior remains unchanged when Google integration is not ready.
- [x] Calendar mutations return without waiting for Google API calls.
- [x] The global footer shows Google Calendar mirror state.
- [x] Inbox processing removes converted stuff after local success without a full reload.
