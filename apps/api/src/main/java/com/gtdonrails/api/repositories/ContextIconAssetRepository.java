package com.gtdonrails.api.repositories;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import com.gtdonrails.api.entities.ContextIconAsset;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ContextIconAssetRepository extends JpaRepository<ContextIconAsset, UUID> {

    Optional<ContextIconAsset> findByContextIdAndDeletedAtIsNull(UUID contextId);

    List<ContextIconAsset> findAllByContextId(UUID contextId);

    List<ContextIconAsset> findAllByDeletedAtLessThanEqual(Instant deletedAt);
}
