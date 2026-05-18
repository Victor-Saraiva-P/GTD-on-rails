create table item_assets (
    id blob primary key,
    item_id blob not null,
    file_name text not null,
    original_file_name text not null,
    content_type text not null,
    size bigint not null,
    created_at timestamp not null,
    updated_at timestamp not null,
    deleted_at timestamp,
    constraint fk_item_assets_item foreign key (item_id) references items (id)
);

create index idx_item_assets_item_id on item_assets (item_id);

create table context_icon_assets (
    id blob primary key,
    context_id blob not null,
    file_name text not null,
    original_file_name text not null,
    content_type text not null,
    size bigint not null,
    created_at timestamp not null,
    updated_at timestamp not null,
    deleted_at timestamp,
    constraint fk_context_icon_assets_context foreign key (context_id) references contexts (id),
    constraint uq_context_icon_assets_context_id unique (context_id)
);

create index idx_context_icon_assets_context_id on context_icon_assets (context_id);
