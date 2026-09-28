package com.gtdonrails.api.repositories;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.time.LocalTime;
import java.util.List;
import java.util.UUID;

import com.gtdonrails.api.entities.Item;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

@SpringBootTest
@ActiveProfiles("test")
@Tag("integration")
class LocalTimeSqliteReadTests {

    @Autowired private ItemRepository itemRepository;
    @Autowired private JdbcTemplate jdbcTemplate;

    @Test
    @Transactional
    void findAllReadsTimeOnlyValuesAcrossEntities() {
        UUID nextActionId = UUID.randomUUID();
        UUID calendarId = UUID.randomUUID();
        UUID projectId = UUID.randomUUID();
        String timestamp = "2026-09-28 15:30:45.749";
        insertNextActionFixture(nextActionId, timestamp);
        insertCalendarFixture(calendarId, timestamp);
        insertProjectFixture(projectId, timestamp);

        List<Item> items = itemRepository.findAll();

        assertLocalTimes(items, nextActionId, calendarId, projectId);
    }

    private void assertLocalTimes(List<Item> items, UUID nextActionId, UUID calendarId, UUID projectId) {
        assertEquals(LocalTime.parse("09:00:00.000000000"), itemFor(items, nextActionId).getNextAction().getSchedule().getTimeStart());
        assertEquals(LocalTime.parse("09:26:38.258970477"), itemFor(items, nextActionId).getNextAction().getSchedule().getTimeEnd());
        assertEquals(LocalTime.parse("13:45:00.000000000"), itemFor(items, calendarId).getCalendar().getScheduledTime());
        assertEquals(LocalTime.parse("14:00:00.000000000"), itemFor(items, calendarId).getCalendar().getSchedule().getTimeStart());
        assertEquals(LocalTime.parse("14:30:00.000000000"), itemFor(items, calendarId).getCalendar().getSchedule().getTimeEnd());
        assertEquals(LocalTime.parse("18:42:11.000000001"), itemFor(items, projectId).getProject().getDoneTime());
    }

    private Item itemFor(List<Item> items, UUID itemId) {
        return items.stream().filter(item -> item.getId().equals(itemId)).findFirst().orElseThrow();
    }

    private void insertNextActionFixture(UUID itemId, String timestamp) {
        insertItemFixture(itemId, "NEXT_ACTION", timestamp);
        jdbcTemplate.update(
            "INSERT INTO next_actions (item_id, energy, estimated_time_minutes, date_start, time_start, time_end, all_day, status, created_at, updated_at) "
                + "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            itemId.toString(), 3.0, 15, "2026-09-28", "09:00:00.000000000", "09:26:38.258970477", 0, "ONGOING", timestamp, timestamp
        );
    }

    private void insertCalendarFixture(UUID itemId, String timestamp) {
        insertItemFixture(itemId, "CALENDAR", timestamp);
        jdbcTemplate.update(
            "INSERT INTO calendars (item_id, scheduled_date, scheduled_time, date_start, time_start, time_end, all_day, status, created_at, updated_at) "
                + "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            itemId.toString(), "2026-09-28", "13:45:00.000000000", "2026-09-28", "14:00:00.000000000", "14:30:00.000000000", 0, "ONGOING", timestamp, timestamp
        );
    }

    private void insertProjectFixture(UUID itemId, String timestamp) {
        insertItemFixture(itemId, "PROJECT", timestamp);
        jdbcTemplate.update(
            "INSERT INTO projects (item_id, status, done_date, done_time, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
            itemId.toString(), "DONE", "2026-09-28", "18:42:11.000000001", timestamp, timestamp
        );
    }

    private void insertItemFixture(UUID itemId, String status, String timestamp) {
        jdbcTemplate.update(
            "INSERT INTO items (id, title, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
            itemId.toString(), "Local time regression", status, timestamp, timestamp
        );
    }
}
