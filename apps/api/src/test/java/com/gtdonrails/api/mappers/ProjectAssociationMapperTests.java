package com.gtdonrails.api.mappers;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

import java.util.UUID;

import com.gtdonrails.api.entities.Item;
import com.gtdonrails.api.entities.Project;
import com.gtdonrails.api.entities.ProjectItem;
import com.gtdonrails.api.types.Title;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

class ProjectAssociationMapperTests {

    private ProjectAssociationMapper mapper;

    @BeforeEach
    void setUp() {
        mapper = new ProjectAssociationMapper();
    }

    @Test
    void returnsOwningProjectTitle() {
        Item projectItem = new Item(new Title("Website refresh"), null);
        Project project = new Project(projectItem, null);
        Item actionItem = new Item(new Title("Review copy"), null);
        ProjectItem association = new ProjectItem(project, actionItem);
        actionItem.setProjectItem(association);

        assertEquals("Website refresh", mapper.titleFor(actionItem));
    }

    @Test
    void returnsOwningProjectId() {
        UUID projectId = UUID.randomUUID();
        Item projectItem = new Item(new Title("Website refresh"), null);
        ReflectionTestUtils.setField(projectItem, "id", projectId);
        Project project = new Project(projectItem, null);
        Item actionItem = new Item(new Title("Review copy"), null);
        ProjectItem association = new ProjectItem(project, actionItem);
        actionItem.setProjectItem(association);

        assertEquals(projectId, mapper.projectIdFor(actionItem));
    }

    @Test
    void returnsNullWhenItemHasNoProjectAssociation() {
        Item item = new Item(new Title("Review copy"), null);

        assertNull(mapper.titleFor(item));
        assertNull(mapper.projectIdFor(item));
    }
}
