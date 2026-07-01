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
import com.gtdonrails.api.persistence.bootstrap.model.PersistenceChangeType;
import com.gtdonrails.api.persistence.bootstrap.services.PersistenceGitSyncService;
import com.gtdonrails.api.repositories.ProjectRepository;
import com.gtdonrails.api.types.Title;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ProjectService {
    private final ProjectRepository projectRepository;
    private final ProjectMapper projectMapper;
    private final ItemTextNormalizer itemTextNormalizer;
    private final PersistenceGitSyncService persistenceGitSyncService;
    private final AfterCommitExecutor afterCommitExecutor;
    private final Clock clock;

    public ProjectService(
        ProjectRepository projectRepository,
        ProjectMapper projectMapper,
        ItemTextNormalizer itemTextNormalizer,
        PersistenceGitSyncService persistenceGitSyncService,
        AfterCommitExecutor afterCommitExecutor,
        Clock clock
    ) {
        this.projectRepository = projectRepository;
        this.projectMapper = projectMapper;
        this.itemTextNormalizer = itemTextNormalizer;
        this.persistenceGitSyncService = persistenceGitSyncService;
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
        requestPersistenceSyncAfterCommit("project marked done");
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
     * Restores a done project to active commitments.
     *
     * <p>Example: {@code projectService.resetStatus(projectId)}.</p>
     */
    @Transactional
    public ProjectResponseDto resetStatus(UUID id) {
        Project project = findProject(id);
        project.resetStatus();
        ProjectResponseDto response = projectMapper.toResponse(projectRepository.save(project));
        requestPersistenceSyncAfterCommit("project status restored");
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
        requestPersistenceSyncAfterCommit("project updated");
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

    private void requestPersistenceSyncAfterCommit(String reason) {
        afterCommitExecutor.run(() ->
            persistenceGitSyncService.requestSync(reason, PersistenceChangeType.UPDATE_ITEM));
    }
}
