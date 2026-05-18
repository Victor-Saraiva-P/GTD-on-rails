package com.gtdonrails.api.entities;

import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.OneToOne;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import lombok.Getter;

@Entity
@Table(name = "context_icon_assets")
@Getter
public class ContextIconAsset extends AuditableEntity {

    @Id
    @Column(nullable = false, updatable = false)
    private final UUID id = UUID.randomUUID();

    @OneToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "context_id", nullable = false)
    private Context context;

    @Column(name = "file_name", nullable = false)
    private String fileName;

    @Column(name = "original_file_name", nullable = false)
    private String originalFileName;

    @Column(name = "content_type", nullable = false)
    private String contentType;

    @Column(nullable = false)
    private long size;

    public ContextIconAsset() {
    }

    public ContextIconAsset(Context context, String fileName, String originalFileName, String contentType, long size) {
        this.context = context;
        this.fileName = fileName;
        this.originalFileName = originalFileName;
        this.contentType = contentType;
        this.size = size;
    }

    /**
     * Builds the persisted icon path from stable asset metadata.
     *
     * <p>Example: {@code asset.relativePath()} returns {@code contexts/context-id/asset-id/icon.png}.</p>
     */
    public String relativePath() {
        return "contexts/" + context.getId() + "/" + id + "/" + fileName;
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
