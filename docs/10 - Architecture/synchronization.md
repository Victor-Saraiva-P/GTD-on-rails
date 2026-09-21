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
