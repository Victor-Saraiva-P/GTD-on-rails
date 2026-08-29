package com.gtdonrails.api.config;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.UUID;

import com.gtdonrails.api.entities.Item;
import com.gtdonrails.api.entities.SyncOutboxEvent;
import com.gtdonrails.api.entities.SyncOutboxOperation;
import com.gtdonrails.api.services.DatabaseSyncService;
import com.gtdonrails.api.types.Title;
import org.hibernate.event.spi.PostDeleteEvent;
import org.hibernate.event.spi.PostInsertEvent;
import org.hibernate.persister.entity.EntityPersister;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.jdbc.core.JdbcTemplate;

@ExtendWith(MockitoExtension.class)
class OutboxHibernateListenerTests {

    @Mock
    private JdbcTemplate jdbcTemplate;
    @Mock
    private DatabaseSyncService databaseSyncService;
    @Mock
    private PostInsertEvent postInsertEvent;
    @Mock
    private PostDeleteEvent postDeleteEvent;
    @Mock
    private EntityPersister persister;

    private OutboxHibernateListener listener;

    @BeforeEach
    void setUp() {
        listener = new OutboxHibernateListener(jdbcTemplate, databaseSyncService);
    }

    @Test
    void capturesInsertEventForDomainEntity() throws Exception {
        Item item = new Item(new Title("Buy milk"), "Whole milk");
        UUID itemId = UUID.randomUUID();
        setEntityId(item, itemId);

        when(postInsertEvent.getEntity()).thenReturn(item);
        when(postInsertEvent.getPersister()).thenReturn(persister);
        when(persister.getRootTableName()).thenReturn("items");

        listener.onPostInsert(postInsertEvent);

        verify(jdbcTemplate).update(
            contains("insert into sync_outbox"),
            eq("items"),
            eq(itemId.toString()),
            eq("INSERT"),
            contains("Buy milk")
        );
        verify(databaseSyncService).notifyNewEvents();
    }

    @Test
    void capturesDeleteEventForDomainEntity() throws Exception {
        Item item = new Item(new Title("Read book"), null);
        UUID itemId = UUID.randomUUID();
        setEntityId(item, itemId);

        when(postDeleteEvent.getEntity()).thenReturn(item);
        when(postDeleteEvent.getPersister()).thenReturn(persister);
        when(persister.getRootTableName()).thenReturn("items");

        listener.onPostDelete(postDeleteEvent);

        verify(jdbcTemplate).update(
            contains("insert into sync_outbox"),
            eq("items"),
            eq(itemId.toString()),
            eq("DELETE"),
            contains(itemId.toString())
        );
        verify(databaseSyncService).notifyNewEvents();
    }

    @Test
    void skipsExcludedEntitiesLikeSyncOutboxEvent() {
        SyncOutboxEvent event = new SyncOutboxEvent("items", "id-1", SyncOutboxOperation.INSERT, "{}");
        when(postInsertEvent.getEntity()).thenReturn(event);

        listener.onPostInsert(postInsertEvent);

        verify(jdbcTemplate, never()).update(any(), any(), any(), any(), any());
        verify(databaseSyncService, never()).notifyNewEvents();
    }

    private void setEntityId(Item item, UUID id) throws Exception {
        var field = Item.class.getDeclaredField("id");
        field.setAccessible(true);
        field.set(item, id);
    }
}
