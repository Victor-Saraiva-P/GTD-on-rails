package com.gtdonrails.api.repositories;

import java.util.Optional;
import java.util.UUID;

import com.gtdonrails.api.entities.ContextIconAsset;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ContextIconAssetRepository extends JpaRepository<ContextIconAsset, UUID> {

    Optional<ContextIconAsset> findByContextIdAndDeletedAtIsNull(UUID contextId);
}
