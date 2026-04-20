package com.gtdonrails.api.entities;

import java.time.Instant;
import java.util.UUID;

import com.gtdonrails.api.enums.ItemStatus;
import com.gtdonrails.api.persistence.converters.BodyConverter;
import com.gtdonrails.api.persistence.converters.TitleConverter;
import com.gtdonrails.api.types.Body;
import com.gtdonrails.api.types.Title;
import jakarta.persistence.Column;
import jakarta.persistence.Convert;
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
import lombok.Setter;

@Entity
@Table(name = "items")
@Getter
public class Item {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(nullable = false, updatable = false)
    private UUID id;

    @Convert(converter = TitleConverter.class)
    @Column(nullable = false, length = Title.MAX_LENGTH)
    private Title title;

    @Setter
    @Convert(converter = BodyConverter.class)
    @Column(length = Body.MAX_LENGTH)
    private Body body;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 50)
    private ItemStatus status;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @Column(name = "deleted_at")
    private Instant deletedAt;

    public Item() {
    }

    public Item(Title title, Body body) {
        setTitle(title);
        setBody(body);
    }

    public void setTitle(Title title) {
        if (title == null) {
            throw new IllegalArgumentException("title is required");
        }

        this.title = title;
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
        if (createdAt == null) {
            createdAt = Instant.now();
        }
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
