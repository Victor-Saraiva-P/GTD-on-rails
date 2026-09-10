package com.gtdonrails.api.services;

import java.util.List;
import java.util.Map;
import java.time.Clock;
import java.util.UUID;
import java.util.stream.Collectors;

import com.gtdonrails.api.config.CacheNames;
import com.gtdonrails.api.dtos.project.PatchProjectRequestDto;
import com.gtdonrails.api.dtos.project.ProjectActionCountProjection;
import com.gtdonrails.api.dtos.project.ProjectResponseDto;
import com.gtdonrails.api.entities.Project;
import com.gtdonrails.api.enums.ProjectStatus;
import com.gtdonrails.api.exceptions.item.ItemNotFoundException;
import com.gtdonrails.api.mappers.ProjectMapper;
import com.gtdonrails.api.normalizers.ItemTextNormalizer;
import com.gtdonrails.api.repositories.ProjectItemRepository;
import com.gtdonrails.api.repositories.ProjectRepository;
import com.gtdonrails.api.types.Title;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ProjectService {
    private final ProjectRepository projectRepository;
    private final ProjectItemRepository projectItemRepository;
    private final ProjectMapper projectMapper;
    private final ItemTextNormalizer itemTextNormalizer;
    private final GoogleCalendarEventQueueService googleCalendarEventQueueService;
    private final AfterCommitExecutor afterCommitExecutor;
    private final CacheInvalidationService cacheInvalidationService;
    private final Clock clock;

    public ProjectService(
        ProjectRepository projectRepository,
        ProjectItemRepository projectItemRepository,
        ProjectMapper projectMapper,
        ItemTextNormalizer itemTextNormalizer,
        GoogleCalendarEventQueueService googleCalendarEventQueueService,
        AfterCommitExecutor afterCommitExecutor,
        CacheInvalidationService cacheInvalidationService,
        Clock clock
    ) {
        this.projectRepository = projectRepository;
        this.projectItemRepository = projectItemRepository;
        this.projectMapper = projectMapper;
        this.itemTextNormalizer = itemTextNormalizer;
        this.googleCalendarEventQueueService = googleCalendarEventQueueService;
        this.afterCommitExecutor = afterCommitExecutor;
        this.cacheInvalidationService = cacheInvalidationService;
        this.clock = clock;
    }

    /**
     * Lists active projects oldest first.
     *
     * <p>Example: {@code projectService.listProjects()}.</p>
     */
    @Cacheable(value = CacheNames.PROJECTS, key = "'active'")
    @Transactional(readOnly = true)
    public List<ProjectResponseDto> listProjects() {
        Map<UUID, Long> actionCounts = fetchActionCountsByProject();
        return projectRepository.findAllByStatusAndItem_DeletedAtIsNullOrderByItem_CreatedAtAsc(ProjectStatus.ACTIVE).stream()
            .map(project -> projectMapper.toResponse(project, actionCounts.getOrDefault(project.getItemId(), 0L)))
            .toList();
    }

    /**
     * Marks an active project as done.
     *
     * <p>Example: {@code projectService.markDone(projectId)}.</p>
     */
    @Transactional
    public ProjectResponseDto markDone(UUID id) {
        Project project = findProject(id);
        project.markDone(clock);
        long count = projectItemRepository.countProjectActionItems(id);
        ProjectResponseDto response = projectMapper.toResponse(projectRepository.save(project), count);
        requestGoogleCalendarEventUpsertAfterCommit(id);
        evictCachesAfterCommit();
        return response;
    }

    /**
     * Lists done projects newest first.
     *
     * <p>Example: {@code projectService.listDoneProjects()}.</p>
     */
    @Cacheable(value = CacheNames.PROJECTS, key = "'done'")
    @Transactional(readOnly = true)
    public List<ProjectResponseDto> listDoneProjects() {
        Map<UUID, Long> actionCounts = fetchActionCountsByProject();
        return projectRepository.findAllByStatusAndItem_DeletedAtIsNullOrderByDoneDateDescDoneTimeDescItem_UpdatedAtDesc(ProjectStatus.DONE).stream()
            .map(project -> projectMapper.toResponse(project, actionCounts.getOrDefault(project.getItemId(), 0L)))
            .toList();
    }

    /**
     * Lists deleted projects newest first.
     *
     * <p>Example: {@code projectService.listDeletedProjects()}.</p>
     */
    @Cacheable(value = CacheNames.PROJECTS, key = "'deleted'")
    @Transactional(readOnly = true)
    public List<ProjectResponseDto> listDeletedProjects() {
        Map<UUID, Long> actionCounts = fetchActionCountsByProject();
        return projectRepository.findAllByItem_DeletedAtIsNotNullOrderByItem_DeletedAtDesc().stream()
            .map(project -> projectMapper.toResponse(project, actionCounts.getOrDefault(project.getItemId(), 0L)))
            .toList();
    }

    /**
     * Restores a done project to active commitments.
     *
     * <p>Example: {@code projectService.resetStatus(projectId)}.</p>
     */
    @Transactional
    public ProjectResponseDto resetStatus(UUID id) {
        Project project = findProject(id);
        project.resetStatus();
        long count = projectItemRepository.countProjectActionItems(id);
        ProjectResponseDto response = projectMapper.toResponse(projectRepository.save(project), count);
        requestGoogleCalendarEventUpsertAfterCommit(id);
        evictCachesAfterCommit();
        return response;
    }

    /**
     * Updates a project title and deadline.
     *
     * <p>Example: {@code projectService.patchProject(projectId, request)}.</p>
     */
    @Transactional
    public ProjectResponseDto patchProject(UUID id, PatchProjectRequestDto request) {
        Project project = findProject(id);
        applyTitlePatch(project, request);
        applyDeadlinePatch(project, request);
        long count = projectItemRepository.countProjectActionItems(id);
        ProjectResponseDto response = projectMapper.toResponse(projectRepository.save(project), count);
        requestGoogleCalendarEventUpsertAfterCommit(id);
        evictCachesAfterCommit();
        return response;
    }

    /**
     * Soft deletes a project without changing its project status.
     *
     * <p>Example: {@code projectService.deleteProject(projectId)}.</p>
     */
    @Transactional
    public void deleteProject(UUID id) {
        Project project = findProject(id);
        project.getItem().softDelete();
        projectRepository.save(project);
        requestGoogleCalendarEventDeleteAfterCommit(id);
        evictCachesAfterCommit();
    }

    /**
     * Recovers a deleted project without changing its project status.
     *
     * <p>Example: {@code projectService.recoverProject(projectId)}.</p>
     */
    @Transactional
    public ProjectResponseDto recoverProject(UUID id) {
        Project project = findAnyProject(id);
        project.getItem().restore();
        long count = projectItemRepository.countProjectActionItems(id);
        ProjectResponseDto response = projectMapper.toResponse(projectRepository.save(project), count);
        requestGoogleCalendarEventUpsertAfterCommit(id);
        evictCachesAfterCommit();
        return response;
    }

    private Map<UUID, Long> fetchActionCountsByProject() {
        return projectItemRepository.countActiveActionsGroupedByProject().stream()
            .collect(Collectors.toMap(ProjectActionCountProjection::getProjectId, ProjectActionCountProjection::getActionCount));
    }

    private void applyTitlePatch(Project project, PatchProjectRequestDto request) {
        if (request.title() == null) return;
        project.getItem().setTitle(new Title(itemTextNormalizer.normalizeTitle(request.title())));
    }

    private void applyDeadlinePatch(Project project, PatchProjectRequestDto request) {
        if (Boolean.TRUE.equals(request.clearDeadline())) project.setDeadline(null);
        if (request.deadline() != null) project.setDeadline(request.deadline());
    }

    private Project findProject(UUID id) {
        return projectRepository.findByItemIdAndItem_DeletedAtIsNull(id)
            .orElseThrow(() -> new ItemNotFoundException("project not found"));
    }

    private Project findAnyProject(UUID id) {
        return projectRepository.findById(id)
            .orElseThrow(() -> new ItemNotFoundException("project not found"));
    }

    private void requestGoogleCalendarEventUpsertAfterCommit(UUID itemId) {
        afterCommitExecutor.run(() -> googleCalendarEventQueueService.requestUpsert(itemId));
    }

    private void requestGoogleCalendarEventDeleteAfterCommit(UUID itemId) {
        afterCommitExecutor.run(() -> googleCalendarEventQueueService.requestDelete(itemId));
    }

    private void evictCachesAfterCommit() {
        afterCommitExecutor.run(cacheInvalidationService::evictProjectMutation);
    }
}
