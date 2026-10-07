package com.gtdonrails.api.services;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import com.gtdonrails.api.bodydocuments.ItemBodyDocumentService;
import com.gtdonrails.api.dtos.project.PatchProjectRequestDto;
import com.gtdonrails.api.dtos.project.ProjectActionCountProjection;
import com.gtdonrails.api.dtos.project.ProjectResponseDto;
import com.gtdonrails.api.entities.Item;
import com.gtdonrails.api.entities.Project;
import com.gtdonrails.api.enums.ProjectStatus;
import com.gtdonrails.api.mappers.ProjectMapper;
import com.gtdonrails.api.normalizers.ItemTextNormalizer;
import com.gtdonrails.api.repositories.ProjectItemRepository;
import com.gtdonrails.api.repositories.ProjectRepository;
import com.gtdonrails.api.types.ItemBody;
import com.gtdonrails.api.types.Title;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

@ExtendWith(MockitoExtension.class)
class ProjectServiceTests {

    @Mock
    private ProjectRepository projectRepository;

    @Mock
    private ProjectItemRepository projectItemRepository;

    @Mock
    private GoogleCalendarEventQueueService googleCalendarEventQueueService;

    @Mock
    private CacheInvalidationService cacheInvalidationService;

    @Mock
    private ItemBodyDocumentService bodyDocuments;

    @Mock
    private ItemAssetService itemAssetService;

    private ProjectService projectService;
    private Project project;
    private UUID projectId;

    @BeforeEach
    void setUp() {
        projectService = new ProjectService(
            projectRepository,
            projectItemRepository,
            new ProjectMapper(),
            new ItemTextNormalizer(),
            googleCalendarEventQueueService,
            new AfterCommitExecutor(),
            cacheInvalidationService,
            bodyDocuments,
            itemAssetService,
            Clock.fixed(Instant.parse("2026-05-21T12:34:56Z"), ZoneId.of("UTC")));
        projectId = UUID.randomUUID();
        Item item = new Item(new Title("Launch beta"), null);
        ReflectionTestUtils.setField(item, "id", projectId);
        project = new Project(item, LocalDate.parse("2026-06-01"));
        ReflectionTestUtils.setField(project, "itemId", projectId);
    }

    @Test
    void markingProjectDoneQueuesGoogleCalendarEvent() {
        when(projectRepository.findByItemIdAndItem_DeletedAtIsNull(projectId)).thenReturn(Optional.of(project));
        when(projectRepository.save(any(Project.class))).thenReturn(project);

        projectService.markDone(projectId);

        verify(googleCalendarEventQueueService).requestUpsert(projectId);
        verify(cacheInvalidationService).evictProjectMutation();
    }

    @Test
    void patchingProjectQueuesGoogleCalendarEvent() {
        when(projectRepository.findByItemIdAndItem_DeletedAtIsNull(projectId)).thenReturn(Optional.of(project));
        when(projectRepository.save(any(Project.class))).thenReturn(project);

        projectService.patchProject(projectId, new PatchProjectRequestDto("Launch public beta", null, null));

        verify(googleCalendarEventQueueService).requestUpsert(projectId);
        verify(cacheInvalidationService).evictProjectMutation();
    }

    @Test
    void resettingDoneProjectQueuesGoogleCalendarEvent() {
        project.markDone(Clock.fixed(Instant.parse("2026-05-21T12:34:56Z"), ZoneId.of("UTC")));
        when(projectRepository.findByItemIdAndItem_DeletedAtIsNull(projectId)).thenReturn(Optional.of(project));
        when(projectRepository.save(any(Project.class))).thenReturn(project);

        projectService.resetStatus(projectId);

        verify(googleCalendarEventQueueService).requestUpsert(projectId);
        verify(cacheInvalidationService).evictProjectMutation();
    }

    @Test
    void deletingProjectQueuesGoogleCalendarEventDelete() {
        when(projectRepository.findByItemIdAndItem_DeletedAtIsNull(projectId)).thenReturn(Optional.of(project));

        projectService.deleteProject(projectId);

        verify(googleCalendarEventQueueService).requestDelete(projectId);
        verify(cacheInvalidationService).evictProjectMutation();
    }

    @Test
    void deletingProjectSoftDeletesItsActiveAssets() {
        when(projectRepository.findByItemIdAndItem_DeletedAtIsNull(projectId)).thenReturn(Optional.of(project));

        projectService.deleteProject(projectId);

        verify(itemAssetService).softDeleteActiveItemAssets(projectId);
    }

    @Test
    void recoveringProjectQueuesGoogleCalendarEvent() {
        when(projectRepository.findById(projectId)).thenReturn(Optional.of(project));
        when(projectRepository.save(any(Project.class))).thenReturn(project);

        projectService.recoverProject(projectId);

        verify(googleCalendarEventQueueService).requestUpsert(projectId);
        verify(cacheInvalidationService).evictProjectMutation();
    }

    @Test
    void recoveringProjectRestoresOnlyAssetsReferencedByItsCanonicalBody() {
        ItemBody canonicalBody = new ItemBody("![Plan](assets/asset/brief.pdf)", List.of(), List.of(), List.of());
        when(projectRepository.findById(projectId)).thenReturn(Optional.of(project));
        when(projectRepository.save(any(Project.class))).thenReturn(project);
        when(bodyDocuments.read(projectId, project.getItem().getBody())).thenReturn(canonicalBody);

        projectService.recoverProject(projectId);

        verify(itemAssetService).reconcileBodyAssetReferences(projectId, canonicalBody);
    }

    @Test
    void listProjectsIncludesAggregatedActionCounts() {
        when(projectRepository.findAllByStatusAndItem_DeletedAtIsNullOrderByItem_CreatedAtAsc(ProjectStatus.ACTIVE))
            .thenReturn(List.of(project));
        when(projectItemRepository.countActiveActionsGroupedByProject())
            .thenReturn(List.of(new ActionCountStub(projectId, 3L)));

        List<ProjectResponseDto> result = projectService.listProjects();

        assertEquals(1, result.size());
        assertEquals(3L, result.get(0).actionCount());
    }

    private record ActionCountStub(UUID projectId, long actionCount) implements ProjectActionCountProjection {
        @Override public UUID getProjectId() { return projectId; }
        @Override public long getActionCount() { return actionCount; }
    }
}
