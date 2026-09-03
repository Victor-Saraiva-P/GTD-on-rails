package com.gtdonrails.api.services;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.List;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;

@Tag("unit")
class SupabasePullSyncServiceTests {

    private JdbcTemplate supabaseJdbc;
    private JdbcTemplate sqliteJdbc;
    private SupabasePullSyncService service;

    @BeforeEach
    void setUp() {
        supabaseJdbc = mock(JdbcTemplate.class);
        sqliteJdbc = mock(JdbcTemplate.class);
        when(supabaseJdbc.query(anyString(), any(RowMapper.class))).thenReturn(List.of());
        service = new SupabasePullSyncService(supabaseJdbc, sqliteJdbc);
    }

    @Test
    void pullsAllEntitiesInDependencyOrder() {
        service.pullAll();

        verify(supabaseJdbc).query(contains("FROM gtd.contexts"), any(RowMapper.class));
        verify(supabaseJdbc).query(contains("FROM gtd.items"), any(RowMapper.class));
        verify(supabaseJdbc).query(contains("FROM gtd.item_assets"), any(RowMapper.class));
        verify(supabaseJdbc).query(contains("FROM gtd.context_icon_assets"), any(RowMapper.class));
        verify(supabaseJdbc).query(contains("FROM gtd.projects"), any(RowMapper.class));
        verify(supabaseJdbc).query(contains("FROM gtd.project_items"), any(RowMapper.class));
        verify(supabaseJdbc).query(contains("FROM gtd.next_actions"), any(RowMapper.class));
        verify(supabaseJdbc).query(contains("FROM gtd.next_action_contexts"), any(RowMapper.class));
        verify(supabaseJdbc).query(contains("FROM gtd.calendars"), any(RowMapper.class));
        verify(sqliteJdbc).update(contains("DELETE FROM next_action_contexts"));
    }

    @Test
    void executesUpsertWhenRowsAreReturnedFromSupabase() {
        Object[] contextRow = new Object[] { "ctx-1", "Work", "2026-08-29 10:00:00", "2026-08-29 10:00:00", null };
        when(supabaseJdbc.query(contains("FROM gtd.contexts"), any(RowMapper.class)))
            .thenReturn(java.util.Collections.singletonList(contextRow));

        service.pullAll();

        verify(sqliteJdbc).update(contains("INSERT INTO contexts"), eq(contextRow));
    }
}
