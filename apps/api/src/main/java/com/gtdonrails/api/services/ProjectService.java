package com.gtdonrails.api.services;

import java.util.List;
import java.util.UUID;

import com.gtdonrails.api.dtos.project.PatchProjectRequestDto;
import com.gtdonrails.api.dtos.project.ProjectResponseDto;
import com.gtdonrails.api.entities.Project;
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

    public ProjectService(
        ProjectRepository projectRepository,
        ProjectMapper projectMapper,
        ItemTextNormalizer itemTextNormalizer,
        PersistenceGitSyncService persistenceGitSyncService,
        AfterCommitExecutor afterCommitExecutor
    ) {
        this.projectRepository = projectRepository;
        this.projectMapper = projectMapper;
        this.itemTextNormalizer = itemTextNormalizer;
        this.persistenceGitSyncService = persistenceGitSyncService;
        this.afterCommitExecutor = afterCommitExecutor;
    }

    /**
     * Lists active projects oldest first.
     *
     * <p>Example: {@code projectService.listProjects()}.</p>
     */
    @Transactional(readOnly = true)
    public List<ProjectResponseDto> listProjects() {
        return projectRepository.findAllByItem_DeletedAtIsNullOrderByItem_CreatedAtAsc().stream()
            .map(projectMapper::toResponse)
            .toList();
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
        requestPersistenceSyncAfterCommit();
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

    private void requestPersistenceSyncAfterCommit() {
        afterCommitExecutor.run(() ->
            persistenceGitSyncService.requestSync("project updated", PersistenceChangeType.UPDATE_ITEM));
    }
}
