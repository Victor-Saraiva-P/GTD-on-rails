-- Consolidated SQLite baseline
-- Compatible with Hibernate SQLiteDialect and standard SQLite column type affinity.

create table if not exists database_identity (
    id integer primary key default 1 check (id = 1),
    environment text not null check (environment in ('PRODUCTION', 'STAGING', 'DEVELOPMENT', 'TEST')),
    created_at timestamp not null default current_timestamp
);

insert into database_identity (id, environment) values (1, '${databaseIdentity}') on conflict (id) do nothing;

create table items (
    id text primary key,
    title varchar(200) not null,
    body text not null default '{"text":"","inlineMarks":[],"lineBlocks":[],"blockEntities":[]}',
    status varchar(50) not null check (status in ('STUFF', 'NEXT_ACTION', 'CALENDAR', 'PROJECT')),
    created_at timestamp not null,
    updated_at timestamp not null,
    deleted_at timestamp,
    check (length(body) <= 150000)
);

create table contexts (
    id text primary key,
    name varchar(100) not null,
    created_at timestamp not null,
    updated_at timestamp not null,
    deleted_at timestamp
);

create table item_assets (
    id text primary key,
    item_id text not null references items(id),
    file_name text not null,
    original_file_name text not null,
    content_type text not null,
    size bigint not null,
    created_at timestamp not null,
    updated_at timestamp not null,
    deleted_at timestamp
);
create index idx_item_assets_item_id on item_assets (item_id);

create table context_icon_assets (
    id text primary key,
    context_id text not null references contexts(id),
    file_name text not null,
    original_file_name text not null,
    content_type text not null,
    size bigint not null,
    created_at timestamp not null,
    updated_at timestamp not null,
    deleted_at timestamp
);
create unique index uq_context_icon_assets_active_context_id on context_icon_assets (context_id) where deleted_at is null;

create table next_actions (
    item_id text primary key references items(id),
    energy numeric(10, 2) not null,
    estimated_time_minutes bigint not null,
    date_start date,
    date_end date,
    time_start time,
    time_end time,
    all_day boolean not null default 0,
    deadline date,
    status varchar(50) not null default 'NEXT_ACTION',
    created_at timestamp not null,
    updated_at timestamp not null,
    deleted_at timestamp
);

create table next_action_contexts (
    next_action_id text not null references next_actions(item_id),
    context_id text not null references contexts(id),
    primary key (next_action_id, context_id)
);

create table calendars (
    item_id text primary key references items(id),
    scheduled_date date not null,
    scheduled_time time,
    date_start date,
    date_end date,
    time_start time,
    time_end time,
    all_day boolean not null default 0,
    status varchar(50) not null default 'CALENDAR',
    created_at timestamp not null,
    updated_at timestamp not null,
    deleted_at timestamp
);

create table maintenance_runs (name text primary key, last_run_at timestamp not null);

create table google_credentials (
    id text primary key,
    access_token text not null,
    refresh_token text not null,
    token_type text not null,
    expires_at timestamp not null,
    scope text not null
);

create table google_calendars (
    id text primary key,
    google_calendar_id text not null,
    name text not null,
    color_hex text not null
);

create table if not exists database_cutover (
    id integer primary key default 1 check (id = 1),
    state text not null check (state in ('AWAITING_LEGACY_IMPORT', 'IMPORTING', 'READY', 'FAILED')),
    created_at timestamp not null default current_timestamp
);

insert into database_cutover (id, state) values (1, 'READY') on conflict (id) do nothing;

create table projects (
    item_id text primary key references items(id),
    deadline date,
    status text not null default 'ACTIVE',
    done_date date,
    done_time time,
    created_at timestamp not null,
    updated_at timestamp not null,
    deleted_at timestamp
);

create table project_items (
    item_id text primary key references items(id),
    project_id text not null references projects(item_id)
);
create index idx_project_items_project_id on project_items (project_id);

create table sync_outbox (
    id integer primary key autoincrement,
    entity_type text not null,
    entity_id text not null,
    operation text not null check (operation in ('INSERT', 'UPDATE', 'DELETE')),
    payload text not null,
    created_at timestamp not null default current_timestamp,
    status text not null default 'PENDING' check (status in ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED')),
    retry_count integer not null default 0,
    last_error text
);
create index idx_sync_outbox_pending on sync_outbox (status, created_at) where status = 'PENDING';
