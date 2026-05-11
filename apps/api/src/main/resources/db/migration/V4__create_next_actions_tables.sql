create table next_actions (
    item_id blob primary key,
    energy numeric not null,
    estimated_time_minutes bigint not null,
    created_at timestamp not null,
    updated_at timestamp not null,
    deleted_at timestamp,
    constraint fk_next_actions_item foreign key (item_id) references items (id)
);

create table next_action_contexts (
    next_action_id blob not null,
    context_id blob not null,
    primary key (next_action_id, context_id),
    constraint fk_next_action_contexts_next_action foreign key (next_action_id) references next_actions (id),
    constraint fk_next_action_contexts_context foreign key (context_id) references contexts (id)
);
