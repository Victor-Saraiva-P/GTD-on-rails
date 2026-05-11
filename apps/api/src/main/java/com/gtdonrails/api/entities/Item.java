package com.gtdonrails.api.entities;

import java.util.UUID;

import com.gtdonrails.api.enums.ItemStatus;
import com.gtdonrails.api.normalizers.ItemBodyNormalizer;
import com.gtdonrails.api.persistence.converters.ItemBodyConverter;
import com.gtdonrails.api.persistence.converters.TitleConverter;
import com.gtdonrails.api.types.ItemBody;
import com.gtdonrails.api.types.Title;
import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Convert;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.OneToOne;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import lombok.Getter;

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

    @Column(nullable = false, columnDefinition = "text")
    @Convert(converter = ItemBodyConverter.class)
    private ItemBody body = ItemBody.empty();

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 50)
    private ItemStatus status;

    @OneToOne(mappedBy = "item", cascade = CascadeType.ALL, orphanRemoval = true)
    private NextAction nextAction;

    public Item() {
    }

    public Item(Title title, String body) {
        setTitle(title);
        setBody(new ItemBody(body, null, null, null));
    }

    /**
     * Replaces the required item title after enforcing the title value object.
     *
     * <p>Example: {@code item.setTitle(new Title("Capture idea"))}.</p>
     */
    public void setTitle(Title title) {
        if (title == null) {
            throw new IllegalArgumentException("item title value 'null' is invalid; expected Title");
        }

        this.title = title;
    }

    /**
     * Stores optional item body metadata as a non-null value object.
     *
     * <p>Example: {@code item.setBody(ItemBody.empty())}.</p>
     */
    public void setBody(ItemBody body) {
        this.body = ItemBodyNormalizer.normalizeBodyValue(body);
    }

    /**
     * Associates this item with its optional GTD next-action metadata.
     *
     * <p>Example: {@code item.setNextAction(nextAction)}.</p>
     */
    public void setNextAction(NextAction nextAction) {
        this.nextAction = nextAction;
        if (nextAction != null && nextAction.getItem() != this) {
            nextAction.setItem(this);
        }
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
        return nextAction == null ? ItemStatus.STUFF : ItemStatus.NEXT_ACTION;
    }
}
