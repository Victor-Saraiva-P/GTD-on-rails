package com.gtdonrails.api.entities;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.Comparator;
import java.util.List;
import java.util.UUID;

import com.gtdonrails.api.enums.RecurringCalendarIntervalUnit;
import jakarta.persistence.Column;
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
@Table(name = "recurring_calendar_templates")
@Getter
public class RecurringCalendarTemplate extends AuditableEntity {

    @Id
    @Column(name = "item_id", nullable = false, updatable = false)
    private UUID itemId;

    @OneToOne(optional = false)
    @MapsId
    @JoinColumn(name = "item_id", nullable = false)
    private Item item;

    @Column(name = "start_date", nullable = false)
    private LocalDate startDate;

    @Column(name = "scheduled_time")
    private LocalTime scheduledTime;

    @Column(name = "interval_value", nullable = false)
    private int intervalValue;

    @Enumerated(EnumType.STRING)
    @Column(name = "recurrence_unit", nullable = false, length = 20)
    private RecurringCalendarIntervalUnit recurrenceUnit;

    @Column(name = "weekly_weekdays", nullable = false)
    private String weeklyWeekdays = "";

    @Column(name = "end_date")
    private LocalDate endDate;

    public RecurringCalendarTemplate() {
    }

    public RecurringCalendarTemplate(
        Item item,
        LocalDate startDate,
        LocalTime scheduledTime,
        int intervalValue,
        RecurringCalendarIntervalUnit recurrenceUnit,
        List<DayOfWeek> weeklyWeekdays,
        LocalDate endDate
    ) {
        setItem(item);
        updateRecurrence(startDate, scheduledTime, intervalValue, recurrenceUnit, weeklyWeekdays, endDate);
    }

    /**
     * Connects this template to the item that owns its title and body.
     *
     * <p>Example: {@code template.setItem(item)}.</p>
     */
    public void setItem(Item item) {
        if (item == null) {
            throw new IllegalArgumentException("item value 'null' is invalid; expected Item");
        }
        this.item = item;
        if (item.getRecurringCalendarTemplate() != this) item.setRecurringCalendarTemplate(this);
    }

    /**
     * Replaces the recurrence rule owned by this template.
     *
     * <p>Example: {@code template.updateRecurrence(date, null, 1, DAY, List.of(), null)}.</p>
     */
    public void updateRecurrence(
        LocalDate startDate,
        LocalTime scheduledTime,
        int intervalValue,
        RecurringCalendarIntervalUnit recurrenceUnit,
        List<DayOfWeek> weeklyWeekdays,
        LocalDate endDate
    ) {
        setStartDate(startDate);
        setIntervalValue(intervalValue);
        setRecurrenceUnit(recurrenceUnit);
        setWeeklyWeekdays(weeklyWeekdays);
        this.scheduledTime = scheduledTime;
        this.endDate = endDate;
    }

    /**
     * Returns the selected weekly recurrence days.
     *
     * <p>Example: {@code template.weeklyWeekdays()}.</p>
     */
    public List<DayOfWeek> weeklyWeekdays() {
        if (weeklyWeekdays.isBlank()) return List.of();
        return List.of(weeklyWeekdays.split(",")).stream().map(DayOfWeek::valueOf).toList();
    }

    @PrePersist
    void prePersist() {
        initializeAuditTimestamps();
    }

    @PreUpdate
    void preUpdate() {
        touchUpdatedAt();
    }

    private void setStartDate(LocalDate startDate) {
        if (startDate == null) {
            throw new IllegalArgumentException("startDate value 'null' is invalid; expected LocalDate");
        }
        this.startDate = startDate;
    }

    private void setIntervalValue(int intervalValue) {
        if (intervalValue < 1) {
            throw new IllegalArgumentException("intervalValue value '" + intervalValue + "' is invalid; expected positive integer");
        }
        this.intervalValue = intervalValue;
    }

    private void setRecurrenceUnit(RecurringCalendarIntervalUnit recurrenceUnit) {
        if (recurrenceUnit == null) {
            throw new IllegalArgumentException("recurrenceUnit value 'null' is invalid; expected recurrence unit");
        }
        this.recurrenceUnit = recurrenceUnit;
    }

    private void setWeeklyWeekdays(List<DayOfWeek> weeklyWeekdays) {
        List<DayOfWeek> normalized = weeklyWeekdays == null ? List.of() : weeklyWeekdays;
        this.weeklyWeekdays = normalized.stream()
            .distinct()
            .sorted(Comparator.naturalOrder())
            .map(DayOfWeek::name)
            .reduce((left, right) -> left + "," + right)
            .orElse("");
    }
}
