package com.gtdonrails.api.config;

import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.gtdonrails.api.entities.Calendar;
import com.gtdonrails.api.entities.Context;
import com.gtdonrails.api.entities.ContextIconAsset;
import com.gtdonrails.api.entities.Item;
import com.gtdonrails.api.entities.ItemAsset;
import com.gtdonrails.api.entities.NextAction;
import com.gtdonrails.api.entities.OutboxTableMetadata;
import com.gtdonrails.api.entities.Project;
import com.gtdonrails.api.entities.ProjectItem;
import com.gtdonrails.api.persistence.converters.ItemBodyConverter;
import com.gtdonrails.api.types.ScheduleWindow;

/**
 * Serializes domain entity state into JSON payloads for outbox synchronization.
 *
 * <p>Example: {@code serializer.serializeEntity(item)}.</p>
 */
public class OutboxPayloadSerializer {

    private final ObjectMapper objectMapper;
    private final ItemBodyConverter itemBodyConverter = new ItemBodyConverter();

    /**
     * Creates a serializer with a default ObjectMapper.
     *
     * @example new OutboxPayloadSerializer()
     */
    public OutboxPayloadSerializer() {
        this(new ObjectMapper());
    }

    /**
     * Creates a serializer with the provided ObjectMapper.
     *
     * @example new OutboxPayloadSerializer(objectMapper)
     */
    public OutboxPayloadSerializer(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    /**
     * Serializes an entity for delete operations by including only its primary key.
     *
     * @example serializer.serializeDeletePayload("items", "item-123")
     */
    public String serializeDeletePayload(String tableName, String entityId) {
        ObjectNode node = objectMapper.createObjectNode();
        String pkColumn = OutboxTableMetadata.primaryKeyColumn(tableName);
        node.put(pkColumn, entityId);
        return writeJson(node, tableName);
    }

    /**
     * Serializes domain entity state into a JSON payload.
     *
     * @example serializer.serializeEntity(item)
     */
    public String serializeEntity(Object entity) {
        ObjectNode node = objectMapper.createObjectNode();

        if (entity instanceof Item item) serializeItem(node, item);
        else if (entity instanceof NextAction na) serializeNextAction(node, na);
        else if (entity instanceof Calendar cal) serializeCalendar(node, cal);
        else if (entity instanceof Project proj) serializeProject(node, proj);
        else if (entity instanceof Context ctx) serializeContext(node, ctx);
        else if (entity instanceof ItemAsset asset) serializeItemAsset(node, asset);
        else if (entity instanceof ContextIconAsset icon) serializeContextIconAsset(node, icon);
        else if (entity instanceof ProjectItem pi) serializeProjectItem(node, pi);
        else return null;

        return writeJson(node, entity.getClass().getSimpleName());
    }

    private void serializeItem(ObjectNode node, Item item) {
        putString(node, "id", item.getId() != null ? item.getId().toString() : null);
        putString(node, "title", item.getTitle() != null ? item.getTitle().value() : null);
        putString(node, "body", item.getBody() != null ? itemBodyConverter.convertToDatabaseColumn(item.getBody()) : null);
        putString(node, "status", item.getStatus() != null ? item.getStatus().name() : null);
        addAuditFields(node, item.getCreatedAt(), item.getUpdatedAt(), item.getDeletedAt());
    }

    private void serializeNextAction(ObjectNode node, NextAction na) {
        putString(node, "item_id", na.getItemId() != null ? na.getItemId().toString() : null);
        if (na.getEnergy() != null) node.put("energy", na.getEnergy().doubleValue()); else node.putNull("energy");
        node.put("estimated_time_minutes", na.getEstimatedTime() != null ? na.getEstimatedTime().toMinutes() : 0);
        addScheduleWindow(node, na.getSchedule());
        putString(node, "deadline", na.getDeadline() != null ? na.getDeadline().toString() : null);
        putString(node, "status", na.getStatus() != null ? na.getStatus().name() : null);
        addContextIds(node, na.getContexts());
        addAuditFields(node, na.getCreatedAt(), na.getUpdatedAt(), na.getDeletedAt());
    }

    private void addContextIds(ObjectNode node, java.util.Set<Context> contexts) {
        if (contexts == null) return;
        var arrayNode = node.putArray("context_ids");
        contexts.stream()
            .filter(c -> c.getId() != null)
            .map(c -> c.getId().toString())
            .sorted()
            .forEach(arrayNode::add);
    }

    private void serializeCalendar(ObjectNode node, Calendar cal) {
        putString(node, "item_id", cal.getItemId() != null ? cal.getItemId().toString() : null);
        putString(node, "scheduled_date", cal.getScheduledDate() != null ? cal.getScheduledDate().toString() : null);
        putString(node, "scheduled_time", cal.getScheduledTime() != null ? cal.getScheduledTime().toString() : null);
        addScheduleWindow(node, cal.getSchedule());
        putString(node, "status", cal.getStatus() != null ? cal.getStatus().name() : null);
        addAuditFields(node, cal.getCreatedAt(), cal.getUpdatedAt(), cal.getDeletedAt());
    }

    private void serializeProject(ObjectNode node, Project proj) {
        putString(node, "item_id", proj.getItemId() != null ? proj.getItemId().toString() : null);
        putString(node, "deadline", proj.getDeadline() != null ? proj.getDeadline().toString() : null);
        putString(node, "status", proj.getStatus() != null ? proj.getStatus().name() : null);
        putString(node, "done_date", proj.getDoneDate() != null ? proj.getDoneDate().toString() : null);
        putString(node, "done_time", proj.getDoneTime() != null ? proj.getDoneTime().toString() : null);
        addAuditFields(node, proj.getCreatedAt(), proj.getUpdatedAt(), proj.getDeletedAt());
    }

    private void serializeContext(ObjectNode node, Context ctx) {
        putString(node, "id", ctx.getId() != null ? ctx.getId().toString() : null);
        putString(node, "name", ctx.getName());
        addAuditFields(node, ctx.getCreatedAt(), ctx.getUpdatedAt(), ctx.getDeletedAt());
    }

    private void serializeItemAsset(ObjectNode node, ItemAsset asset) {
        putString(node, "id", asset.getId() != null ? asset.getId().toString() : null);
        putString(node, "item_id", asset.getItem() != null && asset.getItem().getId() != null ? asset.getItem().getId().toString() : null);
        putString(node, "file_name", asset.getFileName());
        putString(node, "original_file_name", asset.getOriginalFileName());
        putString(node, "content_type", asset.getContentType());
        node.put("size", asset.getSize());
        addAuditFields(node, asset.getCreatedAt(), asset.getUpdatedAt(), asset.getDeletedAt());
    }

    private void serializeContextIconAsset(ObjectNode node, ContextIconAsset icon) {
        putString(node, "id", icon.getId() != null ? icon.getId().toString() : null);
        putString(node, "context_id", icon.getContext() != null && icon.getContext().getId() != null ? icon.getContext().getId().toString() : null);
        putString(node, "file_name", icon.getFileName());
        putString(node, "original_file_name", icon.getOriginalFileName());
        putString(node, "content_type", icon.getContentType());
        node.put("size", icon.getSize());
        addAuditFields(node, icon.getCreatedAt(), icon.getUpdatedAt(), icon.getDeletedAt());
    }

    private void serializeProjectItem(ObjectNode node, ProjectItem pi) {
        putString(node, "item_id", pi.getItem() != null && pi.getItem().getId() != null ? pi.getItem().getId().toString() : null);
        putString(node, "project_id", pi.getProject() != null && pi.getProject().getItemId() != null ? pi.getProject().getItemId().toString() : null);
    }

    private void addScheduleWindow(ObjectNode node, ScheduleWindow schedule) {
        if (schedule == null) {
            node.putNull("date_start");
            node.putNull("date_end");
            node.putNull("time_start");
            node.putNull("time_end");
            node.put("all_day", false);
            return;
        }
        putString(node, "date_start", schedule.getDateStart() != null ? schedule.getDateStart().toString() : null);
        putString(node, "date_end", schedule.getDateEnd() != null ? schedule.getDateEnd().toString() : null);
        putString(node, "time_start", schedule.getTimeStart() != null ? schedule.getTimeStart().toString() : null);
        putString(node, "time_end", schedule.getTimeEnd() != null ? schedule.getTimeEnd().toString() : null);
        node.put("all_day", schedule.isAllDay());
    }

    private void addAuditFields(ObjectNode node, Instant createdAt, Instant updatedAt, Instant deletedAt) {
        putString(node, "created_at", createdAt != null ? createdAt.toString() : null);
        putString(node, "updated_at", updatedAt != null ? updatedAt.toString() : null);
        putString(node, "deleted_at", deletedAt != null ? deletedAt.toString() : null);
    }

    private void putString(ObjectNode node, String key, String value) {
        if (value == null) node.putNull(key);
        else node.put(key, value);
    }

    private String writeJson(ObjectNode node, String context) {
        try {
            return objectMapper.writeValueAsString(node);
        } catch (Exception exception) {
            throw new IllegalStateException(
                "Failed to serialize payload for '%s'; expected valid JSON ObjectNode".formatted(context),
                exception
            );
        }
    }
}
