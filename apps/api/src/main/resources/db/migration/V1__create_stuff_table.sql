create table stuff (
    id blob primary key,
    title text not null,
    body text,
    updated_at timestamp not null,
    deleted_at timestamp,
    constraint chk_stuff_title_length check (length(title) <= 200),
    constraint chk_stuff_body_length check (body is null or length(body) <= 10000)
);
