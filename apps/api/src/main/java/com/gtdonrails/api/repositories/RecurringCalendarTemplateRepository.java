package com.gtdonrails.api.repositories;

import java.util.List;
import java.util.UUID;

import com.gtdonrails.api.entities.RecurringCalendarTemplate;
import org.springframework.data.jpa.repository.JpaRepository;

public interface RecurringCalendarTemplateRepository extends JpaRepository<RecurringCalendarTemplate, UUID> {

    List<RecurringCalendarTemplate> findAllByItem_DeletedAtIsNullOrderByItem_UpdatedAtDesc();
}
