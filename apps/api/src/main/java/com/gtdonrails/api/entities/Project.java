package com.gtdonrails.api.entities;

import java.time.LocalDate;
import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.MapsId;
import jakarta.persistence.OneToOne;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

@Entity
@Table(name = "projects")
@Getter
public class Project extends AuditableEntity {

    @Id
    @Column(name = "item_id", nullable = false, updatable = false)
    private UUID itemId;

    @OneToOne(optional = false)
    @MapsId
    @JoinColumn(name = "item_id", nullable = false)
    private Item item;

    @Setter
    @Column(name = "deadline")
    private LocalDate deadline;

    public Project() {
    }

    public Project(Item item, LocalDate deadline) {
        setItem(item);
        setDeadline(deadline);
    }

    /**
     * Connects this project to the item it clarifies.
     *
     * <p>Example: {@code project.setItem(item)}.</p>
     */
    public void setItem(Item item) {
        if (item == null) {
            throw new IllegalArgumentException("item value 'null' is invalid; expected Item");
        }
        this.item = item;
        if (item.getProject() != this) {
            item.setProject(this);
        }
    }

    @PrePersist
    void prePersist() {
        initializeAuditTimestamps();
    }

    @PreUpdate
    void preUpdate() {
        touchUpdatedAt();
    }
}
