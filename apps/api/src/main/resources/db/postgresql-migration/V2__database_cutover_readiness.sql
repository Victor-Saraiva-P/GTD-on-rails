create table if not exists database_cutover (
    id boolean primary key default true check (id),
    state text not null check (state in ('AWAITING_LEGACY_IMPORT', 'IMPORTING', 'READY', 'FAILED')),
    created_at timestamp with time zone not null default current_timestamp
);

insert into database_cutover (state) values ('READY') on conflict (id) do nothing;
