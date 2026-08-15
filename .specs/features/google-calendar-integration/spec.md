# Google Calendar Integration Specification

## Problem Statement

The GTD-on-Rails app needs to integrate with Google Calendar so that GTD elements can eventually be reflected as calendar events. This first phase establishes the connection infrastructure: credential configuration, OAuth2 authorization, and creation of the four GTD-mapped Google Calendars with correct colors. No event syncing yet — just the plumbing.

## Goals

- [ ] Provide a dedicated integration page where the user can see and manage the Google Calendar connection
- [ ] Allow the user to configure Google OAuth client credentials from the UI
- [ ] Implement OAuth2 authorization flow for installed desktop apps
- [ ] Create four GTD-mapped Google Calendars with colors matching existing page themes
- [ ] Store OAuth tokens encrypted in the PostgreSQL database

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature                              | Reason                                           |
| ------------------------------------ | ------------------------------------------------ |
| GTD element ↔ Google Calendar sync   | Phase 2 — requires this infrastructure first     |
| Multi-user support                   | Single-owner app per project rules                |
| Cross-platform OAuth (Windows/macOS) | Arch Linux only per project rules                 |
| Google Calendar event CRUD           | Phase 2 — this phase only creates calendars       |
| Disconnect / revoke flow             | Can be added later; user can revoke via Google UI |

---

## User Stories

### P1: Integration Status Page ⭐ MVP

**ID**: GCAL-01

**User Story**: As the GTD user, I want a dedicated page showing the status of my Google Calendar integration so that I can see at a glance whether credentials are configured, whether I'm connected, and whether the GTD calendars exist.

**Why P1**: Without this page, the user has no entry point into the integration.

**Acceptance Criteria**:

1. WHEN the user presses `Space I g` from any screen THEN the app SHALL navigate to the Google Calendar integration page
2. WHEN the integration page loads THEN it SHALL display three status sections: Client Credentials, Connection Status, and Calendars
3. WHEN client credentials file does not exist THEN the Credentials section SHALL show "Not configured" with a hint to press `s`
4. WHEN client credentials file exists THEN the Credentials section SHALL show "Configured"
5. WHEN OAuth tokens do not exist in the database THEN Connection Status SHALL show "Disconnected" with a hint to press `c`
6. WHEN valid OAuth tokens exist THEN Connection Status SHALL show "Connected"
7. WHEN the user presses `Escape` THEN the app SHALL navigate back to the previous screen

**Independent Test**: Navigate to the page via `Space I g`, verify all three sections render with correct status indicators.

---

### P1: Client Credentials Setup ⭐ MVP

**ID**: GCAL-02

**User Story**: As the GTD user, I want to input my Google OAuth client ID and secret directly in the app so that I don't have to manually create config files on disk.

**Why P1**: The OAuth flow cannot start without client credentials. Manual file creation is poor UX.

**Acceptance Criteria**:

1. WHEN the user presses `s` on the integration page THEN the app SHALL open an inline form with fields for Client ID and Client Secret
2. WHEN the user submits the form with both fields filled THEN the backend SHALL create `config/google.properties` in the data directory with the provided values
3. WHEN the file is created successfully THEN the Credentials status SHALL update to "Configured" and the `c` keybind to connect SHALL become available
4. WHEN the user submits the form with empty fields THEN the app SHALL show a validation error
5. WHEN the user presses `Escape` in the credentials form THEN the form SHALL close without saving
6. WHEN `config/google.properties` already exists THEN pressing `s` SHALL open the form pre-filled with the current values for editing

**Independent Test**: Press `s`, enter credentials, verify the file is created at `{data-root}/config/google.properties` with correct content.

---

### P1: OAuth2 Connection Flow ⭐ MVP

**ID**: GCAL-03

**User Story**: As the GTD user, I want to connect my Google account by pressing `c` on the integration page so that the app can access my Google Calendar.

**Why P1**: Core integration — without OAuth tokens, no Google Calendar API access.

**Acceptance Criteria**:

1. WHEN the user presses `c` on the integration page with credentials configured THEN the backend SHALL generate a Google OAuth2 authorization URL with the `https://www.googleapis.com/auth/calendar` scope
2. WHEN the authorization URL is generated THEN the app SHALL open the user's default browser to that URL
3. WHEN Google redirects back to `http://127.0.0.1:{sidecar-port}/oauth/google/callback` with an authorization code THEN the backend SHALL exchange it for access and refresh tokens
4. WHEN tokens are received THEN the backend SHALL store them in the `google_credentials` PostgreSQL table (access_token, refresh_token, token_type, expires_at, scope)
5. WHEN tokens are stored THEN the Connection Status on the integration page SHALL update to "Connected"
6. WHEN the user presses `c` but credentials are not configured THEN the app SHALL show a message directing the user to configure credentials first
7. WHEN the OAuth flow fails (user denies, network error) THEN the app SHALL display the error and remain on the integration page

