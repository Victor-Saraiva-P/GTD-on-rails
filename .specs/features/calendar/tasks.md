# Calendar GTD Element Tasks

**Spec**: `.specs/features/calendar/spec.md`  
**Design**: Not created; implementation follows existing inbox and next-action architecture.  
**Status**: Draft

---

## Execution Plan

### Phase 1: Foundation

Backend persistence and vocabulary can start independently.

```text
T1
T11
```

### Phase 2: Backend Calendar API

```text
T1 → T2 → T3 → T4
          └──→ T5
```

### Phase 3: Desktop Calendar Flow

```text
T4 + T5 + T11 → T6 → T7
                 └→ T8 → T9
                 └→ T10
```

### Phase 4: Acceptance Coverage

```text
T7 + T9 + T10 → T12
```

---

## Task Breakdown

### T1: Add Calendar Persistence Model [P]

**What**: Add the backend calendar subtype persistence model, status enum, and item conversion hook.  
**Where**: `apps/api/src/main/java/com/gtdonrails/api/entities`, `apps/api/src/main/java/com/gtdonrails/api/enums`, `apps/api/src/main/resources/db/migration`  
**Depends on**: None  
**Reuses**: `Item`, `NextAction`, `NextActionStatus`, `ScheduleWindow` patterns  
**Requirement**: CAL-01, CAL-02, CAL-03

**Tools**:

- MCP: NONE
- Skill: `tlc-spec-driven`

**Done when**:

- [x] Migration creates a `calendars` table linked one-to-one to `items`.
- [x] `CalendarStatus` supports `CALENDAR`, `ONGOING`, and `DONE`.
- [x] `Calendar` stores required `scheduledDate`, optional `scheduledTime`, and schedule start/end data.
- [x] `ItemStatus` supports `CALENDAR`.
- [x] `Item.convertToCalendar(date, time)` only converts active stuff.
- [x] Entity tests cover date requirement, optional time, status transitions, restore, and item conversion.

**Tests**: API unit  
**Gate**: `pnpm --filter @gtd-on-rails/api test`  
**Commit**: `feat(api): add calendar persistence model`

---

### T2: Add Calendar DTOs, Mapper, and Repository

**What**: Add typed API request/response shapes and persistence access for calendar items.  
**Where**: `apps/api/src/main/java/com/gtdonrails/api/dtos`, `apps/api/src/main/java/com/gtdonrails/api/mappers`, `apps/api/src/main/java/com/gtdonrails/api/repositories`  
**Depends on**: T1  
**Reuses**: `NextActionResponseDto`, `PatchNextActionRequestDto`, `NextActionMapper`, `NextActionRepository` patterns  
**Requirement**: CAL-01, CAL-06, CAL-09, CAL-10

**Tools**:

- MCP: NONE
- Skill: `tlc-spec-driven`

**Done when**:

- [x] Calendar response includes id, title, body, scheduled date, optional scheduled time, status, and schedule data.
- [x] Calendar conversion request validates required date and optional `HH:mm` time.
- [x] Calendar patch request supports scheduled date/time edits.
- [x] Repository methods support today due/late, done today, weekly range, completed, deleted, and ongoing queries.
- [x] Mapper/repository tests cover response shape and query filters.

**Tests**: API unit/integration  
**Gate**: `pnpm --filter @gtd-on-rails/api test`  
**Commit**: `feat(api): add calendar data contracts`

---

### T3: Implement Calendar Service Behavior

**What**: Implement calendar listing, editing, status transitions, restore, delete/recover support, and sync requests.  
**Where**: `apps/api/src/main/java/com/gtdonrails/api/services/CalendarService.java`  
**Depends on**: T2  
**Reuses**: `NextActionService`, `InboxService`, `ItemService`, `PersistenceGitSyncService` patterns  
**Requirement**: CAL-01, CAL-03, CAL-06, CAL-07, CAL-09, CAL-10

**Tools**:

- MCP: NONE
- Skill: `tlc-spec-driven`

