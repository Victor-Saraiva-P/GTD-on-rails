create table contexts (
    id blob primary key,
    name text not null unique,
    created_at timestamp not null,
    updated_at timestamp not null,
    deleted_at timestamp,
    constraint chk_contexts_name_length check (length(name) <= 100)
);

create table item_contexts (
    item_id blob not null,
    context_id blob not null,
    primary key (item_id, context_id),
    constraint fk_item_contexts_item foreign key (item_id) references items (id),
    constraint fk_item_contexts_context foreign key (context_id) references contexts (id)
);
