package com.gtdonrails.api.entities;

import java.math.BigDecimal;
import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.HashSet;
import java.time.DayOfWeek;
import java.util.Set;
import java.util.UUID;

import com.gtdonrails.api.enums.ItemStatus;
import com.gtdonrails.api.enums.RecurringCalendarIntervalUnit;
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
import jakarta.persistence.OneToMany;
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
    private ItemStatus status = ItemStatus.STUFF;

    @OneToOne(mappedBy = "item", cascade = CascadeType.ALL, orphanRemoval = true)
    private NextAction nextAction;

    @OneToOne(mappedBy = "item", cascade = CascadeType.ALL, orphanRemoval = true)
    private Calendar calendar;

    @OneToOne(mappedBy = "item", cascade = CascadeType.ALL, orphanRemoval = true)
    private RecurringCalendarTemplate recurringCalendarTemplate;

    @OneToMany(mappedBy = "item", cascade = CascadeType.REMOVE, orphanRemoval = true)
    private final Set<ItemAsset> assets = new HashSet<>();

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

    void setNextAction(NextAction nextAction) {
        this.nextAction = nextAction;
        if (nextAction != null && nextAction.getItem() != this) {
            nextAction.setItem(this);
        }
    }

    void setCalendar(Calendar calendar) {
        this.calendar = calendar;
        if (calendar != null && calendar.getItem() != this) {
            calendar.setItem(this);
        }
    }

    void setRecurringCalendarTemplate(RecurringCalendarTemplate recurringCalendarTemplate) {
        this.recurringCalendarTemplate = recurringCalendarTemplate;
        if (recurringCalendarTemplate != null && recurringCalendarTemplate.getItem() != this) {
            recurringCalendarTemplate.setItem(this);
        }
    }

    /**
     * Explicitly classifies this item as inbox stuff.
     *
     * <p>Example: {@code item.markAsStuff()}.</p>
     */
    public void markAsStuff() {
        if (nextAction != null || calendar != null || recurringCalendarTemplate != null) {
            throw new IllegalStateException("item subtype value is invalid; expected no subtype when marking as STUFF");
        }

        status = ItemStatus.STUFF;
    }

    /**
     * Converts this inbox stuff item into a GTD next action.
     *
     * <p>Example: {@code item.convertToNextAction(energy, time, Set.of(context))}.</p>
     */
    public NextAction convertToNextAction(BigDecimal energy, Duration estimatedTime, Set<Context> contexts) {
        requireStuffBeforeNextActionConversion();
        NextAction createdNextAction = new NextAction(this, energy, estimatedTime, contexts);
        status = ItemStatus.NEXT_ACTION;
        return createdNextAction;
    }

    /**
     * Converts this active inbox stuff item into a dated GTD calendar item.
     *
     * <p>Example: {@code item.convertToCalendar(date, LocalTime.NOON)}.</p>
     */
    public Calendar convertToCalendar(LocalDate scheduledDate, LocalTime scheduledTime) {
        requireActiveStuffBeforeCalendarConversion();
        Calendar createdCalendar = new Calendar(this, scheduledDate, scheduledTime);
        status = ItemStatus.CALENDAR;
        return createdCalendar;
    }

    /**
     * Converts this inbox stuff item into a Recurring Calendar Template.
     *
     * <p>Example: {@code item.convertToRecurringCalendarTemplate(date, null, 1, DAY, Set.of(), null)}.</p>
     */
    public RecurringCalendarTemplate convertToRecurringCalendarTemplate(
        LocalDate startDate,
        LocalTime scheduledTime,
        int intervalValue,
        RecurringCalendarIntervalUnit recurrenceUnit,
        java.util.List<DayOfWeek> weeklyWeekdays,
        LocalDate endDate
    ) {
        requireActiveStuffBeforeRecurringCalendarTemplateConversion();
        RecurringCalendarTemplate template = new RecurringCalendarTemplate(
            this, startDate, scheduledTime, intervalValue, recurrenceUnit, weeklyWeekdays, endDate);
        status = ItemStatus.RECURRING_CALENDAR_TEMPLATE;
        return template;
    }

    @PrePersist
    void prePersist() {
        initializeAuditTimestamps();
    }

    @PreUpdate
    void preUpdate() {
        touchUpdatedAt();
    }

    private void requireStuffBeforeNextActionConversion() {
        if (status != ItemStatus.STUFF || nextAction != null) {
            throw new IllegalStateException(
                "item status value '" + status + "' is invalid; expected STUFF without next action");
        }
    }

    private void requireActiveStuffBeforeCalendarConversion() {
        if (status != ItemStatus.STUFF || nextAction != null || calendar != null || isDeleted()) {
            throw new IllegalStateException(
                "item value '" + status + "' is invalid; expected active STUFF without subtype");
        }
    }

    private void requireActiveStuffBeforeRecurringCalendarTemplateConversion() {
        if (status != ItemStatus.STUFF || nextAction != null || calendar != null || recurringCalendarTemplate != null || isDeleted()) {
            throw new IllegalStateException(
                "item value '" + status + "' is invalid; expected active STUFF without subtype");
        }
    }
}
