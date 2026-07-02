package com.gtdonrails.api.services;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.Optional;
import java.util.UUID;

import com.gtdonrails.api.dtos.project.PatchProjectRequestDto;
import com.gtdonrails.api.entities.Item;
import com.gtdonrails.api.entities.Project;
import com.gtdonrails.api.mappers.ProjectMapper;
import com.gtdonrails.api.normalizers.ItemTextNormalizer;
import com.gtdonrails.api.persistence.bootstrap.services.PersistenceGitSyncService;
import com.gtdonrails.api.repositories.ProjectRepository;
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
    private PersistenceGitSyncService persistenceGitSyncService;

    @Mock
    private GoogleCalendarEventQueueService googleCalendarEventQueueService;

    private ProjectService projectService;
    private Project project;
    private UUID projectId;

    @BeforeEach
    void setUp() {
        projectService = new ProjectService(
            projectRepository,
            new ProjectMapper(),
            new ItemTextNormalizer(),
            persistenceGitSyncService,
            googleCalendarEventQueueService,
            new AfterCommitExecutor(),
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
    }

    @Test
    void patchingProjectQueuesGoogleCalendarEvent() {
        when(projectRepository.findByItemIdAndItem_DeletedAtIsNull(projectId)).thenReturn(Optional.of(project));
        when(projectRepository.save(any(Project.class))).thenReturn(project);

        projectService.patchProject(projectId, new PatchProjectRequestDto("Launch public beta", null, null));

        verify(googleCalendarEventQueueService).requestUpsert(projectId);
    }

    @Test
    void resettingDoneProjectQueuesGoogleCalendarEvent() {
        project.markDone(Clock.fixed(Instant.parse("2026-05-21T12:34:56Z"), ZoneId.of("UTC")));
        when(projectRepository.findByItemIdAndItem_DeletedAtIsNull(projectId)).thenReturn(Optional.of(project));
        when(projectRepository.save(any(Project.class))).thenReturn(project);

        projectService.resetStatus(projectId);

        verify(googleCalendarEventQueueService).requestUpsert(projectId);
    }

    @Test
    void deletingProjectQueuesGoogleCalendarEventDelete() {
        when(projectRepository.findByItemIdAndItem_DeletedAtIsNull(projectId)).thenReturn(Optional.of(project));

        projectService.deleteProject(projectId);

        verify(googleCalendarEventQueueService).requestDelete(projectId);
    }

    @Test
    void recoveringProjectQueuesGoogleCalendarEvent() {
        when(projectRepository.findById(projectId)).thenReturn(Optional.of(project));
        when(projectRepository.save(any(Project.class))).thenReturn(project);

        projectService.recoverProject(projectId);

        verify(googleCalendarEventQueueService).requestUpsert(projectId);
    }
}
