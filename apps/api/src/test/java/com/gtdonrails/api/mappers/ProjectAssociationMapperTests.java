package com.gtdonrails.api.mappers;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

import com.gtdonrails.api.entities.Item;
import com.gtdonrails.api.entities.Project;
import com.gtdonrails.api.entities.ProjectItem;
import com.gtdonrails.api.types.Title;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.BeforeEach;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.junit.jupiter.api.extension.ExtendWith;
import com.gtdonrails.api.repositories.ProjectItemRepository;
import java.util.Optional;
import java.util.UUID;
import static org.mockito.Mockito.when;
import org.springframework.test.util.ReflectionTestUtils;

@ExtendWith(MockitoExtension.class)
class ProjectAssociationMapperTests {

    @Mock
    private ProjectItemRepository projectItemRepository;

    private ProjectAssociationMapper mapper;

    @BeforeEach
    void setUp() {
        mapper = new ProjectAssociationMapper(projectItemRepository);
    }

    @Test
    void returnsOwningProjectTitle() {
        Item projectItem = new Item(new Title("Website refresh"), null);
        Project project = new Project(projectItem, null);
        Item actionItem = new Item(new Title("Review copy"), null);
        ProjectItem association = new ProjectItem(project, actionItem);
        UUID actionId = UUID.randomUUID();
        ReflectionTestUtils.setField(actionItem, "id", actionId);
        when(projectItemRepository.findById(actionId)).thenReturn(Optional.of(association));

        assertEquals("Website refresh", mapper.titleFor(actionItem));
    }

    @Test
    void returnsNullWhenItemHasNoProjectAssociation() {
        Item item = new Item(new Title("Review copy"), null);

        assertNull(mapper.titleFor(item));
    }
}
