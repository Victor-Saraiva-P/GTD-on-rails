package com.gtdonrails.api.entities;

import java.time.Instant;

import jakarta.persistence.Column;
import jakarta.persistence.MappedSuperclass;
import lombok.Getter;

@MappedSuperclass
@Getter
public abstract class AuditableEntity {

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @Column(name = "deleted_at")
    private Instant deletedAt;

    public void softDelete() {
        this.deletedAt = Instant.now();
    }

    public void restore() {
        this.deletedAt = null;
    }

    public boolean isDeleted() {
        return deletedAt != null;
    }

    protected void initializeAuditTimestamps() {
        if (createdAt == null) {
            createdAt = Instant.now();
        }
        if (updatedAt == null) {
            updatedAt = Instant.now();
        }
    }

    protected void touchUpdatedAt() {
        updatedAt = Instant.now();
    }
}
