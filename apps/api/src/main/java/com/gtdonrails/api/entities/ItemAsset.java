package com.gtdonrails.api.entities;

import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
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
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(nullable = false, updatable = false)
    private UUID id;

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

    @Column(name = "relative_path", nullable = false, unique = true)
    private String relativePath;

    @Column(nullable = false)
    private String url;

    @Column(nullable = false)
    private boolean image;

    public ItemAsset() {
    }

    public ItemAsset(Item item, String fileName, String originalFileName, String contentType, long size, String relativePath, String url, boolean image) {
        this.item = item;
        this.fileName = fileName;
        this.originalFileName = originalFileName;
        this.contentType = contentType;
        this.size = size;
        this.relativePath = relativePath;
        this.url = url;
        this.image = image;
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