**Done when**:

- [x] Service returns due/late calendars for Today panel `(1)`.
- [x] Service returns done-today calendars from schedule end date for Today panel `(2)`.
- [x] Service returns seven-day weekly data by local date range.
- [x] Service returns completed, deleted, and ongoing calendars.
- [x] Service marks calendars ongoing, done, restored, patched, deleted, and recovered.
- [x] Service requests persistence sync after mutating transactions.
- [x] Service tests cover filters, transitions, restore behavior, and sync request calls.

**Tests**: API unit  
**Gate**: `pnpm --filter @gtd-on-rails/api test`  
**Commit**: `feat(api): implement calendar service`

---

### T4: Expose Calendar API Endpoints

**What**: Add REST endpoints for calendar queries and mutations.  
**Where**: `apps/api/src/main/java/com/gtdonrails/api/controllers/CalendarController.java`  
**Depends on**: T3  
**Reuses**: `NextActionController`, `InboxController`, `ItemController` patterns  
**Requirement**: CAL-01, CAL-03, CAL-06, CAL-09, CAL-10

**Tools**:

- MCP: NONE
- Skill: `tlc-spec-driven`

**Done when**:

- [x] `GET /calendars/today` returns due/late calendars.
- [x] `GET /calendars/done/today` returns calendars completed today.
- [x] `GET /calendars/week?start=YYYY-MM-DD` returns seven local dates.
- [x] `GET /calendars/done`, `/deleted`, and `/ongoing` return matching states.
- [x] `PATCH /calendars/{id}` updates scheduled date/time.
- [x] `POST /calendars/{id}/ongoing`, `/done`, `/restore`, and `/recover` perform status/recovery changes.
- [x] Controller tests cover success and validation error paths.

**Tests**: API integration  
**Gate**: `pnpm --filter @gtd-on-rails/api test`  
**Commit**: `feat(api): expose calendar endpoints`

---

### T5: Add Inbox-to-Calendar Conversion

**What**: Add the API conversion path from active stuff into a calendar item.  
**Where**: `InboxController`, `InboxService`, calendar conversion DTOs/tests  
**Depends on**: T2, T3  
**Reuses**: Existing `/inbox/{id}/next-action` conversion flow  
**Requirement**: CAL-04, CAL-05

**Tools**:

- MCP: NONE
- Skill: `tlc-spec-driven`

**Done when**:

- [x] `POST /inbox/{id}/calendar` accepts scheduled date and optional scheduled time.
- [x] Conversion rejects deleted, missing, or non-stuff items.
- [x] Conversion persists `ItemStatus.CALENDAR` and matching calendar metadata.
- [x] Conversion requests persistence sync after commit.
- [x] Controller/service tests cover success, missing date, malformed time, and invalid item states.

**Tests**: API unit/integration  
**Gate**: `pnpm --filter @gtd-on-rails/api test`  
**Commit**: `feat(api): convert stuff into calendar`

---

### T6: Add Desktop Calendar API, Types, and Theme

**What**: Add frontend calendar data contracts, API client functions, and list theme colors/icons.  
**Where**: `apps/desktop/src/features/calendar`, `apps/desktop/src/features/lists/listThemes.ts`  
**Depends on**: T4, T5  
**Reuses**: `next-actions/api.ts`, `next-actions/types.ts`, `inbox/api.ts`, existing list theme constants  
**Requirement**: CAL-01, CAL-06, CAL-07, CAL-08, CAL-09, CAL-10

**Tools**:

- MCP: NONE
- Skill: `tlc-spec-driven`

**Done when**:

- [x] Calendar type models scheduled date, optional time, status, schedule, title, and body.
- [x] API client exposes fetch today, done today, week, done, deleted, ongoing, patch, status transition, recover, and inbox conversion functions.
- [x] Calendar theme uses Inbox red as the principal accent.
- [x] Completed calendar panel styling uses completed next-actions green.
- [x] Calendar item icon text is `C`.
- [x] Unit tests cover API request paths, response mapping, and theme constants.

