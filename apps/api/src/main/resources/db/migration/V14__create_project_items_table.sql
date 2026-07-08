create table project_items (
    item_id blob primary key,
    project_id blob not null,
    constraint fk_project_items_item foreign key (item_id) references items (id),
    constraint fk_project_items_project foreign key (project_id) references projects (item_id)
);
