package com.gtdonrails.api.entities;

import java.util.HashSet;
import java.util.Set;
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
import jakarta.persistence.JoinColumn;
import jakarta.persistence.JoinTable;
import jakarta.persistence.ManyToMany;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

@Entity
@Table(name = "items")
@Getter
public class Item extends AuditableEntity {

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

    @ManyToMany
    @JoinTable(
        name = "item_contexts",
        joinColumns = @JoinColumn(name = "item_id"),
        inverseJoinColumns = @JoinColumn(name = "context_id")
    )
    private Set<Context> contexts = new HashSet<>();

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

    public void addContext(Context context) {
        if (context == null) {
            throw new IllegalArgumentException("context is required");
        }

        contexts.add(context);
        context.getItems().add(this);
    }

    public void removeContext(Context context) {
        if (context == null) {
            return;
        }

        contexts.remove(context);
        context.getItems().remove(this);
    }

    @PrePersist
    void prePersist() {
        initializeAuditTimestamps();
        status = inferStatus();
    }

    @PreUpdate
    void preUpdate() {
        status = inferStatus();
        touchUpdatedAt();
    }

    private ItemStatus inferStatus() {
        return ItemStatus.STUFF;
    }
}
