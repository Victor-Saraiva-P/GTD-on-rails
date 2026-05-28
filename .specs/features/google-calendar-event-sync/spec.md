# Google Calendar Event Sync Specification

## Problem Statement

The existing Google Calendar integration creates the GTD calendars but does not reflect GTD calendar items as Google events. Calendar items should be mirrored into the correct Google calendar whenever GTD processing or calendar status changes the scheduling data.

## Goals

- [x] Create or update Google events after stuff is converted to a GTD calendar item.
- [x] Move Google events between Calendar, On Going, and Done calendars as GTD status changes.
- [x] Keep Google Calendar as derived state from GTD without supporting edits from Google.

## Out of Scope

| Feature | Reason |
| --- | --- |
| Reading edits from Google Calendar | The user guarantees GTD is the source of truth |
| Concurrent conflict reconciliation | Single-owner workflow excludes divergent concurrent edits |
| Frontend changes | Sync is backend lifecycle behavior |

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

## Edge Cases

- WHEN Google Calendar is not connected or GTD Google calendars are not created THEN local GTD persistence SHALL still succeed and external sync SHALL be skipped.
- WHEN a target Google event already exists THEN sync SHALL update it instead of creating a duplicate.
- WHEN a stale event exists in a previous GTD calendar THEN sync SHALL delete it from that previous calendar.

## Requirement Traceability

| Requirement ID | Story | Status |
| --- | --- | --- |
| GCE-01 | Active calendar item event upsert | Complete |
| GCE-02 | Active calendar timed/all-day mapping | Complete |
| GCE-03 | Ongoing calendar move | Complete |
| GCE-04 | Done calendar move | Complete |
| GCE-05 | Done schedule window mapping | Complete |
| GCE-06 | Skip external sync when integration unavailable | Complete |

**Coverage:** 6 total, 6 mapped to tasks.

## Success Criteria

- [x] Calendar conversion, schedule patches, ongoing, done, and reset status trigger the expected Google event sync behavior.
- [x] Existing local persistence behavior remains unchanged when Google integration is not ready.
