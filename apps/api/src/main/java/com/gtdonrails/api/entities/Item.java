package com.gtdonrails.api.entities;

import java.time.Instant;
import java.util.UUID;

import com.gtdonrails.api.enums.ItemStatus;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import lombok.Getter;

@Entity
@Table(name = "items")
@Getter
public class Item {

    private static final int MAX_TITLE_LENGTH = 200;
    private static final int MAX_BODY_LENGTH = 10_000;

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(nullable = false, updatable = false)
    private UUID id;

    @Column(nullable = false, length = MAX_TITLE_LENGTH)
    private String title;

    @Column(length = MAX_BODY_LENGTH)
    private String body;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 50)
    private ItemStatus status;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @Column(name = "deleted_at")
    private Instant deletedAt;

    public Item() {
    }

    public Item(String title, String body) {
        setTitle(title);
        setBody(body);
    }

    public void setTitle(String title) {
        if (title == null || title.isBlank()) {
            throw new IllegalArgumentException("title is required");
        }
        if (title.length() > MAX_TITLE_LENGTH) {
            throw new IllegalArgumentException("title exceeds max length of " + MAX_TITLE_LENGTH);
        }

        this.title = title;
    }

    public void setBody(String body) {
        String normalizedBody = body;
        if (normalizedBody != null && normalizedBody.isBlank()) {
            normalizedBody = null;
        }
        if (normalizedBody != null && normalizedBody.length() > MAX_BODY_LENGTH) {
            throw new IllegalArgumentException("body exceeds max length of " + MAX_BODY_LENGTH);
        }

        this.body = normalizedBody;
    }

    public void softDelete() {
        this.deletedAt = Instant.now();
    }

    public void restore() {
        this.deletedAt = null;
    }

    public boolean isDeleted() {
        return deletedAt != null;
    }

    @PrePersist
    void prePersist() {
        status = inferStatus();
        if (updatedAt == null) {
            updatedAt = Instant.now();
        }
    }

    @PreUpdate
    void preUpdate() {
        status = inferStatus();
        updatedAt = Instant.now();
    }

    private ItemStatus inferStatus() {
        return ItemStatus.STUFF;
    }
}
