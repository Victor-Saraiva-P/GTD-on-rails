package com.gtdonrails.api.entities;

import java.time.Instant;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
@Table(name = "sync_outbox")
public class SyncOutboxEvent {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(columnDefinition = "integer")
    private Long id;

    @Column(name = "entity_type", nullable = false)
    private String entityType;

    @Column(name = "entity_id", nullable = false)
    private String entityId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private SyncOutboxOperation operation;

    @Column(nullable = false, columnDefinition = "text")
    private String payload;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private SyncOutboxStatus status = SyncOutboxStatus.PENDING;

    @Column(name = "retry_count", nullable = false)
    private int retryCount = 0;

    @Column(name = "last_error")
    private String lastError;

    protected SyncOutboxEvent() {
        // WHY: JPA requires a no-arg constructor for proxy instantiation.
    }

    public SyncOutboxEvent(String entityType, String entityId, SyncOutboxOperation operation, String payload) {
        this.entityType = entityType;
        this.entityId = entityId;
        this.operation = operation;
        this.payload = payload;
        this.createdAt = Instant.now();
    }

    public Long getId() { return id; }
    public String getEntityType() { return entityType; }
    public String getEntityId() { return entityId; }
    public SyncOutboxOperation getOperation() { return operation; }
    public String getPayload() { return payload; }
    public Instant getCreatedAt() { return createdAt; }
    public SyncOutboxStatus getStatus() { return status; }
    public int getRetryCount() { return retryCount; }
    public String getLastError() { return lastError; }

    /**
     * Marks the event as currently being processed by the sync worker.
     *
     * @example event.markProcessing()
     */
    public void markProcessing() {
        this.status = SyncOutboxStatus.PROCESSING;
    }

    /**
     * Marks the event as successfully synced to the remote database.
     *
     * @example event.markCompleted()
     */
    public void markCompleted() {
        this.status = SyncOutboxStatus.COMPLETED;
    }

    /**
     * Records a sync failure and increments the retry counter.
     *
     * @example event.markFailed("Connection timeout to Supabase")
     */
    public void markFailed(String error) {
        this.status = SyncOutboxStatus.FAILED;
        this.lastError = error;
        this.retryCount++;
    }

    /**
     * Resets a failed event to pending for retry.
     *
     * @example event.resetToPending()
     */
    public void resetToPending() {
        this.status = SyncOutboxStatus.PENDING;
    }
}
