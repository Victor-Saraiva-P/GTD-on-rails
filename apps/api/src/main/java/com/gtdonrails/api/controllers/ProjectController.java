package com.gtdonrails.api.controllers;

import java.util.List;
import java.util.UUID;

import com.gtdonrails.api.dtos.project.PatchProjectRequestDto;
import com.gtdonrails.api.dtos.project.ProjectResponseDto;
import com.gtdonrails.api.services.ProjectService;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/projects")
public class ProjectController {
    private final ProjectService projectService;

    public ProjectController(ProjectService projectService) {
        this.projectService = projectService;
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
     * Handles project title and deadline updates.
     *
     * <p>Example: {@code PATCH /projects/018f13b2-a7f3-7c44-8f1a-9f31f65a7fd2}.</p>
     */
    @PatchMapping("/{id}")
    public ProjectResponseDto patchProject(@PathVariable UUID id, @Valid @RequestBody PatchProjectRequestDto request) {
        return projectService.patchProject(id, request);
    }
}
