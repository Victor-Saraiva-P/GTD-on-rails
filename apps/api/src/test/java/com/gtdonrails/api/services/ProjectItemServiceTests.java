package com.gtdonrails.api.services;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import com.gtdonrails.api.dtos.inbox.CreateStuffRequestDto;
import com.gtdonrails.api.dtos.project.ProjectItemResponseDto;
import com.gtdonrails.api.entities.Item;
import com.gtdonrails.api.entities.Project;
import com.gtdonrails.api.entities.ProjectItem;
import com.gtdonrails.api.normalizers.ItemTextNormalizer;
import com.gtdonrails.api.repositories.ItemRepository;
import com.gtdonrails.api.repositories.ProjectItemRepository;
import com.gtdonrails.api.repositories.ProjectRepository;
import com.gtdonrails.api.types.Title;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

@ExtendWith(MockitoExtension.class)
@Tag("unit")
class ProjectItemServiceTests {

    @Mock
    private ProjectRepository projectRepository;

    @Mock
    private ProjectItemRepository projectItemRepository;

    @Mock
    private ItemRepository itemRepository;

    @Mock
    private CacheInvalidationService cacheInvalidationService;

    private ProjectItemService projectItemService;
    private Project project;
    private UUID projectId;

    @BeforeEach
    void setUp() {
        projectItemService = new ProjectItemService(
            projectRepository,
            projectItemRepository,
            itemRepository,
            new ItemTextNormalizer(),
            cacheInvalidationService,
            new AfterCommitExecutor());

        projectId = UUID.randomUUID();
        Item projectItem = new Item(new Title("Main Project"), null);
        ReflectionTestUtils.setField(projectItem, "id", projectId);
        project = new Project(projectItem, null);
        ReflectionTestUtils.setField(project, "itemId", projectId);
    }

    @Test
    void createProjectStuffInsertsItemAndEvictsCache() {
        when(projectRepository.findByItemIdAndItem_DeletedAtIsNull(projectId)).thenReturn(Optional.of(project));
        when(itemRepository.saveAndFlush(any(Item.class))).thenAnswer(invocation -> {
            Item item = invocation.getArgument(0);
            ReflectionTestUtils.setField(item, "id", UUID.randomUUID());
            return item;
        });

        ProjectItemResponseDto response = projectItemService.createProjectStuff(projectId, new CreateStuffRequestDto("Task 1"));

        assertEquals("Task 1", response.title());
        verify(projectItemRepository).insertProjectItem(any(), any());
        verify(cacheInvalidationService).evictProjectMutation();
    }

    @Test
    void listProjectActionsReturnsSortedItems() {
        when(projectRepository.findByItemIdAndItem_DeletedAtIsNull(projectId)).thenReturn(Optional.of(project));
        Item item = new Item(new Title("Action 1"), null);
        ReflectionTestUtils.setField(item, "id", UUID.randomUUID());
        when(projectItemRepository.findProjectActionItems(projectId)).thenReturn(List.of(new ProjectItem(project, item)));

        List<ProjectItemResponseDto> result = projectItemService.listProjectActions(projectId);

        assertEquals(1, result.size());
        assertEquals("Action 1", result.get(0).title());
    }
}