**Tests**: Desktop unit  
**Gate**: `pnpm --filter @gtd-on-rails/desktop test` and `pnpm --filter @gtd-on-rails/desktop check`  
**Commit**: `feat(desktop): add calendar api types`

---

### T7: Add Calendar Processing Flow

**What**: Extend the processing dialog with calendar selection, date step, optional time step, and final-only persistence.  
**Where**: `apps/desktop/src/features/processing`, `apps/desktop/src/features/inbox`  
**Depends on**: T6  
**Reuses**: `ProcessingDialog`, `ProcessingInitialStep`, `ProcessingTimeStep`, `useInboxWorkspaceController` patterns  
**Requirement**: CAL-04, CAL-05

**Tools**:

- MCP: NONE
- Skill: `tlc-spec-driven`

**Done when**:

- [x] Initial processing step offers `n Next actions` and `c Calendar`.
- [x] Calendar flow asks for scheduled date, then optional scheduled time.
- [x] `Escape` cancels on the initial step and goes back on later steps.
- [x] Previous compatible choices are preserved when moving backward.
- [x] API conversion is called only after the optional time step is confirmed.
- [x] Unit tests cover keyboard flow, cancellation/back behavior, and payload.

**Tests**: Desktop unit  
**Gate**: `pnpm --filter @gtd-on-rails/desktop test` and `pnpm --filter @gtd-on-rails/desktop check`  
**Commit**: `feat(desktop): process stuff into calendar`

---

### T8: Build Calendar Workspace Controller and Detail Rendering

**What**: Add calendar selection, editing, asset preloading, status actions, and detail rendering without status in the detail view.  
**Where**: `apps/desktop/src/features/calendar`, `apps/desktop/src/pages`  
**Depends on**: T6, T11  
**Reuses**: `useNextActionsWorkspaceController`, `useArchivedNextActionsWorkspaceController`, `InboxStuffDetails` patterns  
**Requirement**: CAL-06, CAL-07, CAL-08, CAL-09

**Tools**:

- MCP: NONE
- Skill: `tlc-spec-driven`

**Done when**:

- [x] Calendar controller tracks active subview, active panel, selected calendar, title edit, body edit, and Vim mode.
- [x] Calendar Detail View renders title, scheduled date, optional time, and body, but not status.
- [x] Title/body edits persist through item endpoints.
- [x] Calendar body uses existing rich body and asset rendering.
- [x] Unit tests cover selection, panel focus, detail metadata, and omitted status.

**Tests**: Desktop unit  
**Gate**: `pnpm --filter @gtd-on-rails/desktop test` and `pnpm --filter @gtd-on-rails/desktop check`  
**Commit**: `feat(desktop): add calendar workspace state`

---

### T9: Add Calendars Page, Subviews, and Keybindings

**What**: Add the `Space c` Calendars page with Today, Weekly, Completed, Deleted, and focused detail navigation.  
**Where**: `apps/desktop/src/pages`, `apps/desktop/src/features/keybinds`, calendar styles  
**Depends on**: T8  
**Reuses**: `NextActionsPage`, `ArchivedNextActionsPage`, `AppShell`, `ListWorkspace` patterns  
**Requirement**: CAL-06, CAL-07, CAL-08, CAL-09

**Tools**:

- MCP: NONE
- Skill: `tlc-spec-driven`

**Done when**:

- [x] `Space c` opens Calendars and does not conflict with `Space C` contexts.
- [x] Today View shows panel `(1)` due/late calendars and panel `(2)` done-today calendars.
- [x] `1` and `2` focus Today panels.
- [x] `j/k`, `d`, `x`, `o`, `r`, `l`, `Enter`, `Space Enter`, and `Space k` follow established scope rules.
- [x] Weekly subview renders seven Monday-Sunday columns.
- [x] Completed and Deleted subviews support restore/recover behavior.
- [x] Empty/loading/error states are English.
- [x] Unit tests cover keybind registration and subview/panel rendering behavior.

