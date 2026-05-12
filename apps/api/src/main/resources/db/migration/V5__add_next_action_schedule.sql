alter table next_actions add column date_start date;
alter table next_actions add column date_end date;
alter table next_actions add column time_start time;
alter table next_actions add column time_end time;
alter table next_actions add column all_day boolean not null default false;
