package com.gtdonrails.api.Entities;

import java.time.Instant;
import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import lombok.Getter;

@Entity
@Table(name = "stuff")
@Getter
public class Stuff {

    private static final int MAX_TITLE_LENGTH = 200;
    private static final int MAX_BODY_LENGTH = 10_000;

    // We keep UUIDs as BLOB in SQLite to store the native 16-byte value.
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(nullable = false, updatable = false)
    private UUID id;

    @Column(nullable = false, length = MAX_TITLE_LENGTH)
    private String title;

    @Column(length = MAX_BODY_LENGTH)
    private String body;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @Column(name = "deleted_at")
    private Instant deletedAt;

    public Stuff() {
    }

    public Stuff(String title, String body) {
        this();
        updateTitle(title);
        updateBody(body);
    }

    public void updateTitle(String title) {
        String normalizedTitle = normalizeTitle(title);
        if (normalizedTitle == null || normalizedTitle.isBlank()) {
            throw new IllegalArgumentException("title is required");
        }
        if (normalizedTitle.length() > MAX_TITLE_LENGTH) {
            throw new IllegalArgumentException("title exceeds max length of " + MAX_TITLE_LENGTH);
        }

        this.title = normalizedTitle;
    }

    public void updateBody(String body) {
        String normalizedBody = normalizeBody(body);
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

    @PrePersist
    void prePersist() {
        if (updatedAt == null) {
            updatedAt = Instant.now();
        }
    }

    @PreUpdate
    void preUpdate() {
        updatedAt = Instant.now();
    }

    private String normalizeTitle(String value) {
        if (value == null) {
            return null;
        }

        String normalized = normalizeLineEndings(value).trim().replace('\n', ' ').replace('\t', ' ');
        validatePlainText(normalized, "title");
        return normalized;
    }

    private String normalizeBody(String value) {
        if (value == null) {
            return null;
        }

        String normalized = normalizeLineEndings(value).trim();
        validatePlainText(normalized, "body");
        return normalized.isEmpty() ? null : normalized;
    }

    private String normalizeLineEndings(String value) {
        return value.replace("\r\n", "\n").replace('\r', '\n');
    }

    private void validatePlainText(String value, String fieldName) {
        for (int index = 0; index < value.length(); index++) {
            char character = value.charAt(index);
            if (Character.isISOControl(character) && character != '\n' && character != '\t') {
                throw new IllegalArgumentException(fieldName + " contains unsupported control characters");
            }
        }
    }

}
