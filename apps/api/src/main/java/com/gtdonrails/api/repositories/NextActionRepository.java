package com.gtdonrails.api.repositories;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

import com.gtdonrails.api.entities.NextAction;
import com.gtdonrails.api.enums.NextActionStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface NextActionRepository extends JpaRepository<NextAction, UUID> {

    List<NextAction> findAllByContexts_IdAndItem_DeletedAtIsNullOrderByItem_UpdatedAtDesc(UUID contextId);

    Page<NextAction> findAllByContexts_IdAndItem_DeletedAtIsNullOrderByItem_UpdatedAtDesc(UUID contextId, Pageable pageable);

    @Query("""
        select distinct nextAction
        from NextAction nextAction left join nextAction.contexts context
        where nextAction.status = :status
        and nextAction.item.deletedAt is null
        and (context.id = :contextId or nextAction.contexts is empty)
        order by nextAction.energy desc
        """)
    List<NextAction> findRunnableInContextOrderByEnergyDesc(
        @Param("status") NextActionStatus status,
        @Param("contextId") UUID contextId);

    @Query("""
        select distinct nextAction
        from NextAction nextAction left join nextAction.contexts context
        where nextAction.status = :status
        and nextAction.item.deletedAt is null
        and (context.id = :contextId or nextAction.contexts is empty)
        order by nextAction.estimatedTime desc
        """)
    List<NextAction> findRunnableInContextOrderByEstimatedTimeDesc(
        @Param("status") NextActionStatus status,
        @Param("contextId") UUID contextId);

    List<NextAction> findAllByStatusAndItem_DeletedAtIsNullOrderByEnergyDesc(NextActionStatus status);

    List<NextAction> findAllByStatusAndItem_DeletedAtIsNullOrderByEstimatedTimeDesc(NextActionStatus status);

    List<NextAction> findAllByItem_DeletedAtIsNotNullOrderByItem_UpdatedAtDesc();

    Page<NextAction> findAllByStatusAndItem_DeletedAtIsNullOrderByItem_UpdatedAtDesc(NextActionStatus status, Pageable pageable);

    List<NextAction> findAllByStatusAndItem_DeletedAtIsNullOrderByItem_UpdatedAtAsc(NextActionStatus status);

    @Query("""
        select nextAction
        from NextAction nextAction
        where nextAction.status = :status
        and nextAction.schedule.dateEnd <= :dateEnd
        """)
    List<NextAction> findAllDoneBeforeDate(
        @Param("status") NextActionStatus status,
        @Param("dateEnd") LocalDate dateEnd);

    @Modifying
    @Query(value = "delete from next_action_contexts where next_action_id = :id", nativeQuery = true)
    void deleteContextLinks(@Param("id") UUID id);

    @Modifying
    @Query(value = "delete from next_action_contexts where context_id = :contextId", nativeQuery = true)
    void deleteContextLinksForContext(@Param("contextId") UUID contextId);
}