**Tests**: Desktop unit  
**Gate**: `pnpm --filter @gtd-on-rails/desktop test` and `pnpm --filter @gtd-on-rails/desktop check`  
**Commit**: `feat(desktop): add calendars page`

---

### T10: Combine On Going Next Actions and Calendars

**What**: Reform the On Going page so panel `(1)` shows next actions and panel `(2)` shows calendars.  
**Where**: `OnGoingNextActionsPage`, on going controllers, calendar feature state  
**Depends on**: T6, T11  
**Reuses**: Existing on going next-action page and controller patterns  
**Requirement**: CAL-10

**Tools**:

- MCP: NONE
- Skill: `tlc-spec-driven`

**Done when**:

- [x] `Space o` opens a combined On Going page.
- [x] Panel `(1)` lists ongoing next actions.
- [x] Panel `(2)` lists ongoing calendars.
- [x] `1` and `2` switch panel focus with independent selection state.
- [x] Detail area adapts to selected item type.
- [x] Restore sends next actions back to next action status and calendars back to calendar status.
- [x] Unit tests cover panel switching, selection preservation, detail type, done, delete, and restore actions.

**Tests**: Desktop unit  
**Gate**: `pnpm --filter @gtd-on-rails/desktop test` and `pnpm --filter @gtd-on-rails/desktop check`  
**Commit**: `feat(desktop): combine ongoing work panels`

---

### T11: Refactor View and Panel Vocabulary [P]

**What**: Rename top-level UI/documentation vocabulary from panel to view, while reserving panel for nested subdivisions.  
**Where**: `docs`, `apps/desktop/src/components`, top-level page components and styles  
**Depends on**: None  
**Reuses**: Existing `ListPane`, `Pane`, and docs wording as migration targets  
**Requirement**: CAL-11

**Tools**:

- MCP: NONE
- Skill: `tlc-spec-driven`

**Done when**:

- [x] Docs call top-level areas views and nested subdivisions panels.
- [x] User-facing labels/help text use view vocabulary for top-level areas.
- [x] Reusable top-level layout components use view naming.
- [x] Nested Calendar Today and On Going subdivisions use panel naming.
- [x] Existing styling remains visually unchanged after rename.
- [x] Tests and imports are updated without broad unrelated refactors.

**Tests**: Desktop unit and docs search  
**Gate**: `pnpm --filter @gtd-on-rails/desktop test`, `pnpm --filter @gtd-on-rails/desktop check`, and `rg -n "Panel|panel" docs apps/desktop/src` reviewed for intentional hits  
**Commit**: `docs: clarify view and panel vocabulary`

---

### T12: Add End-to-End Calendar Acceptance Coverage

**What**: Add Playwright coverage for the main calendar user flows and run final gates.  
**Where**: `apps/desktop/e2e`, `apps/desktop/e2e/support`  
**Depends on**: T7, T9, T10  
**Reuses**: `processing-flow.spec.ts`, `cross-screen-navigation.spec.ts`, `support/app.ts` patterns  
**Requirement**: CAL-04, CAL-05, CAL-06, CAL-07, CAL-08, CAL-09, CAL-10

**Tools**:

- MCP: NONE
- Skill: `tlc-spec-driven`

**Done when**:

- [ ] E2E creates stuff, processes it into a calendar, and verifies it appears under `Space c`.
- [ ] E2E verifies late and today calendars appear in Today panel `(1)`.
- [ ] E2E marks a calendar ongoing and verifies it appears in On Going panel `(2)`.
- [ ] E2E marks a calendar done and verifies it appears in Today panel `(2)` when completed today.
- [ ] E2E verifies weekly, completed, and deleted subviews.
- [ ] Full gates pass with no silent test deletions.

**Tests**: Desktop e2e and full suite  
**Gate**: `pnpm test`, `pnpm --filter @gtd-on-rails/desktop check`, `pnpm --filter @gtd-on-rails/api test`  
**Commit**: `test: cover calendar gtd flows`

