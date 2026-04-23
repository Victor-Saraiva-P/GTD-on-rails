package com.gtdonrails.api.entities;

import java.util.HashSet;
import java.util.Set;
import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.ManyToMany;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import lombok.Getter;

@Entity
@Table(name = "contexts")
@Getter
public class Context extends AuditableEntity {

    public static final int MAX_NAME_LENGTH = 100;
    public static final int MAX_CONTEXTS_PER_ITEM = 20;

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(nullable = false, updatable = false)
    private UUID id;

    @Column(nullable = false, length = MAX_NAME_LENGTH)
    private String name;

    @Column(name = "icon_asset_path")
    private String iconAssetPath;

    @ManyToMany(mappedBy = "contexts")
    private Set<Item> items = new HashSet<>();

    public Context() {
    }

    public Context(String name) {
        setName(name);
    }

    public void setName(String name) {
        if (name == null || name.isBlank()) {
            throw new IllegalArgumentException("context name is required");
        }
        if (name.length() > MAX_NAME_LENGTH) {
            throw new IllegalArgumentException("context name exceeds max length of " + MAX_NAME_LENGTH);
        }

        this.name = name;
    }

    public void setIconAssetPath(String iconAssetPath) {
        this.iconAssetPath = iconAssetPath;
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
