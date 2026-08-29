package com.gtdonrails.api.entities;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import org.junit.jupiter.api.Test;

class OutboxTableMetadataTests {

    @Test
    void resolvesPrimaryKeyColumnForStandardTables() {
        assertEquals("id", OutboxTableMetadata.primaryKeyColumn("items"));
        assertEquals("id", OutboxTableMetadata.primaryKeyColumn("contexts"));
        assertEquals("id", OutboxTableMetadata.primaryKeyColumn("item_assets"));
    }

    @Test
    void resolvesPrimaryKeyColumnForItemJoinedTables() {
        assertEquals("item_id", OutboxTableMetadata.primaryKeyColumn("next_actions"));
        assertEquals("item_id", OutboxTableMetadata.primaryKeyColumn("calendars"));
        assertEquals("item_id", OutboxTableMetadata.primaryKeyColumn("projects"));
        assertEquals("item_id", OutboxTableMetadata.primaryKeyColumn("project_items"));
    }

    @Test
    void resolvesPrimaryKeyColumnForMaintenanceRuns() {
        assertEquals("name", OutboxTableMetadata.primaryKeyColumn("maintenance_runs"));
    }

    @Test
    void rejectsBlankOrNullTableName() {
        assertThrows(IllegalArgumentException.class, () -> OutboxTableMetadata.primaryKeyColumn(""));
        assertThrows(IllegalArgumentException.class, () -> OutboxTableMetadata.primaryKeyColumn(null));
    }
}
