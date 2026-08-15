package com.gtdonrails.api.maintenance;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import org.junit.jupiter.api.Test;

class FlywaySchemaRangeTests {

    @Test
    void evaluatesMatchingVersionAsCompatible() {
        FlywaySchemaRange range = new FlywaySchemaRange(1, 2);

        assertEquals(SchemaCompatibilityStatus.COMPATIBLE, range.evaluate("2"));
    }

    @Test
    void evaluatesOlderSupportedVersionAsUpgradeable() {
        FlywaySchemaRange range = new FlywaySchemaRange(1, 2);

        assertEquals(SchemaCompatibilityStatus.UPGRADEABLE, range.evaluate("1"));
    }

    @Test
    void evaluatesNullVersionAsUpgradeableForFreshDatabase() {
        FlywaySchemaRange range = new FlywaySchemaRange(1, 2);

        assertEquals(SchemaCompatibilityStatus.UPGRADEABLE, range.evaluate(null));
    }

    @Test
    void evaluatesNewerVersionAsUpdateRequired() {
        FlywaySchemaRange range = new FlywaySchemaRange(1, 2);

        assertEquals(SchemaCompatibilityStatus.UPDATE_REQUIRED, range.evaluate("3"));
    }

    @Test
    void evaluatesVersionBelowMinimumAsUnsupported() {
        FlywaySchemaRange range = new FlywaySchemaRange(2, 4);

        assertEquals(SchemaCompatibilityStatus.UNSUPPORTED, range.evaluate("1"));
    }

    @Test
    void rejectsInvalidRangeBounds() {
        IllegalArgumentException failure = assertThrows(
            IllegalArgumentException.class,
            () -> new FlywaySchemaRange(3, 2)
        );

        assertEquals("schema range bounds [3, 2] are invalid; expected min >= 1 and max >= min", failure.getMessage());
    }

    @Test
    void rejectsNonNumericVersionString() {
        FlywaySchemaRange range = new FlywaySchemaRange(1, 2);

        assertEquals(SchemaCompatibilityStatus.UNSUPPORTED, range.evaluate("invalid-version"));
    }
}
