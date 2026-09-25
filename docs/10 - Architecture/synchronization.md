# Synchronization

GTD on Rails is local-first. Every desktop edits its own SQLite database and filesystem immediately; synchronization with the personal sync server happens asynchronously.

## Data ownership

Local runtime:

- `gtd.db`: structured GTD metadata.
- `items/<item-uuid>/body.md`: canonical item body.
- `items/<item-uuid>/assets/<asset-uuid>/<filename>`: item assets.
- context icon assets remain physical files under the data root.
- `sync_outbox`: structured metadata mutations waiting to be pushed.
- `sync_file_outbox`: Markdown and binary file mutations waiting to be pushed.

The sync server is the convergence authority across devices. It stores:

- `canonical.db`: object revisions, ordered change feed, operation idempotency and dataset epoch.
- a physical file tree containing canonical Markdown and binary assets.
- `google_calendar_outbox`: durable external-projection work derived atomically from canonical GTD mutations.
- Google Calendar mirror identifiers for the five GTD-managed calendars.

Clients never copy a live SQLite database between machines.

## Protocol

Every sync object has:

- `objectType`
- `objectId`
- monotonically increasing `revision`
- optional SHA-256, byte length and media type
- tombstone state for deletes

Every mutation carries:

- UUID `operationId`
- `baseRevision`
- `UPSERT` or `DELETE`

The server rejects a mutation when `baseRevision` is stale. Replaying the same `operationId` is idempotent.

Pull uses an ordered cursor over the server change feed.

## Offline behavior

Local mutations never depend on sync-server reachability. Structured changes and file changes are committed locally first and remain in `sync_outbox` or `sync_file_outbox` until synchronization succeeds.

A transport or other non-conflict sync failure stops the current worker cycle instead of retrying in a hot loop. The outbox entry remains pending, and the scheduled worker retries it later. Retry counters are diagnostic only; ordinary server unavailability does not exhaust or discard a local mutation.

`CONFLICT` and `REBOOTSTRAP_REQUIRED` remain explicit attention states. They are not silently retried as ordinary offline failures.

## Google Calendar projection

Google Calendar is owned by the sync server/client process, never by an individual desktop sidecar.

The local application commits GTD state to SQLite and its normal sync outbox. When a relevant `items`, `next_actions`, `calendars`, or `projects` mutation is accepted by the canonical sync server, the same SQLite transaction also upserts that item id into `google_calendar_outbox`.

Only after canonical commit does the Google projection worker run. It reads canonical object snapshots, derives the required Google event, and updates the GTD-managed calendars. This makes the sync server the single Google Calendar writer even when several desktops are connected.

Google OAuth client credentials and OAuth tokens are stored under the sync-server data root, not in desktop datasets. The desktop-facing integration endpoints remain on the local API as a compatibility facade, but they proxy configuration/status/reconcile requests to the sync server.

Projection failures do not roll back canonical GTD state. The outbox entry stays pending and is retried by the scheduled client worker. Process restarts therefore do not lose Google Calendar work.

The default OAuth callback uses the sync server public base URL. Set `GTD_SYNC_SERVER_PUBLIC_BASE_URL` when the client is reached through Tailscale or another non-loopback address.

## Markdown conflicts

For `body_document`, the client retains the last synchronized base outside the user dataset.

When local and remote diverge:

1. base, local and remote are compared.
2. Independent line edits are merged automatically.
3. Overlapping edits become an explicit conflict.
4. The desktop recovery panel allows **Use local**, **Use remote**, or **Use merged**.

Binary conflicts are never merged automatically. The user chooses local or remote.

Conflict snapshots are stored under the private sync state directory, not inside the synchronized dataset.

## Dataset epoch

The server exposes a stable `datasetEpoch`.

A server restore always creates a new epoch. Before any push, clients compare their stored epoch with the server epoch. A mismatch moves sync into `REBOOTSTRAP_REQUIRED` and blocks further pushes.

Rebootstrap:

1. creates a local recovery ZIP;
2. uses SQLite `VACUUM INTO` for a consistent database copy;
3. archives physical bodies/assets;
4. clears only synchronized local domain state;
5. initializes the new epoch and cursor 0;
6. pulls the canonical server dataset again.

## Backups

The sync server creates immutable ZIP snapshots containing:

- `canonical.db`
- `manifest.json`
- the complete server file tree

Snapshot creation is serialized with file mutations. SQLite WAL is checkpointed before copying the database.

Optional Google Drive publication uses:

```text
rclone copy <snapshot.zip> <configured-backup-remote>
```

`rclone bisync` is not used for live application state.

Restore swaps the file tree and canonical database under the server lock, then rotates `datasetEpoch`.

## Sync-server administration

The server exposes a lightweight web dashboard at `/`.

The dashboard can inspect:

- dataset epoch and cursor;
- object/tombstone counts by object type;
- canonical object payloads;
- recent change-feed entries;
- physical synchronized files;
- immutable backup snapshots.

Management actions include creating, restoring and deleting snapshots. Restore requires explicit confirmation in the UI because it rotates `datasetEpoch` and forces connected clients to rebootstrap.

The administrative JSON endpoints are under `/v1/admin/**` and share the sync-server bearer-token policy.

## Status API

`GET /sync/status` exposes file, Google Calendar and structured sync state.

Important states include:

- `SYNCED`
- `PENDING`
- `SYNCING`
- `FAILED`
- `CONFLICT`
- `REBOOTSTRAP_REQUIRED`

Conflict endpoints:

- `GET /sync/conflicts`
- `GET /sync/conflicts/{id}`
- `POST /sync/conflicts/{id}/resolve`

Rebootstrap endpoint:

- `POST /sync/rebootstrap`
