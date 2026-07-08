package com.gtdonrails.api.entities;

import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.MapsId;
import jakarta.persistence.OneToOne;
import jakarta.persistence.Table;
import lombok.Getter;

@Entity
@Table(name = "project_items")
@Getter
public class ProjectItem {

    @Id
    @Column(name = "item_id", nullable = false, updatable = false)
    private UUID itemId;

    @OneToOne(optional = false)
    @MapsId
    @JoinColumn(name = "item_id", nullable = false)
    private Item item;

    @ManyToOne(optional = false)
    @JoinColumn(name = "project_id", nullable = false)
    private Project project;

    public ProjectItem() {
    }

    public ProjectItem(Project project, Item item) {
        setProject(project);
        setItem(item);
    }

    /**
     * Associates this project item with its owning project.
     *
     * <p>Example: {@code projectItem.setProject(project)}.</p>
     */
    public void setProject(Project project) {
        if (project == null) {
            throw new IllegalArgumentException("project value 'null' is invalid; expected Project");
        }
        this.project = project;
    }

    /**
     * Stores the GTD item that appears in the project detail page.
     *
     * <p>Example: {@code projectItem.setItem(item)}.</p>
     */
    public void setItem(Item item) {
        if (item == null) {
            throw new IllegalArgumentException("item value 'null' is invalid; expected Item");
        }
        this.item = item;
        this.itemId = item.getId();
    }
}
