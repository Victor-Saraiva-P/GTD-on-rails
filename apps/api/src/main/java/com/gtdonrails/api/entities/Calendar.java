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
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.MapsId;
import jakarta.persistence.OneToOne;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import lombok.Getter;

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

    @Column(name = "scheduled_time")
    private LocalTime scheduledTime;

    @Embedded
    private final ScheduleWindow schedule = ScheduleWindow.unscheduled();

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 50)
    private CalendarStatus status = CalendarStatus.CALENDAR;

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
     * Stores the optional local scheduled time.
     *
     * <p>Example: {@code calendar.setScheduledTime(LocalTime.parse("09:30"))}.</p>
     */
    public void setScheduledTime(LocalTime scheduledTime) {
        this.scheduledTime = scheduledTime;
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
     * <p>Example: {@code calendar.restore()}.</p>
     */
    public void restore() {
        schedule.clear();
        status = CalendarStatus.CALENDAR;
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
