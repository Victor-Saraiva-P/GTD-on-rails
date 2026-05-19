create table contexts (
    id blob primary key,
    name text not null,
    created_at timestamp not null,
    updated_at timestamp not null,
    deleted_at timestamp,
    constraint chk_contexts_name_length check (length(name) <= 100)
);
