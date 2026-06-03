create table google_calendars (
    id blob primary key,
    google_calendar_id text not null,
    name text not null,
    color_hex text not null
);
