package com.gtdonrails.api.repositories;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

import com.gtdonrails.api.entities.Item;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.Tag;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

@SpringBootTest
@ActiveProfiles("test")
@Tag("integration")
class DateOnlySqliteReadTests {

    @Autowired private ItemRepository itemRepository;
    @Autowired private JdbcTemplate jdbcTemplate;

    @Test
    @Transactional
    void findAllReadsDateOnlyAndLegacyTimestampDeadlines() {
        UUID itemId = UUID.randomUUID();
        UUID legacyItemId = UUID.randomUUID();
        String dateOnly = "2026-09-28";
        String timestamp = "2026-09-28 15:30:45.749";
        insertNextActionFixture(itemId, dateOnly, timestamp);
        insertNextActionFixture(legacyItemId, timestamp, timestamp);

        List<Item> items = itemRepository.findAll();

        assertEquals(LocalDate.parse(dateOnly), nextActionDeadline(items, itemId));
        assertEquals(LocalDate.parse(dateOnly), nextActionDeadline(items, legacyItemId));
    }

    private LocalDate nextActionDeadline(List<Item> items, UUID itemId) {
        return items.stream()
            .filter(item -> item.getId().equals(itemId))
            .findFirst()
            .orElseThrow()
            .getNextAction()
            .getDeadline();
    }

    private void insertNextActionFixture(UUID itemId, String deadline, String timestamp) {
        jdbcTemplate.update(
            "INSERT INTO items (id, title, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
            itemId.toString(), "Date only regression", "NEXT_ACTION", timestamp, timestamp
        );
        jdbcTemplate.update(
            "INSERT INTO next_actions (item_id, energy, estimated_time_minutes, deadline, created_at, updated_at) "
                + "VALUES (?, ?, ?, ?, ?, ?)",
            itemId.toString(), 3.0, 15, deadline, timestamp, timestamp
        );
    }
}
