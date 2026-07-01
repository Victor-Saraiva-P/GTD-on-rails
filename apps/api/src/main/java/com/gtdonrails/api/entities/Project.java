package com.gtdonrails.api.entities;

import java.time.Clock;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.UUID;

import com.gtdonrails.api.enums.ProjectStatus;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
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

    @Column(name = "done_date")
    private LocalDate doneDate;

    @Column(name = "done_time")
    private LocalTime doneTime;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 50)
    private ProjectStatus status = ProjectStatus.ACTIVE;

    public Project() {
    }

    public Project(Item item, LocalDate deadline) {
        setItem(item);
        setDeadline(deadline);
        status = ProjectStatus.ACTIVE;
    }

    /**
     * Marks this project as done with the current clock date and time.
     *
     * <p>Example: {@code project.markDone(clock)}.</p>
     */
    public void markDone(Clock clock) {
        requireClock(clock);
        if (status == ProjectStatus.DONE) return;
        doneDate = LocalDate.now(clock);
        doneTime = LocalTime.now(clock);
        status = ProjectStatus.DONE;
    }

    /**
     * Restores this project to active commitments and clears completion time.
     *
     * <p>Example: {@code project.resetStatus()}.</p>
     */
    public void resetStatus() {
        doneDate = null;
        doneTime = null;
        status = ProjectStatus.ACTIVE;
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

    private static void requireClock(Clock clock) {
        if (clock == null) throw new IllegalArgumentException("clock value 'null' is invalid; expected Clock");
    }
}
