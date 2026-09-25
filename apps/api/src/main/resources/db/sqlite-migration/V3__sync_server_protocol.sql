ALTER TABLE sync_outbox ADD COLUMN operation_id TEXT;

UPDATE sync_outbox
SET operation_id =
    lower(hex(randomblob(4))) || '-' ||
    lower(hex(randomblob(2))) || '-' ||
    '4' || substr(lower(hex(randomblob(2))), 2) || '-' ||
    substr('89ab', abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))), 2) || '-' ||
    lower(hex(randomblob(6)))
WHERE operation_id IS NULL;

CREATE UNIQUE INDEX uq_sync_outbox_operation_id ON sync_outbox(operation_id);

CREATE TABLE sync_object_revisions (
    object_type TEXT NOT NULL,
    object_id TEXT NOT NULL,
    revision INTEGER NOT NULL,
    PRIMARY KEY (object_type, object_id)
);

CREATE TABLE sync_client_state (
    id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    dataset_epoch TEXT,
    cursor INTEGER NOT NULL DEFAULT 0
);

INSERT INTO sync_client_state (id, dataset_epoch, cursor)
VALUES (1, NULL, 0)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE sync_file_outbox (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    operation_id TEXT NOT NULL UNIQUE,
    object_type TEXT NOT NULL,
    object_id TEXT NOT NULL,
    operation TEXT NOT NULL CHECK (operation IN ('UPSERT', 'DELETE')),
    relative_path TEXT NOT NULL,
    content_type TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED')),
    retry_count INTEGER NOT NULL DEFAULT 0,
    last_error TEXT
);

CREATE INDEX idx_sync_file_outbox_pending
ON sync_file_outbox(status, created_at)
WHERE status = 'PENDING';

CREATE TABLE sync_conflicts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    object_type TEXT NOT NULL,
    object_id TEXT NOT NULL,
    local_operation_id TEXT,
    remote_revision INTEGER NOT NULL,
    remote_cursor INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'RESOLVED')),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (object_type, object_id, remote_revision)
);
