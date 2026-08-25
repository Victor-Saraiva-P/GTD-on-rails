package com.gtdonrails.api.controllers;

import java.util.List;
import java.util.UUID;

import com.gtdonrails.api.dtos.inbox.CreateStuffRequestDto;
import com.gtdonrails.api.dtos.project.PatchProjectRequestDto;
import com.gtdonrails.api.dtos.project.ProjectItemResponseDto;
import com.gtdonrails.api.dtos.project.ProjectResponseDto;
import com.gtdonrails.api.services.ProjectItemService;
import com.gtdonrails.api.services.ProjectService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/projects")
public class ProjectController {
    private final ProjectService projectService;
    private final ProjectItemService projectItemService;

    public ProjectController(ProjectService projectService, ProjectItemService projectItemService) {
        this.projectService = projectService;
        this.projectItemService = projectItemService;
    }

    /**
     * Handles project list requests.
     *
     * <p>Example: {@code GET /projects}.</p>
     */
    @GetMapping
    public List<ProjectResponseDto> listProjects() {
        return projectService.listProjects();
    }

    /**
     * Handles completed project list requests.
     *
     * <p>Example: {@code GET /projects/done}.</p>
     */
    @GetMapping("/done")
    public List<ProjectResponseDto> listDoneProjects() {
        return projectService.listDoneProjects();
    }

    /**
     * Handles deleted project list requests.
     *
     * <p>Example: {@code GET /projects/deleted}.</p>
     */
    @GetMapping("/deleted")
    public List<ProjectResponseDto> listDeletedProjects() {
        return projectService.listDeletedProjects();
    }

    /**
     * Handles project title and deadline updates.
     *
     * <p>Example: {@code PATCH /projects/018f13b2-a7f3-7c44-8f1a-9f31f65a7fd2}.</p>
     */
    @PatchMapping("/{id}")
    public ProjectResponseDto patchProject(@PathVariable UUID id, @Valid @RequestBody PatchProjectRequestDto request) {
        return projectService.patchProject(id, request);
    }

    /**
     * Handles project completion requests.
     *
     * <p>Example: {@code POST /projects/018f13b2-a7f3-7c44-8f1a-9f31f65a7fd2/done}.</p>
     */
    @PostMapping("/{id}/done")
    public ProjectResponseDto markDone(@PathVariable UUID id) {
        return projectService.markDone(id);
    }

    /**
     * Handles project status reset requests.
     *
     * <p>Example: {@code POST /projects/018f13b2-a7f3-7c44-8f1a-9f31f65a7fd2/reset-status}.</p>
     */
    @PostMapping("/{id}/reset-status")
    public ProjectResponseDto resetStatus(@PathVariable UUID id) {
        return projectService.resetStatus(id);
    }

    /**
     * Handles project soft deletion requests.
     *
     * <p>Example: {@code DELETE /projects/018f13b2-a7f3-7c44-8f1a-9f31f65a7fd2}.</p>
     */
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteProject(@PathVariable UUID id) {
        projectService.deleteProject(id);
        return ResponseEntity.noContent().build();
    }

    /**
     * Handles project recovery requests.
     *
     * <p>Example: {@code POST /projects/018f13b2-a7f3-7c44-8f1a-9f31f65a7fd2/recover}.</p>
     */
    @PostMapping("/{id}/recover")
    public ProjectResponseDto recoverProject(@PathVariable UUID id) {
        return projectService.recoverProject(id);
    }

    /**
     * Handles project action item list requests.
     *
     * <p>Example: {@code GET /projects/018f13b2-a7f3-7c44-8f1a-9f31f65a7fd2/items/actions}.</p>
     */
    @GetMapping("/{id}/items/actions")
    public List<ProjectItemResponseDto> listProjectActions(@PathVariable UUID id) {
        return projectItemService.listProjectActions(id);
    }

    /**
     * Handles project-scoped stuff capture requests.
     *
     * <p>Example: {@code POST /projects/018f13b2-a7f3-7c44-8f1a-9f31f65a7fd2/items/stuff}.</p>
     */
    @PostMapping("/{id}/items/stuff")
    public ResponseEntity<ProjectItemResponseDto> createProjectStuff(
        @PathVariable UUID id,
        @Valid @RequestBody CreateStuffRequestDto request
    ) {
        ProjectItemResponseDto response = projectItemService.createProjectStuff(id, request);
        return ResponseEntity.created(projectItemService.inboxLocation(response)).body(response);
    }
}
