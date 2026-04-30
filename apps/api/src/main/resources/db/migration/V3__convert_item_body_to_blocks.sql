alter table items rename to items_old;

create table item_contexts_old as select item_id, context_id from item_contexts;

drop table item_contexts;

create table items (
    id blob primary key,
    title text not null,
    body text,
    energy numeric,
    time_minutes bigint,
    status text not null,
    created_at timestamp not null,
    updated_at timestamp not null,
    deleted_at timestamp,
    constraint chk_items_title_length check (length(title) <= 200),
    constraint chk_items_body_json check (body is null or json_valid(body)),
    constraint chk_items_status check (status in ('STUFF'))
);

insert into items (
    id,
    title,
    body,
    energy,
    time_minutes,
    status,
    created_at,
    updated_at,
    deleted_at
)
select
    id,
    title,
    case
        when body is null then null
        when json_valid(body) and json_type(body, '$.blocks[0].id') is not null then body
        else json_object(
            'version',
            1,
            'blocks',
            json_array(json_object(
                'id',
                lower(hex(randomblob(4))) || '-' ||
                    lower(hex(randomblob(2))) || '-' ||
                    lower(hex(randomblob(2))) || '-' ||
                    lower(hex(randomblob(2))) || '-' ||
                    lower(hex(randomblob(6))),
                'type',
                'paragraph',
                'properties',
                json_object(
                    'richText',
                    json_array(json_object(
                        'text',
                        case
                            when json_valid(body)
                                then coalesce(json_extract(body, '$.blocks[0].inlines[0].text'), body)
                            else body
                        end,
                        'marks',
                        json_array(),
                        'textColor',
                        null,
                        'backgroundColor',
                        null,
                        'link',
                        null
                    ))
                )
            ))
        )
    end,
    energy,
    time_minutes,
    status,
    created_at,
    updated_at,
    deleted_at
from items_old;

drop table items_old;

create table item_contexts (
    item_id blob not null,
    context_id blob not null,
    primary key (item_id, context_id),
    constraint fk_item_contexts_item foreign key (item_id) references items (id),
    constraint fk_item_contexts_context foreign key (context_id) references contexts (id)
);

insert into item_contexts (item_id, context_id)
select item_id, context_id from item_contexts_old;

drop table item_contexts_old;