---

## Parallel Execution Map

```text
Phase 1:
  T1 [P]
  T11 [P]

Phase 2:
  T1 ─→ T2 ─→ T3 ─→ T4
             └────→ T5

Phase 3:
  T4 + T5 + T11 ─→ T6 ─→ T7
                     ├→ T8 ─→ T9
                     └→ T10

Phase 4:
  T7 + T9 + T10 ─→ T12
```

---

## Validation

### Task Granularity Check

| Task | Atomic deliverable | Status |
| --- | --- | --- |
| T1 | Calendar persistence model | Pass |
| T2 | Calendar API data contracts | Pass |
| T3 | Calendar business service | Pass |
| T4 | Calendar REST controller | Pass |
| T5 | Inbox-to-calendar conversion | Pass |
| T6 | Desktop calendar API/types/theme | Pass |
| T7 | Processing calendar path | Pass |
| T8 | Calendar workspace/detail state | Pass |
| T9 | Calendars page/subviews/keybinds | Pass |
| T10 | Combined On Going panels | Pass |
| T11 | View/panel vocabulary migration | Pass |
| T12 | Calendar E2E acceptance coverage | Pass |

### Diagram-Definition Cross-Check

| Task | Depends on field | Diagram dependency | Status |
| --- | --- | --- | --- |
| T1 | None | None | Pass |
| T2 | T1 | T1 → T2 | Pass |
| T3 | T2 | T2 → T3 | Pass |
| T4 | T3 | T3 → T4 | Pass |
| T5 | T2, T3 | T2/T3 → T5 | Pass |
| T6 | T4, T5 | T4/T5/T11 → T6 | Pass |
| T7 | T6 | T6 → T7 | Pass |
| T8 | T6, T11 | T6/T11 → T8 | Pass |
| T9 | T8 | T8 → T9 | Pass |
| T10 | T6, T11 | T6/T11 → T10 | Pass |
| T11 | None | None | Pass |
| T12 | T7, T9, T10 | T7/T9/T10 → T12 | Pass |

### Test Co-Location Validation

| Task | Code layer | Tests co-located in task | Gate |
| --- | --- | --- | --- |
| T1 | API entity/migration | Entity/unit tests | `pnpm --filter @gtd-on-rails/api test` |
| T2 | API DTO/mapper/repository | Mapper/repository tests | `pnpm --filter @gtd-on-rails/api test` |
| T3 | API service | Service tests | `pnpm --filter @gtd-on-rails/api test` |
| T4 | API controller | Controller tests | `pnpm --filter @gtd-on-rails/api test` |
| T5 | API inbox conversion | Inbox service/controller tests | `pnpm --filter @gtd-on-rails/api test` |
| T6 | Desktop API/types/theme | Desktop unit tests | `pnpm --filter @gtd-on-rails/desktop test` |
| T7 | Desktop processing | Desktop unit tests | `pnpm --filter @gtd-on-rails/desktop test` |
| T8 | Desktop state/detail | Desktop unit tests | `pnpm --filter @gtd-on-rails/desktop test` |
| T9 | Desktop page/keybinds | Desktop unit tests | `pnpm --filter @gtd-on-rails/desktop test` |
| T10 | Desktop on going page | Desktop unit tests | `pnpm --filter @gtd-on-rails/desktop test` |
| T11 | Docs/component vocabulary | Desktop unit tests and `rg` review | `pnpm --filter @gtd-on-rails/desktop check` |
| T12 | Cross-layer user flows | E2E tests | `pnpm test` |

---

## Notes

- `.specs/codebase/TESTING.md` does not exist, so gates are inferred from `package.json`, app package scripts, and execution docs.
- `design.md` does not exist; these tasks intentionally reuse the established inbox and next-action architecture rather than introducing a new design layer.
- Before execution, confirm whether any task should use a specialized tool or skill beyond the default filesystem/editing workflow and `tlc-spec-driven`.
