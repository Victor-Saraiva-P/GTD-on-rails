package com.gtdonrails.api.repositories;

import java.util.List;
import java.util.UUID;

import com.gtdonrails.api.dtos.project.ProjectActionCountProjection;
import com.gtdonrails.api.entities.ProjectItem;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ProjectItemRepository extends JpaRepository<ProjectItem, UUID> {

    @Query("""
        select projectItem
        from ProjectItem projectItem
        left join projectItem.item.nextAction nextAction
        left join projectItem.item.calendar calendar
        where projectItem.project.itemId = :projectId
        and projectItem.item.deletedAt is null
        and (
            projectItem.item.status = 'STUFF'
            or projectItem.item.status = 'SOMEDAY_MAYBE'
            or (projectItem.item.status = 'NEXT_ACTION' and nextAction.status in ('NEXT_ACTION', 'ONGOING'))
            or (projectItem.item.status = 'CALENDAR' and calendar.status in ('CALENDAR', 'ONGOING'))
        )
        """)
    List<ProjectItem> findProjectActionItems(@Param("projectId") UUID projectId);

    @Query("""
        select count(projectItem)
        from ProjectItem projectItem
        left join projectItem.item.nextAction nextAction
        left join projectItem.item.calendar calendar
        where projectItem.project.itemId = :projectId
        and projectItem.item.deletedAt is null
        and (
            (projectItem.item.status = 'NEXT_ACTION' and nextAction.status in ('NEXT_ACTION', 'ONGOING'))
            or (projectItem.item.status = 'CALENDAR' and calendar.status in ('CALENDAR', 'ONGOING'))
        )
        """)
    long countProjectActionItems(@Param("projectId") UUID projectId);

    @Query("""
        select projectItem.project.itemId as projectId, count(projectItem) as actionCount
        from ProjectItem projectItem
        left join projectItem.item.nextAction nextAction
        left join projectItem.item.calendar calendar
        where projectItem.item.deletedAt is null
        and (
            (projectItem.item.status = 'NEXT_ACTION' and nextAction.status in ('NEXT_ACTION', 'ONGOING'))
            or (projectItem.item.status = 'CALENDAR' and calendar.status in ('CALENDAR', 'ONGOING'))
        )
        group by projectItem.project.itemId
        """)
    List<ProjectActionCountProjection> countActiveActionsGroupedByProject();

    @Modifying
    @Query(value = "insert into project_items (project_id, item_id) values (:projectId, :itemId)", nativeQuery = true)
    void insertProjectItem(@Param("projectId") UUID projectId, @Param("itemId") UUID itemId);

    @Modifying
    @Query(value = "delete from project_items where item_id = :itemId", nativeQuery = true)
    void deleteByItemId(@Param("itemId") UUID itemId);
}
