package com.gtdonrails.api.repositories;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import com.gtdonrails.api.entities.Context;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ContextRepository extends JpaRepository<Context, UUID> {

    List<Context> findAllByDeletedAtIsNullOrderByNameAsc();

    Optional<Context> findByIdAndDeletedAtIsNull(UUID id);

    List<Context> findAllByIdInAndDeletedAtIsNull(Collection<UUID> ids);

    boolean existsByName(String name);

    boolean existsByNameAndIdNot(String name, UUID id);
}
