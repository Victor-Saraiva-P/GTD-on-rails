package com.gtdonrails.api.types;

import java.time.Clock;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import lombok.Getter;

@Embeddable
@Getter
public class ScheduleWindow {

    @Column(name = "date_start")
    private LocalDate dateStart;

    @Column(name = "date_end")
    private LocalDate dateEnd;

    @Column(name = "time_start")
    private LocalTime timeStart;

    @Column(name = "time_end")
    private LocalTime timeEnd;

    @Column(name = "all_day", nullable = false)
    private boolean allDay;

    public ScheduleWindow() {
    }

    /**
     * Creates an empty schedule window.
     *
     * <p>Example: {@code ScheduleWindow.unscheduled()}.</p>
     */
    public static ScheduleWindow unscheduled() {
        return new ScheduleWindow();
    }

    /**
     * Opens a new timed schedule window at the current clock date and time.
     *
     * <p>Example: {@code schedule.registerStart(clock)}.</p>
     */
    public void registerStart(Clock clock) {
        requireClock(clock);
        dateStart = LocalDate.now(clock);
        timeStart = LocalTime.now(clock);
        dateEnd = null;
        timeEnd = null;
        allDay = false;
    }

    /**
     * Closes a timed window at the current clock time.
     *
     * <p>If no timed start exists, closing means the scheduled work is treated as an all-day window for the current clock date.</p>
     * <p>Example: {@code schedule.registerEnd(clock)}.</p>
     */
    public void registerEnd(Clock clock) {
        requireClock(clock);
        if (!hasTimedStart()) {
            registerAllDay(clock);
            return;
        }

        LocalDate nextDateEnd = LocalDate.now(clock);
        LocalTime nextTimeEnd = LocalTime.now(clock);
        requireEndNotBeforeStart(nextDateEnd, nextTimeEnd);
        dateEnd = nextDateEnd;
        timeEnd = nextTimeEnd;
        allDay = false;
    }

    private void registerAllDay(Clock clock) {
        dateStart = LocalDate.now(clock);
        dateEnd = dateStart;
        timeStart = null;
        timeEnd = null;
        allDay = true;
    }

    private boolean hasTimedStart() {
        return dateStart != null && timeStart != null;
    }

    /**
     * Clears all schedule date and time data.
     *
     * <p>Example: {@code schedule.clear()}.</p>
     */
    public void clear() {
        dateStart = null;
        dateEnd = null;
        timeStart = null;
        timeEnd = null;
        allDay = false;
    }

    private void requireEndNotBeforeStart(LocalDate nextDateEnd, LocalTime nextTimeEnd) {
        LocalDateTime start = LocalDateTime.of(dateStart, timeStart);
        LocalDateTime end = LocalDateTime.of(nextDateEnd, nextTimeEnd);
        if (end.isBefore(start)) throw endBeforeStartException(end, start);
    }

    private static IllegalArgumentException endBeforeStartException(LocalDateTime end, LocalDateTime start) {
        return new IllegalArgumentException("schedule end value '" + end + "' is invalid; expected same or after schedule start '" + start + "'");
    }

    private static void requireClock(Clock clock) {
        if (clock == null) throw new IllegalArgumentException("clock value 'null' is invalid; expected Clock");
    }
}
