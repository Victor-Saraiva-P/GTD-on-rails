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
    void pushesNextActionInsertEventAndSyncsContexts() {
        SyncOutboxEvent event = new SyncOutboxEvent(
            "next_actions", "550e8400-e29b-41d4-a716-446655440000", SyncOutboxOperation.INSERT,
            "{\"item_id\":\"550e8400-e29b-41d4-a716-446655440000\",\"energy\":2.0,\"context_ids\":[\"660e8400-e29b-41d4-a716-446655440000\"]}"
        );

        service.pushEvent(event);

        verify(jdbcTemplate).update(
            contains("INSERT INTO gtd.next_actions (item_id, energy)"),
            any(Object[].class)
        );
        verify(jdbcTemplate).update(
            eq("DELETE FROM gtd.next_action_contexts WHERE next_action_id = ?"),
            eq(java.util.UUID.fromString("550e8400-e29b-41d4-a716-446655440000"))
        );
        verify(jdbcTemplate).update(
            eq("INSERT INTO gtd.next_action_contexts (next_action_id, context_id) VALUES (?, ?) ON CONFLICT (next_action_id, context_id) DO NOTHING"),
            eq(java.util.UUID.fromString("550e8400-e29b-41d4-a716-446655440000")),
            eq(java.util.UUID.fromString("660e8400-e29b-41d4-a716-446655440000"))
        );
    }

    @Test
    void pushesNextActionUpdateEventAndSyncsContexts() {
        SyncOutboxEvent event = new SyncOutboxEvent(
            "next_actions", "550e8400-e29b-41d4-a716-446655440000", SyncOutboxOperation.UPDATE,
            "{\"item_id\":\"550e8400-e29b-41d4-a716-446655440000\",\"energy\":5.0,\"context_ids\":[\"770e8400-e29b-41d4-a716-446655440000\"]}"
        );

        service.pushEvent(event);

        verify(jdbcTemplate).update(
            eq("UPDATE gtd.next_actions SET energy = ? WHERE item_id = ?"),
            any(Object[].class)
        );
        verify(jdbcTemplate).update(
            eq("DELETE FROM gtd.next_action_contexts WHERE next_action_id = ?"),
            eq(java.util.UUID.fromString("550e8400-e29b-41d4-a716-446655440000"))
        );
        verify(jdbcTemplate).update(
            eq("INSERT INTO gtd.next_action_contexts (next_action_id, context_id) VALUES (?, ?) ON CONFLICT (next_action_id, context_id) DO NOTHING"),
            eq(java.util.UUID.fromString("550e8400-e29b-41d4-a716-446655440000")),
            eq(java.util.UUID.fromString("770e8400-e29b-41d4-a716-446655440000"))
        );
    }

    @Test
    void pushesNextActionDeleteEventAndDeletesContexts() {
        SyncOutboxEvent event = new SyncOutboxEvent(
            "next_actions", "550e8400-e29b-41d4-a716-446655440000", SyncOutboxOperation.DELETE,
            "{\"item_id\":\"550e8400-e29b-41d4-a716-446655440000\"}"
        );

        service.pushEvent(event);

        verify(jdbcTemplate).update(
            eq("DELETE FROM gtd.next_action_contexts WHERE next_action_id = ?"),
            eq(java.util.UUID.fromString("550e8400-e29b-41d4-a716-446655440000"))
        );
        verify(jdbcTemplate).update(
            eq("DELETE FROM gtd.next_actions WHERE item_id = ?"),
            eq(java.util.UUID.fromString("550e8400-e29b-41d4-a716-446655440000"))
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
