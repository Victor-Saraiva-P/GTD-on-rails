create table items (
    id blob primary key,
    title text not null,
    body text not null default '',
    energy numeric,
    time_minutes bigint,
    status text not null,
    created_at timestamp not null,
    updated_at timestamp not null,
    deleted_at timestamp,
    constraint chk_items_title_length check (length(title) <= 200),
    constraint chk_items_body_length check (length(body) <= 100000),
    constraint chk_items_status check (status in ('STUFF'))
);
