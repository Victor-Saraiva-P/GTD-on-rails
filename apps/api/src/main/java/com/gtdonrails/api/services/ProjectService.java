package com.gtdonrails.api.services;

import java.util.List;
import java.time.Clock;
import java.util.UUID;

import com.gtdonrails.api.dtos.project.PatchProjectRequestDto;
import com.gtdonrails.api.dtos.project.ProjectResponseDto;
import com.gtdonrails.api.entities.Project;
import com.gtdonrails.api.enums.ProjectStatus;
import com.gtdonrails.api.exceptions.item.ItemNotFoundException;
import com.gtdonrails.api.mappers.ProjectMapper;
import com.gtdonrails.api.normalizers.ItemTextNormalizer;
import com.gtdonrails.api.repositories.ProjectRepository;
import com.gtdonrails.api.types.Title;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ProjectService {
    private final ProjectRepository projectRepository;
    private final ProjectMapper projectMapper;
    private final ItemTextNormalizer itemTextNormalizer;
    private final DataSyncService dataSyncService;
    private final GoogleCalendarEventQueueService googleCalendarEventQueueService;
    private final AfterCommitExecutor afterCommitExecutor;
    private final Clock clock;

    public ProjectService(
        ProjectRepository projectRepository,
        ProjectMapper projectMapper,
        ItemTextNormalizer itemTextNormalizer,
        DataSyncService dataSyncService,
        GoogleCalendarEventQueueService googleCalendarEventQueueService,
        AfterCommitExecutor afterCommitExecutor,
        Clock clock
    ) {
        this.projectRepository = projectRepository;
        this.projectMapper = projectMapper;
        this.itemTextNormalizer = itemTextNormalizer;
        this.dataSyncService = dataSyncService;
        this.googleCalendarEventQueueService = googleCalendarEventQueueService;
        this.afterCommitExecutor = afterCommitExecutor;
        this.clock = clock;
    }

    /**
     * Lists active projects oldest first.
     *
     * <p>Example: {@code projectService.listProjects()}.</p>
     */
    @Transactional(readOnly = true)
    public List<ProjectResponseDto> listProjects() {
        return projectRepository.findAllByStatusAndItem_DeletedAtIsNullOrderByItem_CreatedAtAsc(ProjectStatus.ACTIVE).stream()
            .map(projectMapper::toResponse)
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
        ProjectResponseDto response = projectMapper.toResponse(projectRepository.save(project));
        requestGoogleCalendarEventUpsertAfterCommit(id);
        requestDataSyncAfterCommit("project marked done");
        return response;
    }

    /**
     * Lists done projects newest first.
     *
     * <p>Example: {@code projectService.listDoneProjects()}.</p>
     */
    @Transactional(readOnly = true)
    public List<ProjectResponseDto> listDoneProjects() {
        return projectRepository.findAllByStatusAndItem_DeletedAtIsNullOrderByDoneDateDescDoneTimeDescItem_UpdatedAtDesc(ProjectStatus.DONE).stream()
            .map(projectMapper::toResponse)
            .toList();
    }

    /**
     * Lists deleted projects newest first.
     *
     * <p>Example: {@code projectService.listDeletedProjects()}.</p>
     */
    @Transactional(readOnly = true)
    public List<ProjectResponseDto> listDeletedProjects() {
        return projectRepository.findAllByItem_DeletedAtIsNotNullOrderByItem_DeletedAtDesc().stream()
            .map(projectMapper::toResponse)
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
        ProjectResponseDto response = projectMapper.toResponse(projectRepository.save(project));
        requestGoogleCalendarEventUpsertAfterCommit(id);
        requestDataSyncAfterCommit("project status restored");
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
        ProjectResponseDto response = projectMapper.toResponse(projectRepository.save(project));
        requestGoogleCalendarEventUpsertAfterCommit(id);
        requestDataSyncAfterCommit("project updated");
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
        requestDataSyncAfterCommit("project deleted");
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
        ProjectResponseDto response = projectMapper.toResponse(projectRepository.save(project));
        requestGoogleCalendarEventUpsertAfterCommit(id);
        requestDataSyncAfterCommit("project recovered");
        return response;
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

    private void requestDataSyncAfterCommit(String reason) {
        afterCommitExecutor.run(() -> dataSyncService.requestSync(reason));
    }

    private void requestGoogleCalendarEventUpsertAfterCommit(UUID itemId) {
        afterCommitExecutor.run(() -> googleCalendarEventQueueService.requestUpsert(itemId));
    }

    private void requestGoogleCalendarEventDeleteAfterCommit(UUID itemId) {
        afterCommitExecutor.run(() -> googleCalendarEventQueueService.requestDelete(itemId));
    }
}
