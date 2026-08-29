package com.gtdonrails.api.maintenance.cutover;

import java.util.List;
import java.util.UUID;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

@Component
public class LegacyCutoverValidator {

    private final JdbcTemplate jdbcTemplate;
    private final String expectedEnvironment;

    public LegacyCutoverValidator(
        JdbcTemplate jdbcTemplate,
        @Value("${gtd.database.environment:PRODUCTION}") String expectedEnvironment
    ) {
        this.jdbcTemplate = jdbcTemplate;
        this.expectedEnvironment = expectedEnvironment;
    }

    /**
     * Validates database identity, table row counts, foreign key integrity, and representative records.
     *
     * <p>Example: {@code validator.validate(sourceDataset)}.</p>
     */
    public void validate(LegacySqliteDataset dataset) {
        validateDatabaseIdentity();
        validateRowCounts(dataset);
        validateForeignKeys();
        validateRepresentativeReads(dataset);
    }

    private void validateDatabaseIdentity() {
        String actual = jdbcTemplate.queryForObject(
            "SELECT environment FROM database_identity WHERE id = 1", String.class);
        if (!expectedEnvironment.equals(actual)) {
            throw new IllegalStateException(
                "database identity value '%s' is invalid; expected %s".formatted(actual, expectedEnvironment));
        }
    }

    private void validateRowCounts(LegacySqliteDataset dataset) {
        assertCount("items", dataset.items().size());
        assertCount("contexts", dataset.contexts().size());
        assertCount("item_assets", dataset.itemAssets().size());
        assertCount("context_icon_assets", dataset.contextIconAssets().size());
        assertCount("next_actions", dataset.nextActions().size());
        assertCount("next_action_contexts", dataset.nextActionContexts().size());
        assertCount("calendars", dataset.calendars().size());
        assertCount("maintenance_runs", dataset.maintenanceRuns().size());
        assertCount("google_credentials", dataset.googleCredentials().size());
        assertCount("google_calendars", dataset.googleCalendars().size());
    }

    private void assertCount(String table, int expected) {
        Integer actual = jdbcTemplate.queryForObject("SELECT count(*) FROM " + table, Integer.class);
        int count = actual != null ? actual : 0;
        if (count != expected) {
            throw new IllegalStateException(
                "table '%s' row count %d is invalid; expected %d".formatted(table, count, expected));
        }
    }

    private void validateForeignKeys() {
        assertNoOrphans("item_assets.item_id",
            "SELECT count(*) FROM item_assets a LEFT JOIN items i ON a.item_id = i.id WHERE i.id IS NULL");
        assertNoOrphans("context_icon_assets.context_id",
            "SELECT count(*) FROM context_icon_assets a LEFT JOIN contexts c ON a.context_id = c.id WHERE c.id IS NULL");
        assertNoOrphans("next_actions.item_id",
            "SELECT count(*) FROM next_actions na LEFT JOIN items i ON na.item_id = i.id WHERE i.id IS NULL");
        assertNoOrphans("next_action_contexts.next_action_id",
            "SELECT count(*) FROM next_action_contexts nac LEFT JOIN next_actions na ON nac.next_action_id = na.item_id WHERE na.item_id IS NULL");
        assertNoOrphans("next_action_contexts.context_id",
            "SELECT count(*) FROM next_action_contexts nac LEFT JOIN contexts c ON nac.context_id = c.id WHERE c.id IS NULL");
        assertNoOrphans("calendars.item_id",
            "SELECT count(*) FROM calendars cal LEFT JOIN items i ON cal.item_id = i.id WHERE i.id IS NULL");
    }

    private void assertNoOrphans(String relationship, String query) {
        Integer orphans = jdbcTemplate.queryForObject(query, Integer.class);
        if (orphans != null && orphans > 0) {
            throw new IllegalStateException(
                "foreign key relation '%s' orphaned count %d is invalid; expected 0".formatted(relationship, orphans));
        }
    }

    private void validateRepresentativeReads(LegacySqliteDataset dataset) {
        validateSampleItems(dataset.items());
    }

    private void validateSampleItems(List<LegacyItemRecord> items) {
        if (items.isEmpty()) return;
        LegacyItemRecord sample = items.getFirst();
        String title = jdbcTemplate.queryForObject(
            "SELECT title FROM items WHERE id = ?", String.class, sample.id());
        if (!sample.title().equals(title)) {
            throw new IllegalStateException(
                "item id '%s' title '%s' is invalid; expected '%s'".formatted(sample.id(), title, sample.title()));
        }
    }
}
