# ADR: Google Integration Configuration Uses Blocking Sync

## Status

Superseded by the local-first personal sync-server architecture described in [[synchronization]].

## Historical context

This ADR described the former multi-installation model in which Google OAuth configuration and tokens lived with desktop persistence and had to be synchronized between installations.

That model is no longer authoritative.

## Current decision

Google Calendar is a server-side projection owned exclusively by `apps/sync-server`.

The sync client owns:

- Google OAuth client credentials;
- OAuth access and refresh tokens;
- GTD-managed Google Calendar identifiers;
- the durable `google_calendar_outbox`;
- all calls to the Google Calendar API.

Desktop sidecars do not write to Google Calendar. They persist GTD state locally and synchronize ordinary canonical mutations. Relevant canonical mutations enqueue Google projection work atomically in `canonical.db`.

The desktop-facing `/integrations/google-calendar/**` routes remain as a compatibility facade and proxy integration operations to the sync client.

## Consequences

Multiple desktops can edit independently without becoming multiple Google Calendar writers.

Google Calendar availability does not block GTD persistence. Projection failures remain pending in the client outbox and are retried later.

OAuth configuration no longer has to be replicated across desktop datasets. The sync client is the single integration authority.

The OAuth callback must resolve to the sync client. When it is exposed through Tailscale or another non-loopback address, configure `GTD_SYNC_SERVER_PUBLIC_BASE_URL`.
