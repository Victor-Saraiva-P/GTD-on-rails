package com.gtdonrails.api.repositories;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import com.gtdonrails.api.entities.Project;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ProjectRepository extends JpaRepository<Project, UUID> {
    List<Project> findAllByItem_DeletedAtIsNullOrderByItem_CreatedAtAsc();

    Optional<Project> findByItemIdAndItem_DeletedAtIsNull(UUID itemId);
}
