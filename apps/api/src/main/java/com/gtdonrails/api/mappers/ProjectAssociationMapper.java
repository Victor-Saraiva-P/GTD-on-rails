package com.gtdonrails.api.mappers;

import com.gtdonrails.api.entities.Item;
import com.gtdonrails.api.entities.ProjectItem;
import com.gtdonrails.api.repositories.ProjectItemRepository;
import org.springframework.stereotype.Component;

@Component
public class ProjectAssociationMapper {

    private final ProjectItemRepository projectItemRepository;

    public ProjectAssociationMapper(ProjectItemRepository projectItemRepository) {
        this.projectItemRepository = projectItemRepository;
    }

    /**
     * Resolves the display title for an item's owning project.
     *
     * <p>Example: {@code projectAssociationMapper.titleFor(item)}.</p>
     */
    public String titleFor(Item item) {
        if (projectItemRepository == null) return null;
        ProjectItem projectItem = projectItemRepository.findById(item.getId()).orElse(null);
        if (projectItem == null || projectItem.getProject() == null) return null;
        return projectItem.getProject().getItem().getTitle().value();
    }
}
