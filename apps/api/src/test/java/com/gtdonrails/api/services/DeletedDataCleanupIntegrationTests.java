package com.gtdonrails.api.services;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.math.BigDecimal;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.Set;
import java.util.UUID;
import com.gtdonrails.api.entities.Item;
import com.gtdonrails.api.entities.NextAction;
import com.gtdonrails.api.entities.Project;
import com.gtdonrails.api.entities.ProjectItem;
import com.gtdonrails.api.enums.ItemStatus;
import com.gtdonrails.api.enums.NextActionStatus;
import com.gtdonrails.api.repositories.ItemRepository;
import com.gtdonrails.api.repositories.NextActionRepository;
import com.gtdonrails.api.repositories.ProjectItemRepository;
import com.gtdonrails.api.repositories.ProjectRepository;
import com.gtdonrails.api.types.ScheduleWindow;
import com.gtdonrails.api.types.Title;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.support.TransactionTemplate;

@SpringBootTest(properties = "gtd.cleanup.enabled=true")
@ActiveProfiles("test")
@Tag("integration")
class DeletedDataCleanupIntegrationTests {

    @Autowired private ItemRepository itemRepository;
    @Autowired private NextActionRepository nextActionRepository;
    @Autowired private ProjectRepository projectRepository;
    @Autowired private ProjectItemRepository projectItemRepository;
    @Autowired private com.gtdonrails.api.repositories.MaintenanceRunRepository maintenanceRunRepository;
    @Autowired private DeletedDataCleanupService cleanupService;
    @Autowired private CacheInvalidationService cacheInvalidationService;
    @Autowired private EntityManager entityManager;
    @Autowired private TransactionTemplate transactionTemplate;

    @BeforeEach
    void setUp() {
        cacheInvalidationService.evictAll();
        transactionTemplate.executeWithoutResult(status -> {
            maintenanceRunRepository.deleteAllInBatch();
            projectItemRepository.deleteAllInBatch();
            nextActionRepository.deleteAllContextLinks();
            nextActionRepository.deleteAllInBatch();
            projectRepository.deleteAllInBatch();
            itemRepository.deleteAllInBatch();
        });
    }

    @Test
    void purgesExpiredDoneNextActionAssociatedWithProjectWithoutIntegrityError() {
        UUID actionItemId = transactionTemplate.execute(status -> {
            Project project = createProject("Parent Project");
            return createDoneNextActionInProject("Finished Action", project, LocalDate.now(ZoneOffset.UTC).minusDays(35));
        });

        cleanupService.runIfDue();

        transactionTemplate.executeWithoutResult(status -> {
            assertFalse(itemRepository.findById(actionItemId).isPresent(), "Expired done next action must be purged");
            assertFalse(projectItemRepository.findById(actionItemId).isPresent(), "Project association must be purged");
        });
    }

    @Test
    void purgesExpiredDeletedProjectAndRemovesAssociatedProjectItems() {
        UUID[] ids = transactionTemplate.execute(status -> {
            Project project = createProject("Old Project");
            org.springframework.test.util.ReflectionTestUtils.setField(
                project.getItem(), "deletedAt", Instant.now().minus(java.time.Duration.ofDays(35)));
            itemRepository.save(project.getItem());
            UUID childId = createActiveStuffInProject("Child Item", project);
            return new UUID[]{project.getItemId(), childId};
        });

        cleanupService.runIfDue();

        transactionTemplate.executeWithoutResult(status -> {
            assertFalse(itemRepository.findById(ids[0]).isPresent(), "Expired deleted project must be purged");
            assertFalse(projectItemRepository.findById(ids[1]).isPresent(), "Child project item link must be purged");
            assertTrue(itemRepository.findById(ids[1]).isPresent(), "Child item itself must remain");
        });
    }

    private Project createProject(String name) {
        Item item = new Item(new Title(name), null);
        itemRepository.save(item);
        Project project = new Project(item, null);
        return projectRepository.save(project);
    }

    private UUID createDoneNextActionInProject(String title, Project project, LocalDate doneDate) {
        Item item = new Item(new Title(title), null);
        NextAction nextAction = item.convertToNextAction(BigDecimal.ONE, Duration.ofMinutes(15), Set.of());
        nextAction.markDone(java.time.Clock.fixed(doneDate.atStartOfDay().toInstant(ZoneOffset.UTC), ZoneOffset.UTC));
        item = itemRepository.saveAndFlush(item);

        projectItemRepository.insertProjectItem(project.getItemId(), item.getId());
        entityManager.flush();
        return item.getId();
    }

    private UUID createActiveStuffInProject(String title, Project project) {
        Item item = new Item(new Title(title), null);
        item.markAsStuff();
        itemRepository.save(item);
        projectItemRepository.insertProjectItem(project.getItemId(), item.getId());
        entityManager.flush();
        return item.getId();
    }
}
