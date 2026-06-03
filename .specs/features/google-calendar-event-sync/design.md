# Google Calendar Event Sync Design

**Spec**: `.specs/features/google-calendar-event-sync/spec.md`
**Status**: Approved for implementation

## Architecture Overview

Calendar mutation services keep saving local GTD state inside the existing transaction. After commit, they enqueue Google Calendar mirror work into an in-memory single-worker queue. The queue returns immediately to the request path, coalesces pending work by item id, executes one operation at a time, retries bounded failures, and exposes status through `/sync/status`.

```mermaid
graph TD
    A[Calendar mutation commits] --> B[AfterCommitExecutor]
    B --> C[GoogleCalendarEventQueueService]
    C --> D[GoogleCalendarEventSyncService]
    D --> E[CalendarRepository]
    D --> F[GoogleCalendarEventGateway]
    C --> G[/sync/status]
    G --> H[Desktop footer indicator]
```

## Code Reuse Analysis

| Component | Location | How to Use |
| --- | --- | --- |
| `AfterCommitExecutor` | `apps/api/src/main/java/com/gtdonrails/api/services` | Keep enqueue requests after local commit. |
| `GoogleCalendarEventSyncService` | `apps/api/src/main/java/com/gtdonrails/api/services` | Keep Google event mapping and gateway calls here. |
| `AssetSyncService` | `apps/api/src/main/java/com/gtdonrails/api/services` | Reuse in-memory status, pending/running loop, and shutdown pattern. |
| `SyncController` and `SyncStatusDto` | `apps/api/src/main/java/com/gtdonrails/api/controllers` | Extend global sync status response. |
| `SyncStatusIndicators` | `apps/desktop/src/features/sync-status` | Add a third indicator using `google-calendar-icon.png`. |
| `useInboxStuffsQuery` | `apps/desktop/src/features/inbox` | Replace full reload after processing with local removal. |

## Components

### GoogleCalendarEventQueueService

- **Purpose**: Accept fast enqueue requests and run Google mirror work outside HTTP request latency.
- **Location**: `apps/api/src/main/java/com/gtdonrails/api/services/GoogleCalendarEventQueueService.java`
- **Interfaces**:
  - `requestUpsert(UUID itemId): void`
  - `requestDelete(UUID itemId): void`
  - `status(): GoogleCalendarSyncStatusDto`
- **Dependencies**: `GoogleCalendarEventSyncService`, single-thread `ExecutorService`.
- **Reuses**: `AssetSyncService` pending/running/status approach.

### GoogleCalendarEventSyncService

- **Purpose**: Mirror one latest GTD calendar state into Google.
- **Location**: `apps/api/src/main/java/com/gtdonrails/api/services/GoogleCalendarEventSyncService.java`
- **Interfaces**:
  - `syncCalendarEvent(UUID itemId): void`
  - `deleteCalendarEvent(UUID itemId): void`
- **Dependencies**: `CalendarRepository`, `GoogleCalendarService`, `GoogleCalendarRepository`, `GoogleCalendarEventGateway`.
- **Reuses**: Existing calendar-to-Google event mapping.

### Sync Status API and Indicator

- **Purpose**: Surface Google mirror state in the existing global status bar.
- **Locations**: `SyncStatusDto`, `SyncController`, desktop `sync-status` files.
- **Interfaces**:
  - API adds `googleCalendar` status.
  - Desktop `SyncStatus` type adds `googleCalendar`.
- **Reuses**: Existing footer indicator tones and polling.

## Data Models

### GoogleCalendarSyncState

```java
public enum GoogleCalendarSyncState {
    DISABLED,
    SYNCED,
    PENDING,
    SYNCING,
    FAILED
}
```

### GoogleCalendarSyncStatusDto

```java
public record GoogleCalendarSyncStatusDto(
    GoogleCalendarSyncState state,
    boolean pending,
    boolean running,
    Instant lastStartedAt,
    Instant lastFinishedAt,
    Instant lastSuccessfulSyncAt,
    String lastError
) {}
```

## Error Handling Strategy

| Error Scenario | Handling | User Impact |
| --- | --- | --- |
| Google not configured | Sync service skips and status remains disabled or synced. | Local action succeeds. |
| Google API transient failure | Queue retries 3 attempts with short backoff. | Status may pulse, then recover. |
| Google API repeated failure | Queue stores last error and marks failed. | Footer Google indicator turns red. |
| Delete then recover | Pending upsert replaces pending delete, or later upsert recreates event after started delete. | Latest local state wins. |

## Tech Decisions

| Decision | Choice | Rationale |
| --- | --- | --- |
| Source of truth | Local GTD database | Google Calendar is a derived mirror. |
| Queue durability | In-memory only | User will not close while status is not green. |
| Coalescing | Latest pending item intent wins | Avoids wasted Google calls while preserving started work order. |
| Upsert payload | Load latest DB state at execution | Handles rapid edits and delete/recover correctly. |
| UI failure surface | Global status only | Avoids per-item clutter and matches existing sync UX. |
