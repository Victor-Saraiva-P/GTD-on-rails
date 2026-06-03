create table google_credentials (
    id blob primary key,
    access_token text not null,
    refresh_token text not null,
    token_type text not null,
    expires_at timestamp not null,
    scope text not null
);
