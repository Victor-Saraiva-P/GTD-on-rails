package com.gtdonrails.api.entities;

import java.time.Clock;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.UUID;

import com.gtdonrails.api.enums.CalendarStatus;
import com.gtdonrails.api.types.ScheduleWindow;
import jakarta.persistence.Column;
import jakarta.persistence.Embedded;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.MapsId;
import jakarta.persistence.OneToOne;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

@Entity
@Table(name = "calendars")
@Getter
public class Calendar extends AuditableEntity {

    @Id
    @Column(name = "item_id", nullable = false, updatable = false)
    private UUID itemId;

    @OneToOne(optional = false)
    @MapsId
    @JoinColumn(name = "item_id", nullable = false)
    private Item item;

    @Column(name = "scheduled_date", nullable = false)
    private LocalDate scheduledDate;

    /**
     * Stores the optional local scheduled time.
     *
     * <p>Example: {@code calendar.setScheduledTime(LocalTime.parse("09:30"))}.</p>
     */
    @Setter
    @Column(name = "scheduled_time")
    private LocalTime scheduledTime;

    @Embedded
    private final ScheduleWindow schedule = ScheduleWindow.unscheduled();

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 50)
    private CalendarStatus status = CalendarStatus.CALENDAR;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "recurring_template_item_id")
    private RecurringCalendarTemplate recurringCalendarTemplate;

    @Column(name = "original_scheduled_date")
    private LocalDate originalScheduledDate;

    @Column(name = "original_scheduled_time")
    private LocalTime originalScheduledTime;

    @Column(name = "personalized_occurrence", nullable = false)
    private boolean personalizedOccurrence = false;

    public Calendar() {
    }

    public Calendar(Item item, LocalDate scheduledDate, LocalTime scheduledTime) {
        setItem(item);
        setScheduledDate(scheduledDate);
        setScheduledTime(scheduledTime);
        status = CalendarStatus.CALENDAR;
    }

    /**
     * Connects this calendar to the item it clarifies.
     *
     * <p>Example: {@code calendar.setItem(item)}.</p>
     */
    public void setItem(Item item) {
        if (item == null) {
            throw new IllegalArgumentException("item value 'null' is invalid; expected Item");
        }

        this.item = item;
        if (item.getCalendar() != this) {
            item.setCalendar(this);
        }
    }

    /**
     * Stores the required local scheduled date.
     *
     * <p>Example: {@code calendar.setScheduledDate(LocalDate.parse("2026-05-21"))}.</p>
     */
    public void setScheduledDate(LocalDate scheduledDate) {
        if (scheduledDate == null) {
            throw new IllegalArgumentException("scheduledDate value 'null' is invalid; expected LocalDate");
        }

        this.scheduledDate = scheduledDate;
    }


    /**
     * Marks this calendar as ongoing, resetting the schedule start.
     *
     * <p>Example: {@code calendar.markOnGoing(clock)}.</p>
     */
    public void markOnGoing(Clock clock) {
        schedule.registerStart(clock);
        status = CalendarStatus.ONGOING;
    }

    /**
     * Marks this calendar as done, registering the schedule end.
     *
     * <p>Example: {@code calendar.markDone(clock)}.</p>
     */
    public void markDone(Clock clock) {
        schedule.registerEnd(clock);
        status = CalendarStatus.DONE;
    }

    /**
     * Restores this item to the initial calendar state, clearing its schedule.
     *
     * <p>Example: {@code calendar.resetStatus()}.</p>
     */
    public void resetStatus() {
        schedule.clear();
        status = CalendarStatus.CALENDAR;
    }

    /**
     * Records this calendar as a template-owned occurrence.
     *
     * <p>Example: {@code calendar.markRecurringOccurrence(template, date, time)}.</p>
     */
    public void markRecurringOccurrence(RecurringCalendarTemplate template, LocalDate originalDate, LocalTime originalTime) {
        if (template == null) {
            throw new IllegalArgumentException("template value 'null' is invalid; expected RecurringCalendarTemplate");
        }
        recurringCalendarTemplate = template;
        originalScheduledDate = originalDate;
        originalScheduledTime = originalTime;
        personalizedOccurrence = false;
    }

    /**
     * Reports whether this calendar is the intended template occurrence.
     *
     * <p>Example: {@code calendar.matchesRecurringOccurrence(template, date, time)}.</p>
     */
    public boolean matchesRecurringOccurrence(RecurringCalendarTemplate template, LocalDate date, LocalTime time) {
        if (recurringCalendarTemplate == null || !recurringCalendarTemplate.equals(template)) return false;
        return originalScheduledDate.equals(date) && java.util.Objects.equals(originalScheduledTime, time);
    }

    /**
     * Marks direct user edits as personalized while preserving occurrence identity.
     *
     * <p>Example: {@code calendar.markPersonalizedOccurrence()}.</p>
     */
    public void markPersonalizedOccurrence() {
        if (recurringCalendarTemplate == null) return;
        personalizedOccurrence = true;
    }

    /**
     * Reports whether this calendar is an unpersonalized default occurrence scheduled for today or later.
     *
     * <p>Example: {@code calendar.isFutureDefaultOccurrence(LocalDate.now())}.</p>
     */
    public boolean isFutureDefaultOccurrence(LocalDate today) {
        if (personalizedOccurrence) return false;
        if (status != CalendarStatus.CALENDAR) return false;
        return originalScheduledDate != null && !originalScheduledDate.isBefore(today);
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
