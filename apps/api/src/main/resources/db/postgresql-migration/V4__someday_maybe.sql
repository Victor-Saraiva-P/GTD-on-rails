alter table items drop constraint if exists items_status_check;
alter table items add constraint items_status_check check (status in ('STUFF', 'NEXT_ACTION', 'CALENDAR', 'PROJECT', 'SOMEDAY_MAYBE'));
