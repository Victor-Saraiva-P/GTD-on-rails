package com.gtdonrails.api.entities;

import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import lombok.Getter;

@Entity
@Table(name = "item_assets")
@Getter
public class ItemAsset extends AuditableEntity {

    @Id
    @Column(nullable = false, updatable = false)
    private final UUID id = UUID.randomUUID();

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "item_id", nullable = false)
    private Item item;

    @Column(name = "file_name", nullable = false)
    private String fileName;

    @Column(name = "original_file_name", nullable = false)
    private String originalFileName;

    @Column(name = "content_type", nullable = false)
    private String contentType;

    @Column(nullable = false)
    private long size;

    public ItemAsset() {
    }

    public ItemAsset(Item item, String fileName, String originalFileName, String contentType, long size) {
        this.item = item;
        this.fileName = fileName;
        this.originalFileName = originalFileName;
        this.contentType = contentType;
        this.size = size;
    }

    /**
     * Builds the persisted file path from stable asset metadata.
     *
     * <p>Example: {@code asset.relativePath()} returns {@code items/item-id/asset-id/file.pdf}.</p>
     */
    public String relativePath() {
        return "items/" + item.getId() + "/" + id + "/" + fileName;
    }

    /**
     * Builds the public HTTP URL from the configured asset base path.
     *
     * <p>Example: {@code asset.publicUrl("/assets")} returns {@code /assets/items/...}.</p>
     */
    public String publicUrl(String publicBasePath) {
        String basePath = publicBasePath.endsWith("/")
            ? publicBasePath.substring(0, publicBasePath.length() - 1)
            : publicBasePath;
        return basePath + "/" + relativePath();
    }

    /**
     * Detects whether the stored content type represents an image asset.
     *
     * <p>Example: {@code asset.isImage()} returns {@code true} for {@code image/png}.</p>
     */
    public boolean isImage() {
        return contentType.startsWith("image/");
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
