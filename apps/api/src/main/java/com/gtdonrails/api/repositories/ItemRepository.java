package com.gtdonrails.api.repositories;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import com.gtdonrails.api.entities.Item;
import com.gtdonrails.api.enums.ItemStatus;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ItemRepository extends JpaRepository<Item, UUID> {

    List<Item> findAllByStatusAndDeletedAtIsNullOrderByCreatedAtAsc(ItemStatus status);

    List<Item> findAllByStatusAndDeletedAtIsNotNullOrderByUpdatedAtDesc(ItemStatus status);

    List<Item> findAllByDeletedAtLessThanEqual(Instant deletedAt);

    Optional<Item> findByIdAndDeletedAtIsNull(UUID id);

    Optional<Item> findByIdAndStatusAndDeletedAtIsNull(UUID id, ItemStatus status);
}
