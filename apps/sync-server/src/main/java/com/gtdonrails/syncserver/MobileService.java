package com.gtdonrails.syncserver;

import java.time.Instant;
import java.time.LocalDate;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.springframework.stereotype.Service;

@Service
public class MobileService {

    private static final int TITLE_MAX_LENGTH = 200;

    private final SyncObjectStore store;
    private final ObjectMapper objectMapper;

    public MobileService(SyncObjectStore store, ObjectMapper objectMapper) {
        this.store = store;
        this.objectMapper = objectMapper;
    }

    /**
     * Builds the compact read model used by the mobile PWA.
     *
     * <p>Example: {@code mobileService.bootstrap(LocalDate.parse("2026-10-09"))}.</p>
     */
    public MobileBootstrap bootstrap(LocalDate localDate) {
        if (localDate == null) throw new IllegalArgumentException("localDate is required");
        Map<String, JsonNode> items = payloadsById("items");
        Map<String, String> projectTitles = projectTitles(items);
        List<MobileContext> contexts = contexts();
        List<MobileNextAction> actions = nextActions(items, projectTitles);
        List<MobileCalendarItem> calendar = calendar(items, projectTitles);
        List<MobileCalendarEntry> calendarEntries = calendarEntries(calendar, actions, localDate);
        return new MobileBootstrap(store.currentCursor(), contexts, actions, calendar, localDate.toString(), calendarEntries);
    }

    /**
     * Captures one unprocessed GTD item directly into the canonical store.
     *
     * <p>Example: {@code mobileService.capture(new MobileCaptureRequest("Buy milk"))}.</p>
     */
    public MobileCaptureResponse capture(MobileCaptureRequest request) {
        String title = normalizedTitle(request);
        String itemId = UUID.randomUUID().toString();
        SyncMutationResult result = store.apply(captureMutation(itemId, title));
        return new MobileCaptureResponse(itemId, result.revision(), result.cursor());
    }

    private String normalizedTitle(MobileCaptureRequest request) {
        String title = request == null ? null : request.title();
        String normalized = title == null ? "" : title.trim().replaceAll("\\s+", " ");
        if (normalized.isBlank() || normalized.length() > TITLE_MAX_LENGTH) {
            throw new IllegalArgumentException(
                "title value length '" + normalized.length() + "' is invalid; expected 1 to 200 characters");
        }
        return normalized;
    }

    private SyncMutation captureMutation(String itemId, String title) {
        ObjectNode payload = objectMapper.createObjectNode();
        String now = Instant.now().toString();
        payload.put("id", itemId);
        payload.put("title", title);
        payload.put("status", "STUFF");
        payload.put("created_at", now);
        payload.put("updated_at", now);
        payload.putNull("deleted_at");
        return new SyncMutation(
            UUID.randomUUID(), "items", itemId, 0, "UPSERT",
            payload.toString(), null, null, "application/json");
    }

    private List<MobileContext> contexts() {
        return store.objectsByType("contexts").stream()
            .map(this::payload)
            .filter(node -> !isDeleted(node))
            .map(node -> new MobileContext(text(node, "id"), text(node, "name")))
            .sorted(Comparator.comparing(MobileContext::name, String.CASE_INSENSITIVE_ORDER))
            .toList();
    }

    private List<MobileNextAction> nextActions(
        Map<String, JsonNode> items,
        Map<String, String> projectTitles
    ) {
        return store.objectsByType("next_actions").stream()
            .map(this::payload)
            .filter(node -> "NEXT_ACTION".equals(text(node, "status")))
            .map(node -> nextAction(node, items, projectTitles))
            .filter(action -> action.title() != null)
            .toList();
    }

    private MobileNextAction nextAction(
        JsonNode node,
        Map<String, JsonNode> items,
        Map<String, String> projectTitles
    ) {
        String id = text(node, "item_id");
        JsonNode item = activeItem(items, id);
        return new MobileNextAction(
            id,
            item == null ? null : text(item, "title"),
            doubleValue(node, "energy"),
            longValue(node, "estimated_time_minutes"),
            text(node, "deadline"),
            text(node, "status"),
            strings(node, "context_ids"),
            projectTitles.get(id),
            item == null ? null : text(item, "created_at")
        );
    }

    private List<MobileCalendarItem> calendar(
        Map<String, JsonNode> items,
        Map<String, String> projectTitles
    ) {
        return store.objectsByType("calendars").stream()
            .map(this::payload)
            .filter(node -> "CALENDAR".equals(text(node, "status")))
            .map(node -> calendarItem(node, items, projectTitles))
            .filter(item -> item.title() != null)
            .toList();
    }

    private MobileCalendarItem calendarItem(
        JsonNode node,
        Map<String, JsonNode> items,
        Map<String, String> projectTitles
    ) {
        String id = text(node, "item_id");
        JsonNode item = activeItem(items, id);
        return new MobileCalendarItem(
            id,
            item == null ? null : text(item, "title"),
            text(node, "scheduled_date"),
            text(node, "scheduled_time"),
            text(node, "status"),
            projectTitles.get(id)
        );
    }

