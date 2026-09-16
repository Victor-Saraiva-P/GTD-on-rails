create table items_new (
    id text primary key,
    title text not null,
    body text not null default '{"text":"","inlineMarks":[],"lineBlocks":[],"blockEntities":[]}',
    status text not null check (status in ('STUFF', 'NEXT_ACTION', 'CALENDAR', 'PROJECT', 'SOMEDAY_MAYBE')),
    created_at timestamp not null,
    updated_at timestamp not null,
    deleted_at timestamp,
    check (length(body) <= 150000)
);

insert into items_new (id, title, body, status, created_at, updated_at, deleted_at)
select id, title, body, status, created_at, updated_at, deleted_at from items;

drop table items;

alter table items_new rename to items;
