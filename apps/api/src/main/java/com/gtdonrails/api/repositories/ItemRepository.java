package com.gtdonrails.api.repositories;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import com.gtdonrails.api.entities.Item;
import com.gtdonrails.api.enums.ItemStatus;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ItemRepository extends JpaRepository<Item, UUID> {

    List<Item> findAllByStatusAndDeletedAtIsNullOrderByCreatedAtDesc(ItemStatus status);

    Optional<Item> findByIdAndStatusAndDeletedAtIsNull(UUID id, ItemStatus status);
}
