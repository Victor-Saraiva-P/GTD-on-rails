create table items (
    id blob primary key,
    title text not null,
    body text,
    energy numeric,
    status text not null,
    created_at timestamp not null,
    updated_at timestamp not null,
    deleted_at timestamp,
    constraint chk_items_title_length check (length(title) <= 200),
    constraint chk_items_body_length check (body is null or length(body) <= 10000),
    constraint chk_items_status check (status in ('STUFF'))
);
