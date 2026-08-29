alter table items drop constraint if exists items_status_check;
alter table items add constraint items_status_check check (status in ('STUFF', 'NEXT_ACTION', 'CALENDAR', 'PROJECT'));

create table if not exists projects (
    item_id uuid primary key references items(id),
    deadline date,
    status text not null default 'ACTIVE',
    done_date date,
    done_time time,
    created_at timestamp with time zone not null,
    updated_at timestamp with time zone not null,
    deleted_at timestamp with time zone
);

create table if not exists project_items (
    item_id uuid primary key references items(id),
    project_id uuid not null references projects(item_id)
);
create index if not exists idx_project_items_project_id on project_items (project_id);