**Independent Test**: Press `c`, complete Google auth in browser, verify callback stores tokens and page updates to "Connected".

---

### P1: Automatic Token Refresh ⭐ MVP

**ID**: GCAL-04

**User Story**: As the GTD user, I want the app to automatically refresh expired access tokens so that the integration stays connected without manual re-authorization.

**Why P1**: Access tokens expire after ~1 hour. Without auto-refresh the integration breaks immediately.

**Acceptance Criteria**:

1. WHEN the backend makes a Google Calendar API call and the access token has expired THEN it SHALL use the refresh token to obtain a new access token
2. WHEN a new access token is obtained THEN the backend SHALL update the `google_credentials` table with the new token and expiry
3. WHEN the refresh token is invalid or revoked THEN the Connection Status SHALL update to "Disconnected" and the user SHALL be prompted to re-authorize

**Independent Test**: Manually expire the access token in the database, trigger a calendar API call, verify the token is refreshed automatically.

---

### P1: GTD Calendar Creation ⭐ MVP

**ID**: GCAL-05

**User Story**: As the GTD user, I want the app to automatically create four Google Calendars matching my GTD categories so that future event syncing has the correct target calendars.

**Why P1**: The calendars are the target containers for future GTD ↔ Google Calendar sync.

**Acceptance Criteria**:

1. WHEN OAuth connection is established successfully THEN the backend SHALL create four Google Calendars via the Google Calendar API (if they don't already exist)
2. WHEN creating calendars THEN each SHALL have the correct name and closest-match Google Calendar color:
   - "Next Action" — closest to `#4F9768` (GTD next-action green)
   - "Calendar" — closest to `#c85a53` (GTD calendar red)
   - "On Going" — closest to `#9B5AB7` (GTD on-going purple)
   - "Done" — closest to `#7F8D3F` (GTD done green)
3. WHEN calendars are created THEN the backend SHALL store their Google Calendar IDs in the `google_calendars` table for future reference
4. WHEN the integration page loads with an active connection THEN the Calendars section SHALL list all four calendars with their names, colors, and creation status
5. WHEN a calendar with the same name already exists on the user's Google account THEN the backend SHALL reuse it instead of creating a duplicate
6. WHEN calendar creation fails partially THEN the backend SHALL report which calendars succeeded and which failed, and allow retry

**Independent Test**: Connect via OAuth, verify four calendars appear in the user's Google Calendar with correct names and colors.

---

## Edge Cases

- WHEN the sidecar port changes between launches THEN the OAuth redirect URI SHALL use the current sidecar port dynamically
- WHEN the user has no internet connection THEN the integration page SHALL show an appropriate offline indicator and disable `c`
- WHEN `google.properties` exists but contains invalid/empty values THEN the Credentials status SHALL show "Invalid" and prompt reconfiguration
- WHEN the backend cannot read `google.properties` (file permission error) THEN the app SHALL display a specific error message with the file path
- WHEN the user is already connected and presses `c` again THEN the app SHALL show the current connection status instead of starting a new flow
- WHEN multiple OAuth callbacks arrive (e.g. user clicks authorize twice) THEN the backend SHALL handle only the first valid callback and ignore duplicates

---

## Requirement Traceability

| Requirement ID | Story                      | Phase   | Status  |
| -------------- | -------------------------- | ------- | ------- |
| GCAL-01        | P1: Integration Status     | Specify | Pending |
| GCAL-02        | P1: Client Credentials     | Specify | Pending |
| GCAL-03        | P1: OAuth2 Connection      | Specify | Pending |
| GCAL-04        | P1: Token Refresh          | Specify | Pending |
| GCAL-05        | P1: Calendar Creation      | Specify | Pending |

**Coverage:** 5 total, 0 mapped to tasks, 5 unmapped ⚠️

---

## Success Criteria

- [ ] User can navigate to integration page via `Space I g` and see all status sections
- [ ] User can configure client credentials inline without touching the filesystem
- [ ] User can connect to Google via OAuth2 with a single keybind press
- [ ] Access tokens refresh automatically without user intervention
- [ ] Four GTD calendars exist in the user's Google Calendar with correct names and approximate colors
- [ ] Integration state syncs between both machines via PostgreSQL and File Sync
