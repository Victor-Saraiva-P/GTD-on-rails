package com.gtdonrails.api.mappers;

import java.util.UUID;

import com.gtdonrails.api.entities.Item;
import com.gtdonrails.api.entities.Project;
import com.gtdonrails.api.entities.ProjectItem;
import org.springframework.stereotype.Component;

@Component
public class ProjectAssociationMapper {

    /**
     * Resolves the ID for an item's owning project.
     *
     * <p>Example: {@code projectAssociationMapper.projectIdFor(item)}.</p>
     */
    public UUID projectIdFor(Item item) {
        if (item == null) return null;
        ProjectItem projectItem = item.getProjectItem();
        if (projectItem == null || projectItem.getProject() == null) return null;
        Project project = projectItem.getProject();
        if (project.getItemId() != null) {
            return project.getItemId();
        }
        return project.getItem() != null ? project.getItem().getId() : null;
    }

    /**
     * Resolves the display title for an item's owning project.
     *
     * <p>Example: {@code projectAssociationMapper.titleFor(item)}.</p>
     */
    public String titleFor(Item item) {
        if (item == null) return null;
        ProjectItem projectItem = item.getProjectItem();
        if (projectItem == null || projectItem.getProject() == null || projectItem.getProject().getItem() == null) {
            return null;
        }
        return projectItem.getProject().getItem().getTitle().value();
    }
}
