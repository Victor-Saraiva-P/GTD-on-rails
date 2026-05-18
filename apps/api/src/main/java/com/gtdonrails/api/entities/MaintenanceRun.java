package com.gtdonrails.api.entities;

import java.time.Instant;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;

@Entity
@Table(name = "maintenance_runs")
@Getter
public class MaintenanceRun {

    @Id
    @Column(nullable = false, updatable = false)
    private String name;

    @Column(name = "last_run_at", nullable = false)
    private Instant lastRunAt;

    public MaintenanceRun() {
    }

    public MaintenanceRun(String name, Instant lastRunAt) {
        this.name = name;
        this.lastRunAt = lastRunAt;
    }

    /**
     * Replaces the persisted completion instant for a maintenance task.
     *
     * <p>Example: {@code run.markCompletedAt(Instant.now())}.</p>
     */
    public void markCompletedAt(Instant lastRunAt) {
        this.lastRunAt = lastRunAt;
    }
}
