alter table projects add column status text not null default 'ACTIVE';
alter table projects add column done_date date;
alter table projects add column done_time time;
