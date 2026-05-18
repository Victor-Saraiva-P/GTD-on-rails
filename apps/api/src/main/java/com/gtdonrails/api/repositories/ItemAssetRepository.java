package com.gtdonrails.api.repositories;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import com.gtdonrails.api.entities.ItemAsset;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ItemAssetRepository extends JpaRepository<ItemAsset, UUID> {

    List<ItemAsset> findAllByItemId(UUID itemId);

    List<ItemAsset> findAllByItemIdAndDeletedAtIsNull(UUID itemId);

    Optional<ItemAsset> findByIdAndItemId(UUID id, UUID itemId);
}
