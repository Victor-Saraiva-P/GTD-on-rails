package com.gtdonrails.api.services;

import java.math.BigDecimal;
import java.net.URI;
import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.Comparator;
import java.util.List;
import java.util.UUID;

import com.gtdonrails.api.config.CacheNames;
import com.gtdonrails.api.dtos.inbox.CreateStuffRequestDto;
import com.gtdonrails.api.dtos.item.ItemResponseDto;
import com.gtdonrails.api.dtos.project.ProjectItemResponseDto;
import com.gtdonrails.api.entities.Item;
import com.gtdonrails.api.entities.Project;
import com.gtdonrails.api.entities.ProjectItem;
import com.gtdonrails.api.enums.CalendarStatus;
import com.gtdonrails.api.enums.ItemStatus;
import com.gtdonrails.api.enums.NextActionStatus;
import com.gtdonrails.api.exceptions.item.ItemNotFoundException;
import com.gtdonrails.api.mappers.ItemMapper;
import com.gtdonrails.api.normalizers.ItemTextNormalizer;
import com.gtdonrails.api.repositories.ItemRepository;
import com.gtdonrails.api.dtos.context.ContextResponseDto;
import com.gtdonrails.api.mappers.ContextMapper;
import com.gtdonrails.api.repositories.ProjectItemRepository;
import com.gtdonrails.api.repositories.ProjectRepository;
import com.gtdonrails.api.types.Title;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ProjectItemService {

    private final ProjectRepository projectRepository;
    private final ProjectItemRepository projectItemRepository;
    private final ItemRepository itemRepository;
    private final ItemTextNormalizer itemTextNormalizer;
    private final ContextMapper contextMapper;
    private final ItemMapper itemMapper;
    private final CacheInvalidationService cacheInvalidationService;
    private final AfterCommitExecutor afterCommitExecutor;
    private final jakarta.persistence.EntityManager entityManager;
    private final org.springframework.jdbc.core.JdbcTemplate jdbcTemplate;
    private final DatabaseSyncService databaseSyncService;

    public ProjectItemService(
        ProjectRepository projectRepository, ProjectItemRepository projectItemRepository,
        ItemRepository itemRepository, ItemTextNormalizer itemTextNormalizer,
        ContextMapper contextMapper, ItemMapper itemMapper,
        CacheInvalidationService cacheInvalidationService, AfterCommitExecutor afterCommitExecutor,
        jakarta.persistence.EntityManager entityManager,
        org.springframework.jdbc.core.JdbcTemplate jdbcTemplate,
        @org.springframework.context.annotation.Lazy DatabaseSyncService databaseSyncService
    ) {
        this.projectRepository = projectRepository;
        this.projectItemRepository = projectItemRepository;
        this.itemRepository = itemRepository;
        this.itemTextNormalizer = itemTextNormalizer;
        this.contextMapper = contextMapper;
        this.itemMapper = itemMapper;
        this.cacheInvalidationService = cacheInvalidationService;
        this.afterCommitExecutor = afterCommitExecutor;
        this.entityManager = entityManager;
        this.jdbcTemplate = jdbcTemplate;
        this.databaseSyncService = databaseSyncService;
    }

    /**
     * Creates captured stuff that belongs to one project.
     *
     * <p>Example: {@code projectItemService.createProjectStuff(projectId, request)}.</p>
     */
    @Transactional
    public ProjectItemResponseDto createProjectStuff(UUID projectId, CreateStuffRequestDto request) {
        Project project = findActiveProject(projectId);
        Item item = new Item(new Title(itemTextNormalizer.normalizeTitle(request.title())), null);
        item.markAsStuff();
        Item savedItem = itemRepository.save(item);
        projectItemRepository.insertProjectItem(project.getItemId(), savedItem.getId());
        recordProjectItemOutbox(savedItem.getId(), project.getItemId(), com.gtdonrails.api.entities.SyncOutboxOperation.INSERT);
        afterCommitExecutor.run(cacheInvalidationService::evictItemMutation);
        return toResponse(new ProjectItem(project, savedItem));
    }

    /**
     * Associates or disassociates an active item with an active project.
     *
     * <p>Example: {@code projectItemService.assignProject(itemId, projectId)}.</p>
     */
    @Transactional
    public ItemResponseDto assignProject(UUID itemId, UUID projectId) {
        Item item = itemRepository.findByIdAndDeletedAtIsNull(itemId)
            .orElseThrow(() -> new ItemNotFoundException("item ID '" + itemId + "' not found; expected existing active item UUID"));
        projectItemRepository.deleteByItemId(itemId);
        if (projectId != null) {
            Project project = findActiveProject(projectId);
            projectItemRepository.insertProjectItem(project.getItemId(), itemId);
            recordProjectItemOutbox(itemId, project.getItemId(), com.gtdonrails.api.entities.SyncOutboxOperation.INSERT);
        } else {
            recordProjectItemOutbox(itemId, null, com.gtdonrails.api.entities.SyncOutboxOperation.DELETE);
        }
        entityManager.flush();
        entityManager.refresh(item);
        afterCommitExecutor.run(cacheInvalidationService::evictItemMutation);
        return itemMapper.toResponse(item);
    }

    private void recordProjectItemOutbox(UUID itemId, UUID projectId, com.gtdonrails.api.entities.SyncOutboxOperation operation) {
        if (jdbcTemplate == null || databaseSyncService == null) return;
        String payload = operation == com.gtdonrails.api.entities.SyncOutboxOperation.DELETE
            ? "{\"item_id\":\"" + itemId + "\"}"
            : "{\"item_id\":\"" + itemId + "\",\"project_id\":\"" + projectId + "\"}";
        jdbcTemplate.update(
            "insert into sync_outbox (operation_id, entity_type, entity_id, operation, payload, status, retry_count) values (?, 'project_items', ?, ?, ?, 'PENDING', 0)",
            java.util.UUID.randomUUID().toString(), itemId.toString(), operation.name(), payload
        );
        afterCommitExecutor.run(databaseSyncService::notifyNewEvents);
    }

    /**
     * Lists actionable or clarifiable items associated with one project.
     *
     * <p>Example: {@code projectItemService.listProjectActions(projectId)}.</p>
     */
    @Cacheable(value = CacheNames.PROJECTS, key = "'actions:' + #projectId")
    @Transactional(readOnly = true)
    public List<ProjectItemResponseDto> listProjectActions(UUID projectId) {
        findActiveProject(projectId);
        return projectItemRepository.findProjectActionItems(projectId).stream()
            .sorted(projectActionOrdering())
            .map(this::toListResponse)
            .toList();
    }

    /**
     * Constructs the URI pointing to a created project item within inbox.
     *
     * <p>Example: {@code projectItemService.inboxLocation(response)}.</p>
     */
    public URI inboxLocation(ProjectItemResponseDto response) {
        return URI.create("/inbox/" + response.id());
    }

    private Project findActiveProject(UUID projectId) {
        return projectRepository.findByItemIdAndItem_DeletedAtIsNull(projectId)
            .orElseThrow(() -> new ItemNotFoundException("project ID '" + projectId + "' not found; expected existing active project UUID"));
    }

    private Comparator<ProjectItem> projectActionOrdering() {
        return Comparator.comparingInt(this::kindRank)
            .thenComparing(this::calendarDate, Comparator.nullsLast(Comparator.naturalOrder()))
            .thenComparing(this::calendarTime, Comparator.nullsLast(Comparator.naturalOrder()))
            .thenComparing(this::nextActionDeadline, Comparator.nullsLast(Comparator.naturalOrder()))
            .thenComparing(projectItem -> projectItem.getItem().getCreatedAt());
    }

    private int kindRank(ProjectItem projectItem) {
        ItemStatus status = projectItem.getItem().getStatus();
        if (status == ItemStatus.STUFF) return 0;
        if (isOngoing(projectItem)) return 1;
        if (status == ItemStatus.CALENDAR) return 2;
        if (hasNextActionDeadline(projectItem)) return 3;
        if (status == ItemStatus.NEXT_ACTION) return 4;
        return 5;
    }

    private boolean isOngoing(ProjectItem projectItem) {
        Item item = projectItem.getItem();
        if (item.getStatus() == ItemStatus.NEXT_ACTION && item.getNextAction() != null) {
            return item.getNextAction().getStatus() == NextActionStatus.ONGOING;
        }
        if (item.getStatus() == ItemStatus.CALENDAR && item.getCalendar() != null) {
            return item.getCalendar().getStatus() == CalendarStatus.ONGOING;
        }
        return false;
    }

    private boolean hasNextActionDeadline(ProjectItem projectItem) {
        return projectItem.getItem().getNextAction() != null && projectItem.getItem().getNextAction().getDeadline() != null;
    }

    private LocalDate calendarDate(ProjectItem projectItem) {
        if (projectItem.getItem().getCalendar() == null) return null;
        return projectItem.getItem().getCalendar().getScheduledDate();
    }

    private LocalTime calendarTime(ProjectItem projectItem) {
        if (projectItem.getItem().getCalendar() == null) return null;
        return projectItem.getItem().getCalendar().getScheduledTime();
    }

    private LocalDate nextActionDeadline(ProjectItem projectItem) {
        if (projectItem.getItem().getNextAction() == null) return null;
        return projectItem.getItem().getNextAction().getDeadline();
    }

    private BigDecimal nextActionEnergy(ProjectItem projectItem) {
        if (projectItem.getItem().getNextAction() == null) return null;
        return projectItem.getItem().getNextAction().getEnergy();
    }

    private java.time.Duration nextActionEstimatedTime(ProjectItem projectItem) {
        if (projectItem.getItem().getNextAction() == null) return null;
        return projectItem.getItem().getNextAction().getEstimatedTime();
    }

    private List<ContextResponseDto> nextActionContexts(ProjectItem projectItem) {
        if (projectItem.getItem().getNextAction() == null) return List.of();
        return projectItem.getItem().getNextAction().getContexts().stream()
            .map(contextMapper::toResponse)
            .toList();
    }

    private String resolveItemStatus(ProjectItem projectItem) {
        Item item = projectItem.getItem();
        if (item.getStatus() == ItemStatus.NEXT_ACTION && item.getNextAction() != null) {
            return item.getNextAction().getStatus().name();
        }
        if (item.getStatus() == ItemStatus.CALENDAR && item.getCalendar() != null) {
            return item.getCalendar().getStatus().name();
        }
        return item.getStatus().name();
    }

    private ProjectItemResponseDto toResponse(ProjectItem projectItem) {
        return toResponse(projectItem, projectItem.getItem().getBody());
    }

    private ProjectItemResponseDto toListResponse(ProjectItem projectItem) {
        return toResponse(projectItem, null);
    }

    private ProjectItemResponseDto toResponse(ProjectItem projectItem, com.gtdonrails.api.types.ItemBody body) {
        Item item = projectItem.getItem();
        return new ProjectItemResponseDto(
            projectItem.getProject().getItemId(),
            projectItem.getProject().getItem().getTitle().value(),
            item.getId(),
            item.getStatus().name(),
            item.getTitle().value(),
            body,
            item.getCreatedAt(),
            calendarDate(projectItem),
            calendarTime(projectItem),
            nextActionDeadline(projectItem),
            nextActionEnergy(projectItem),
            nextActionEstimatedTime(projectItem),
            nextActionContexts(projectItem),
            resolveItemStatus(projectItem)
        );
    }
}