    private List<MobileCalendarEntry> calendarEntries(
        List<MobileCalendarItem> calendar,
        List<MobileNextAction> actions,
        LocalDate localDate
    ) {
        List<MobileCalendarEntry> entries = new java.util.ArrayList<>();
        calendar.forEach(item -> entries.add(calendarEntry(item, localDate)));
        actions.stream().filter(action -> action.deadline() != null)
            .forEach(action -> entries.add(nextActionEntry(action, localDate)));
        entries.sort(this::compareCalendarEntries);
        return entries;
    }

    private MobileCalendarEntry calendarEntry(MobileCalendarItem item, LocalDate localDate) {
        LocalDate date = LocalDate.parse(item.scheduledDate());
        String state = date.isBefore(localDate) ? "OVERDUE"
            : date.equals(localDate) && item.scheduledTime() != null ? "SCHEDULED_TODAY"
            : date.equals(localDate) ? "DUE_TODAY" : "WEEK";
        return new MobileCalendarEntry(item.id(), item.title(), "CALENDAR", state, item.scheduledDate(),
            item.scheduledTime(), null, item.status(), item.projectTitle(), null);
    }

    private MobileCalendarEntry nextActionEntry(MobileNextAction action, LocalDate localDate) {
        LocalDate date = LocalDate.parse(action.deadline());
        String state = date.isBefore(localDate) ? "OVERDUE" : date.equals(localDate) ? "DUE_TODAY" : "WEEK";
        return new MobileCalendarEntry(action.id(), action.title(), "NEXT_ACTION", state, action.deadline(),
            null, action.deadline(), action.status(), action.projectTitle(), action.createdAt());
    }

    private int compareCalendarEntries(MobileCalendarEntry left, MobileCalendarEntry right) {
        int dateComparison = left.date().compareTo(right.date());
        if (dateComparison != 0) return dateComparison;
        int rankComparison = Integer.compare(calendarEntryRank(left), calendarEntryRank(right));
        if (rankComparison != 0) return rankComparison;
        if (left.scheduledTime() != null && right.scheduledTime() != null) return left.scheduledTime().compareTo(right.scheduledTime());
        int creationComparison = nullSafe(left.createdAt()).compareTo(nullSafe(right.createdAt()));
        return creationComparison != 0 ? creationComparison : left.id().compareTo(right.id());
    }

    private int calendarEntryRank(MobileCalendarEntry entry) {
        if ("NEXT_ACTION".equals(entry.sourceKind())) return 2;
        return entry.scheduledTime() == null ? 1 : 0;
    }

    private String nullSafe(String value) {
        return value == null ? "" : value;
    }

    private JsonNode activeItem(Map<String, JsonNode> items, String itemId) {
        JsonNode item = items.get(itemId);
        return item == null || isDeleted(item) ? null : item;
    }

    private Map<String, String> projectTitles(Map<String, JsonNode> items) {
        Map<String, String> projectItems = projectItemIds();
        Map<String, JsonNode> projects = payloadsById("projects");
        return projectItems.entrySet().stream()
            .filter(entry -> projects.containsKey(entry.getValue()))
            .collect(Collectors.toMap(Map.Entry::getKey, entry -> itemTitle(items, entry.getValue())));
    }

    private Map<String, String> projectItemIds() {
        return store.objectsByType("project_items").stream()
            .map(this::payload)
            .collect(Collectors.toMap(
                node -> text(node, "item_id"),
                node -> text(node, "project_id"),
                (left, right) -> right
            ));
    }

    private String itemTitle(Map<String, JsonNode> items, String itemId) {
        JsonNode item = items.get(itemId);
        return item == null ? "" : text(item, "title");
    }

    private Map<String, JsonNode> payloadsById(String objectType) {
        return store.objectsByType(objectType).stream()
            .collect(Collectors.toMap(
                SyncObjectSnapshot::objectId,
                this::payload,
                (left, right) -> right
            ));
    }

    private JsonNode payload(SyncObjectSnapshot snapshot) {
        try {
            return objectMapper.readTree(snapshot.payload());
        } catch (Exception exception) {
            throw new IllegalStateException(
                "canonical payload for '" + snapshot.objectType() + ":" + snapshot.objectId()
                    + "' is invalid; expected JSON object",
                exception
            );
        }
    }

    private boolean isDeleted(JsonNode node) {
        return text(node, "deleted_at") != null;
    }

    private String text(JsonNode node, String field) {
        JsonNode value = node.get(field);
        return value == null || value.isNull() ? null : value.asText();
    }

    private Double doubleValue(JsonNode node, String field) {
        JsonNode value = node.get(field);
        return value == null || value.isNull() ? null : value.asDouble();
    }

    private Long longValue(JsonNode node, String field) {
        JsonNode value = node.get(field);
        return value == null || value.isNull() ? null : value.asLong();
    }

    private List<String> strings(JsonNode node, String field) {
        JsonNode values = node.get(field);
        if (values == null || !values.isArray()) return List.of();
        return java.util.stream.StreamSupport.stream(values.spliterator(), false)
            .map(JsonNode::asText)
            .toList();
    }
}
