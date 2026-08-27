package com.gtdonrails.api.repositories;

import java.util.List;

import com.gtdonrails.api.entities.SyncOutboxEvent;
import com.gtdonrails.api.entities.SyncOutboxStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface SyncOutboxRepository extends JpaRepository<SyncOutboxEvent, Long> {

    List<SyncOutboxEvent> findByStatusOrderByCreatedAtAsc(SyncOutboxStatus status);

    int countByStatus(SyncOutboxStatus status);

    @Modifying
    @Query("delete from SyncOutboxEvent e where e.status = :status")
    int deleteByStatus(@Param("status") SyncOutboxStatus status);
}
