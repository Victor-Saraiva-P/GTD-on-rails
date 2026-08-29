-- Schema creation and search_path are handled by bootstrap provisioning and
-- spring.flyway.schemas=gtd / currentSchema=gtd in the JDBC URL.

create table if not exists database_identity (
    id boolean primary key default true check (id),
    environment text not null check (environment in ('PRODUCTION', 'STAGING', 'DEVELOPMENT', 'TEST')),
    created_at timestamp with time zone not null default current_timestamp
);

insert into database_identity (environment) values ('${databaseIdentity}') on conflict (id) do nothing;

create table if not exists items (
    id uuid primary key,
    title varchar(200) not null,
    body text not null default '{"text":"","inlineMarks":[],"lineBlocks":[],"blockEntities":[]}',
    status varchar(50) not null check (status in ('STUFF', 'NEXT_ACTION', 'CALENDAR')),
    created_at timestamp with time zone not null,
    updated_at timestamp with time zone not null,
    deleted_at timestamp with time zone,
    check (length(body) <= 150000)
);

create table if not exists contexts (
    id uuid primary key,
    name varchar(100) not null,
    created_at timestamp with time zone not null,
    updated_at timestamp with time zone not null,
    deleted_at timestamp with time zone
);

create table if not exists item_assets (
    id uuid primary key,
    item_id uuid not null references items(id),
    file_name text not null,
    original_file_name text not null,
    content_type text not null,
    size bigint not null,
    created_at timestamp with time zone not null,
    updated_at timestamp with time zone not null,
    deleted_at timestamp with time zone
);
create index if not exists idx_item_assets_item_id on item_assets (item_id);

create table if not exists context_icon_assets (
    id uuid primary key,
    context_id uuid not null references contexts(id),
    file_name text not null,
    original_file_name text not null,
    content_type text not null,
    size bigint not null,
    created_at timestamp with time zone not null,
    updated_at timestamp with time zone not null,
    deleted_at timestamp with time zone
);
create unique index if not exists uq_context_icon_assets_active_context_id on context_icon_assets (context_id) where deleted_at is null;

create table if not exists next_actions (
    item_id uuid primary key references items(id),
    energy numeric(10, 2) not null,
    estimated_time_minutes bigint not null,
    date_start date,
    date_end date,
    time_start time,
    time_end time,
    all_day boolean not null default false,
    deadline date,
    status varchar(50) not null default 'NEXT_ACTION',
    created_at timestamp with time zone not null,
    updated_at timestamp with time zone not null,
    deleted_at timestamp with time zone
);

create table if not exists next_action_contexts (
    next_action_id uuid not null references next_actions(item_id),
    context_id uuid not null references contexts(id),
    primary key (next_action_id, context_id)
);

create table if not exists calendars (
    item_id uuid primary key references items(id),
    scheduled_date date not null,
    scheduled_time time,
    date_start date,
    date_end date,
    time_start time,
    time_end time,
    all_day boolean not null default false,
    status varchar(50) not null default 'CALENDAR',
    created_at timestamp with time zone not null,
    updated_at timestamp with time zone not null,
    deleted_at timestamp with time zone
);

create table if not exists maintenance_runs (name text primary key, last_run_at timestamp with time zone not null);
create table if not exists google_credentials (id uuid primary key, access_token text not null, refresh_token text not null, token_type text not null, expires_at timestamp with time zone not null, scope text not null);
create table if not exists google_calendars (id uuid primary key, google_calendar_id text not null, name text not null, color_hex text not null);
