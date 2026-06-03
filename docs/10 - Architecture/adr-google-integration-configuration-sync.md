# ADR: Google Integration Configuration Uses Blocking Sync

## Status

Accepted.

## Context

Google Calendar OAuth tokens are encrypted at rest with a Token Encryption Key. The app runs on two trusted local installations that share persistence through the private Git-backed data repository.

The Token Encryption Key must be stable across both installations so each backend can decrypt the same synced OAuth token rows. Launching the desktop app from a `.desktop` entry does not reliably provide shell environment variables, so the key cannot depend on `GTD_GOOGLE_TOKEN_ENCRYPTION_KEY`.

## Decision

`config/google.properties` is the single source of truth for Google Integration Configuration, including Google OAuth client credentials and the generated Token Encryption Key.

Google Integration Configuration changes use blocking persistence sync. A credentials save or legacy Token Encryption Key repair is treated as successful only after the backend writes `google.properties` and the persistence sync service completes commit, pull, and push.

Normal GTD item persistence remains asynchronous.

## Consequences

Google Calendar setup can block or fail with a sync-specific message when the private persistence repository cannot be safely synced.

The UI keeps OAuth connection disabled until Configuration Status is `READY`, preventing one installation from connecting Google Calendar while the other cannot read the matching local integration state.

If a Google Integration Configuration save cannot sync, the backend rolls the local file back to its previous contents and attempts to sync the rollback without rewriting Git history.

This does not protect against full compromise of the synced persistence repository. It protects against casual plaintext OAuth token exposure while preserving reliable two-machine operation.
