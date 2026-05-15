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
