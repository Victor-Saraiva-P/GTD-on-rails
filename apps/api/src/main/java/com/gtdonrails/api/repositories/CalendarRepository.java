package com.gtdonrails.api.repositories;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import com.gtdonrails.api.entities.Calendar;
import com.gtdonrails.api.enums.CalendarStatus;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CalendarRepository extends JpaRepository<Calendar, UUID> {

    Optional<Calendar> findByItemIdAndItem_DeletedAtIsNull(UUID itemId);

    List<Calendar> findAllByStatusAndScheduledDateLessThanEqualAndItem_DeletedAtIsNullOrderByScheduledDateAscScheduledTimeAsc(
        CalendarStatus status,
        LocalDate scheduledDate);

    List<Calendar> findAllByStatusAndSchedule_DateEndAndItem_DeletedAtIsNullOrderByItem_UpdatedAtDesc(
        CalendarStatus status,
        LocalDate dateEnd);

    List<Calendar> findAllByScheduledDateBetweenAndItem_DeletedAtIsNullOrderByScheduledDateAscScheduledTimeAsc(
        LocalDate start,
        LocalDate end);

    List<Calendar> findAllByStatusAndItem_DeletedAtIsNullOrderByItem_UpdatedAtDesc(CalendarStatus status);

    List<Calendar> findAllByStatusAndItem_DeletedAtIsNullOrderByItem_UpdatedAtAsc(CalendarStatus status);

    List<Calendar> findAllByItem_DeletedAtIsNotNullOrderByItem_UpdatedAtDesc();
}
