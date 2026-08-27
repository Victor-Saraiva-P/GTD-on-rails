package com.gtdonrails.api.services;

import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.gtdonrails.api.entities.SyncOutboxEvent;
import com.gtdonrails.api.entities.SyncOutboxOperation;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;

class SupabasePushSyncServiceTests {

    private JdbcTemplate jdbcTemplate;
    private SupabasePushSyncService service;

    @BeforeEach
    void setUp() {
        jdbcTemplate = mock(JdbcTemplate.class);
        service = new SupabasePushSyncService(jdbcTemplate, new ObjectMapper());
    }

    @Test
    void pushesInsertEventAsSqlInsert() {
        SyncOutboxEvent event = new SyncOutboxEvent(
            "items", "item-123", SyncOutboxOperation.INSERT,
            "{\"id\":\"item-123\",\"title\":\"Buy milk\",\"status\":\"STUFF\"}"
        );

        service.pushEvent(event);

        verify(jdbcTemplate).update(
            contains("INSERT INTO gtd.items (id, title, status) VALUES (?, ?, ?) ON CONFLICT (id) DO UPDATE SET"),
            any(Object[].class)
        );
    }

    @Test
    void pushesUpdateEventAsSqlUpdate() {
        SyncOutboxEvent event = new SyncOutboxEvent(
            "items", "item-123", SyncOutboxOperation.UPDATE,
            "{\"id\":\"item-123\",\"title\":\"Buy organic milk\"}"
        );

        service.pushEvent(event);

        verify(jdbcTemplate).update(
            eq("UPDATE gtd.items SET title = ? WHERE id = ?"),
            any(Object[].class)
        );
    }

    @Test
    void pushesDeleteEventAsSqlDelete() {
        SyncOutboxEvent event = new SyncOutboxEvent(
            "items", "item-123", SyncOutboxOperation.DELETE,
            "{\"id\":\"item-123\"}"
        );

        service.pushEvent(event);

        verify(jdbcTemplate).update(
            eq("DELETE FROM gtd.items WHERE id = ?"),
            eq("item-123")
        );
    }

    @Test
    void detectsItemIdPrimaryKeyForNextActions() {
        SyncOutboxEvent event = new SyncOutboxEvent(
            "next_actions", "item-456", SyncOutboxOperation.DELETE,
            "{\"item_id\":\"item-456\"}"
        );

        service.pushEvent(event);

        verify(jdbcTemplate).update(
            eq("DELETE FROM gtd.next_actions WHERE item_id = ?"),
            eq("item-456")
        );
    }

    @Test
    void throwsOnInvalidJsonPayload() {
        SyncOutboxEvent event = new SyncOutboxEvent(
            "items", "item-123", SyncOutboxOperation.INSERT,
            "not-valid-json"
        );

        assertThrows(IllegalStateException.class, () -> service.pushEvent(event));
    }
}
