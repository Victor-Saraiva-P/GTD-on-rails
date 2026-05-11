package com.gtdonrails.api.repositories;

import java.util.List;
import java.util.UUID;

import com.gtdonrails.api.entities.NextAction;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

public interface NextActionRepository extends JpaRepository<NextAction, UUID> {

    List<NextAction> findAllByContexts_IdAndItem_DeletedAtIsNullOrderByItem_UpdatedAtDesc(UUID contextId);

    Page<NextAction> findAllByContexts_IdAndItem_DeletedAtIsNullOrderByItem_UpdatedAtDesc(UUID contextId, Pageable pageable);
}
