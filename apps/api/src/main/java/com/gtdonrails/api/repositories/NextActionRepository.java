package com.gtdonrails.api.repositories;

import java.util.List;
import java.util.UUID;

import com.gtdonrails.api.entities.NextAction;
import com.gtdonrails.api.enums.NextActionStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

public interface NextActionRepository extends JpaRepository<NextAction, UUID> {

    List<NextAction> findAllByContexts_IdAndItem_DeletedAtIsNullOrderByItem_UpdatedAtDesc(UUID contextId);

    Page<NextAction> findAllByContexts_IdAndItem_DeletedAtIsNullOrderByItem_UpdatedAtDesc(UUID contextId, Pageable pageable);

    List<NextAction> findAllByStatusAndContexts_IdAndItem_DeletedAtIsNullOrderByEnergyDesc(NextActionStatus status, UUID contextId);

    List<NextAction> findAllByStatusAndContexts_IdAndItem_DeletedAtIsNullOrderByEstimatedTimeDesc(NextActionStatus status, UUID contextId);

    List<NextAction> findAllByStatusAndItem_DeletedAtIsNullOrderByEnergyDesc(NextActionStatus status);

    List<NextAction> findAllByStatusAndItem_DeletedAtIsNullOrderByEstimatedTimeDesc(NextActionStatus status);

    List<NextAction> findAllByItem_DeletedAtIsNotNullOrderByItem_UpdatedAtDesc();

    Page<NextAction> findAllByStatusAndItem_DeletedAtIsNullOrderByItem_UpdatedAtDesc(NextActionStatus status, Pageable pageable);
}
