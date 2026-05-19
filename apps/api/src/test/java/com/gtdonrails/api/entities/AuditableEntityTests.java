package com.gtdonrails.api.entities;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.lang.reflect.Field;
import java.time.Instant;

import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;

@Tag("unit")
class AuditableEntityTests {

    @Test
    void softDeleteSetsDeletedAt() {
        TestAuditableEntity entity = new TestAuditableEntity();

        assertNull(entity.getDeletedAt());

        entity.softDelete();

        assertNotNull(entity.getDeletedAt());
    }

    @Test
    void restoreClearsDeletedAt() {
        TestAuditableEntity entity = new TestAuditableEntity();
        entity.softDelete();

        entity.restore();

        assertNull(entity.getDeletedAt());
    }

    @Test
    void reportsWhetherEntityIsDeleted() {
        TestAuditableEntity entity = new TestAuditableEntity();

        assertFalse(entity.isDeleted());

        entity.softDelete();

        assertTrue(entity.isDeleted());
    }

    @Test
    void initializeAuditTimestampsSetsCreatedAtAndUpdatedAt() {
        TestAuditableEntity entity = new TestAuditableEntity();

        assertNull(entity.getCreatedAt());
        assertNull(entity.getUpdatedAt());

        entity.runInitializeAuditTimestamps();

        assertNotNull(entity.getCreatedAt());
        assertNotNull(entity.getUpdatedAt());
    }

    @Test
    void initializeAuditTimestampsKeepsExistingCreatedAt() throws Exception {
        TestAuditableEntity entity = new TestAuditableEntity();
        Instant existingCreatedAt = Instant.parse("2026-01-01T10:15:30Z");
        setField(entity, "createdAt", existingCreatedAt);

        entity.runInitializeAuditTimestamps();

        assertEquals(existingCreatedAt, entity.getCreatedAt());
        assertNotNull(entity.getUpdatedAt());
    }

    @Test
    void touchUpdatedAtOverwritesUpdatedAt() throws Exception {
        TestAuditableEntity entity = new TestAuditableEntity();
        Instant existingUpdatedAt = Instant.parse("2026-01-01T10:15:30Z");
        setField(entity, "updatedAt", existingUpdatedAt);

        entity.runTouchUpdatedAt();

        assertTrue(entity.getUpdatedAt().isAfter(existingUpdatedAt));
    }

    private void setField(TestAuditableEntity entity, String fieldName, Instant value) throws Exception {
        Field field = AuditableEntity.class.getDeclaredField(fieldName);
        field.setAccessible(true);
        field.set(entity, value);
    }

    private static final class TestAuditableEntity extends AuditableEntity {

        void runInitializeAuditTimestamps() {
            initializeAuditTimestamps();
        }

        void runTouchUpdatedAt() {
            touchUpdatedAt();
        }
    }
}
