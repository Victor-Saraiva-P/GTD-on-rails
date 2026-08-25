package com.gtdonrails.api.services;

import java.net.URI;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.Comparator;
import java.util.List;
import java.util.UUID;

import com.gtdonrails.api.config.CacheNames;
import com.gtdonrails.api.dtos.inbox.CreateStuffRequestDto;
import com.gtdonrails.api.dtos.project.ProjectItemResponseDto;
import com.gtdonrails.api.entities.Item;
import com.gtdonrails.api.entities.Project;
import com.gtdonrails.api.entities.ProjectItem;
import com.gtdonrails.api.enums.ItemStatus;
import com.gtdonrails.api.exceptions.item.ItemNotFoundException;
import com.gtdonrails.api.normalizers.ItemTextNormalizer;
import com.gtdonrails.api.repositories.ItemRepository;
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
    private final CacheInvalidationService cacheInvalidationService;
    private final AfterCommitExecutor afterCommitExecutor;

    public ProjectItemService(
        ProjectRepository projectRepository,
        ProjectItemRepository projectItemRepository,
        ItemRepository itemRepository,
        ItemTextNormalizer itemTextNormalizer,
        CacheInvalidationService cacheInvalidationService,
        AfterCommitExecutor afterCommitExecutor
    ) {
        this.projectRepository = projectRepository;
        this.projectItemRepository = projectItemRepository;
        this.itemRepository = itemRepository;
        this.itemTextNormalizer = itemTextNormalizer;
        this.cacheInvalidationService = cacheInvalidationService;
        this.afterCommitExecutor = afterCommitExecutor;
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
        Item savedItem = itemRepository.saveAndFlush(item);
        projectItemRepository.insertProjectItem(project.getItemId(), savedItem.getId());
        afterCommitExecutor.run(cacheInvalidationService::evictProjectMutation);
        return toResponse(new ProjectItem(project, savedItem));
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
            .map(this::toResponse)
            .toList();
    }

    public URI inboxLocation(ProjectItemResponseDto response) {
        return URI.create("/inbox/" + response.id());
    }

    private Project findActiveProject(UUID projectId) {
        return projectRepository.findByItemIdAndItem_DeletedAtIsNull(projectId)
            .orElseThrow(() -> new ItemNotFoundException("project " + projectId + " not found"));
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
        if (status == ItemStatus.CALENDAR) return 1;
        if (hasNextActionDeadline(projectItem)) return 2;
        return 3;
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

    private ProjectItemResponseDto toResponse(ProjectItem projectItem) {
        Item item = projectItem.getItem();
        return new ProjectItemResponseDto(projectItem.getProject().getItemId(), item.getId(), item.getStatus().name(), item.getTitle().value(), item.getBody(), item.getCreatedAt(), calendarDate(projectItem), calendarTime(projectItem), nextActionDeadline(projectItem));
    }
}
