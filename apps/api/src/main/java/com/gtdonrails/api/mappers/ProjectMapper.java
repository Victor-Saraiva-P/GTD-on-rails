package com.gtdonrails.api.mappers;

import com.gtdonrails.api.dtos.project.ProjectResponseDto;
import com.gtdonrails.api.entities.Project;
import org.springframework.stereotype.Component;

@Component
public class ProjectMapper {

    /**
     * Maps a Project entity into the Project API response with action count.
     *
     * <p>Example: {@code projectMapper.toResponse(project, 2L)}.</p>
     */
    public ProjectResponseDto toResponse(Project project, long actionCount) {
        return new ProjectResponseDto(
            project.getItemId(),
            project.getItem().getTitle().value(),
            project.getDeadline(),
            project.getDoneDate(),
            project.getDoneTime(),
            actionCount);
    }

    /**
     * Maps a Project entity into the Project API response.
     *
     * <p>Example: {@code projectMapper.toResponse(project)}.</p>
     */
    public ProjectResponseDto toResponse(Project project) {
        return toResponse(project, 0L);
    }
}
