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
    constraint chk_items_status check (status in ('STUFF', 'NEXT_ACTION', 'CALENDAR', 'RECURRING_CALENDAR_TEMPLATE'))
);

insert into items_new (id, title, body, status, created_at, updated_at, deleted_at)
select id, title, body, status, created_at, updated_at, deleted_at
from items;

drop table items;
alter table items_new rename to items;

pragma foreign_keys=on;

create table recurring_calendar_templates (
    item_id blob primary key,
    start_date date not null,
    scheduled_time time,
    interval_value integer not null,
    recurrence_unit text not null,
    weekly_weekdays text not null default '',
    end_date date,
    created_at timestamp not null,
    updated_at timestamp not null,
    deleted_at timestamp,
    constraint chk_recurring_calendar_templates_interval check (interval_value > 0),
    constraint chk_recurring_calendar_templates_unit check (recurrence_unit in ('DAY', 'WEEK', 'MONTH', 'YEAR')),
    constraint fk_recurring_calendar_templates_item foreign key (item_id) references items (id)
);

alter table calendars add column recurring_template_item_id blob references recurring_calendar_templates (item_id);
alter table calendars add column original_scheduled_date date;
alter table calendars add column original_scheduled_time time;
alter table calendars add column personalized_occurrence boolean not null default false;

create unique index idx_calendars_recurring_occurrence_identity
on calendars (recurring_template_item_id, original_scheduled_date, coalesce(original_scheduled_time, ''))
where recurring_template_item_id is not null;
