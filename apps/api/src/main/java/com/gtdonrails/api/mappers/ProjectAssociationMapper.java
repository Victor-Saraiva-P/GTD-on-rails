package com.gtdonrails.api.mappers;

import java.util.UUID;

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
     * Resolves the ID for an item's owning project.
     *
     * <p>Example: {@code projectAssociationMapper.projectIdFor(item)}.</p>
     */
    public UUID projectIdFor(Item item) {
        ProjectItem projectItem = findProjectItem(item);
        if (projectItem == null || projectItem.getProject() == null) return null;
        return projectItem.getProject().getItemId();
    }

    /**
     * Resolves the display title for an item's owning project.
     *
     * <p>Example: {@code projectAssociationMapper.titleFor(item)}.</p>
     */
    public String titleFor(Item item) {
        ProjectItem projectItem = findProjectItem(item);
        if (projectItem == null || projectItem.getProject() == null) return null;
        return projectItem.getProject().getItem().getTitle().value();
    }

    private ProjectItem findProjectItem(Item item) {
        if (projectItemRepository == null) return null;
        return projectItemRepository.findById(item.getId()).orElse(null);
    }
}
