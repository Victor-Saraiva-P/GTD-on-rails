package com.gtdonrails.api.config;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneId;
import java.util.List;
import java.util.Set;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.gtdonrails.api.entities.Calendar;
import com.gtdonrails.api.entities.Context;
import com.gtdonrails.api.entities.Item;
import com.gtdonrails.api.entities.NextAction;
import com.gtdonrails.api.types.ItemBody;
import com.gtdonrails.api.types.Title;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class OutboxPayloadSerializerTests {

    private OutboxPayloadSerializer serializer;
    private ObjectMapper objectMapper;

    @BeforeEach
    void setUp() {
        objectMapper = new ObjectMapper();
        serializer = new OutboxPayloadSerializer(objectMapper);
    }

    @Test
    void serializesDeletePayloadUsingPrimaryKey() throws Exception {
        String payload = serializer.serializeDeletePayload("next_actions", "action-123");
        JsonNode node = objectMapper.readTree(payload);

        assertEquals("action-123", node.get("item_id").asText());
    }

    @Test
    void serializesItemPayloadWithTitleAndBodyText() throws Exception {
        Item item = new Item(new Title("Test Task"), "Markdown note");
        String payload = serializer.serializeEntity(item);
        JsonNode node = objectMapper.readTree(payload);

        assertEquals("Test Task", node.get("title").asText());
        assertTrue(node.get("body").asText().contains("Markdown note"));
        assertEquals("STUFF", node.get("status").asText());
    }

    @Test
    void serializesNextActionPayloadWithSchedule() throws Exception {
        Item item = new Item(new Title("Action Task"), null);
        NextAction nextAction = new NextAction(
            item,
            new BigDecimal("3.0"),
            Duration.ofMinutes(45),
            Set.of()
        );
        Clock clock = Clock.fixed(Instant.parse("2026-08-27T09:00:00Z"), ZoneId.of("UTC"));
        nextAction.markOnGoing(clock);
        nextAction.setDeadline(LocalDate.of(2026, 8, 30));

        String payload = serializer.serializeEntity(nextAction);
        JsonNode node = objectMapper.readTree(payload);

        assertEquals(3.0, node.get("energy").asDouble());
        assertEquals(45, node.get("estimated_time_minutes").asInt());
        assertEquals("2026-08-27", node.get("date_start").asText());
        assertEquals("09:00", node.get("time_start").asText());
        assertEquals("2026-08-30", node.get("deadline").asText());
    }

    @Test
    void serializesCalendarAndContextPayloads() throws Exception {
        Item item = new Item(new Title("Meeting"), null);
        Calendar calendar = new Calendar(item, LocalDate.of(2026, 8, 27), LocalTime.of(14, 0));
        Context context = new Context("@office");

        String calPayload = serializer.serializeEntity(calendar);
        String ctxPayload = serializer.serializeEntity(context);

        JsonNode calNode = objectMapper.readTree(calPayload);
        JsonNode ctxNode = objectMapper.readTree(ctxPayload);

        assertEquals("2026-08-27", calNode.get("scheduled_date").asText());
        assertEquals("14:00", calNode.get("scheduled_time").asText());
        assertEquals("@office", ctxNode.get("name").asText());
    }
}
