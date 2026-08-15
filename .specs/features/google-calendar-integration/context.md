# Google Calendar Integration Context

**Gathered:** 2026-05-27
**Spec:** `.specs/features/google-calendar-integration/spec.md`
**Status:** Ready for design

---

## Feature Boundary

Establish the Google Calendar connection infrastructure: credential configuration, OAuth2 authorization, token storage, and creation of four GTD-mapped Google Calendars. No event syncing — just the plumbing for future phases.

---

## Implementation Decisions

### Credential Architecture (Two-Layer Model)

- **Client credentials** (`client_id`, `client_secret`): Stored in `{data-root}/google.properties`. Syncs between machines via rclone File Sync. Not committed to the public code repo.
- **User tokens** (`access_token`, `refresh_token`, `expires_at`): Stored encrypted in the PostgreSQL database in the `google_credentials` table.
- **Encryption at rest**: Token values are encrypted using AES-GCM before database storage.
- **Rationale**: Google treats installed-app `client_secret` as non-confidential. File Sync and PostgreSQL credentials provide secure storage across machines.

### Configuration Pattern

- Backend uses `@ConfigurationProperties(prefix = "gtd.google")` with a typed `GoogleProperties` class — same pattern as `AssetsProperties`, `CleanupProperties`.
- Public repo ships `${GOOGLE_CLIENT_ID:}` placeholders in `application.properties`.
- Runtime values loaded from the external `google.properties` file via Spring Boot's `spring.config.additional-location`.

### Integration Page UX

- Accessible via `Space I g` (capital I, lowercase g). `Space I` prefix is currently unused — reserved for integrations.
- Page shows three progressive status sections: Credentials → Connection → Calendars.
- `s` opens inline credential setup form (or pre-filled edit form if file exists).
- `c` starts OAuth flow (only enabled when credentials are configured).
- `Escape` navigates back to the previous screen.
- The page also indicates if the `google.properties` file exists or not, and whether values are valid.

### OAuth Flow

- Standard OAuth2 Authorization Code flow for installed apps.
- Opens the user's default browser for Google authorization.
- Callback to `http://127.0.0.1:{sidecar-port}/oauth/google/callback`.
- Sidecar port is dynamic (ephemeral) — redirect URI constructed at runtime.
- Scope: `https://www.googleapis.com/auth/calendar`.

### Google Calendar Colors

- Google Calendar has a fixed palette (~25 colors), not arbitrary hex.
- During design phase, map each GTD color to the closest Google Calendar palette color:
  - Next Action → closest to `#4F9768` (green)
  - Calendar → closest to `#c85a53` (red)
  - On Going → closest to `#9B5AB7` (purple)
  - Done → closest to `#7F8D3F` (olive green)

---

## Specific References

- rclone's credential storage model (local config file per machine) was referenced as prior art, but syncing via the persistence repo was chosen instead for cross-device consistency.
- Google's documentation on [OAuth2 for installed apps](https://developers.google.com/identity/protocols/oauth2/native-app) confirms client_secret is non-confidential for this flow.
- Existing `ListTheme` color definitions in `features/lists/listThemes.ts` are the source of truth for GTD page colors.

---

## Deferred Ideas

- **Disconnect / revoke flow**: User can revoke via Google's account settings for now. In-app disconnect can be added later.
- **Full data-directory encryption at rest**: Would cover DB + config + assets holistically. Separate feature.
- **GTD element ↔ Google Calendar event sync**: The entire purpose of this infrastructure. Phase 2.
