pragma foreign_keys=off;

create table items_new (
    id blob primary key,
    title text not null,
    body text not null default '{"text":"","inlineMarks":[],"lineBlocks":[],"blockEntities":[]}',
    status text not null,
    created_at timestamp not null,
    updated_at timestamp not null,
    deleted_at timestamp,
    constraint chk_items_title_length check (length(title) <= 200),
    constraint chk_items_body_length check (length(body) <= 150000),
    constraint chk_items_status check (status in ('STUFF', 'NEXT_ACTION', 'CALENDAR'))
);

insert into items_new (id, title, body, status, created_at, updated_at, deleted_at)
select id, title, body, status, created_at, updated_at, deleted_at
from items;

drop table items;
alter table items_new rename to items;

pragma foreign_keys=on;

create table calendars (
    item_id blob primary key,
    scheduled_date date not null,
    scheduled_time time,
    date_start date,
    date_end date,
    time_start time,
    time_end time,
    all_day boolean not null default false,
    status text not null default 'CALENDAR',
    created_at timestamp not null,
    updated_at timestamp not null,
    deleted_at timestamp,
    constraint chk_calendars_status check (status in ('CALENDAR', 'ONGOING', 'DONE')),
    constraint fk_calendars_item foreign key (item_id) references items (id)
);
