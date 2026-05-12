package com.gtdonrails.api.controllers;

import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.math.BigDecimal;
import java.time.Duration;
import java.util.Set;

import com.gtdonrails.api.entities.Context;
import com.gtdonrails.api.entities.Item;
import com.gtdonrails.api.entities.NextAction;
import com.gtdonrails.api.enums.NextActionStatus;
import com.gtdonrails.api.repositories.ContextRepository;
import com.gtdonrails.api.repositories.ItemRepository;
import com.gtdonrails.api.repositories.NextActionRepository;
import com.gtdonrails.api.types.Title;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;

@SpringBootTest
@ActiveProfiles("test")
@Tag("integration")
class NextActionControllerTests {

    @Autowired
    private WebApplicationContext webApplicationContext;

    @Autowired
    private NextActionRepository nextActionRepository;

    @Autowired
    private ItemRepository itemRepository;

    @Autowired
    private ContextRepository contextRepository;

    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders.webAppContextSetup(webApplicationContext).build();
        nextActionRepository.deleteAll();
        itemRepository.deleteAll();
        contextRepository.deleteAll();
    }

    @Test
    void patchesNextAction() throws Exception {
        Context context = contextRepository.save(new Context("Home"));
        Item item = itemRepository.save(new Item(new Title("Buy milk"), null));
        NextAction nextAction = nextActionRepository.save(
            new NextAction(item, new BigDecimal("2.0"), Duration.ofMinutes(15), Set.of(context)));

        mockMvc.perform(patch("/next-actions/{id}", nextAction.getItemId())
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"energy\":\"8.0\"}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.energy").value(8.0))
            .andExpect(jsonPath("$.estimatedTime").value("PT15M"));
    }

    @Test
    void marksNextActionAsOngoing() throws Exception {
        Context context = contextRepository.save(new Context("Home"));
        Item item = itemRepository.save(new Item(new Title("Buy milk"), null));
        NextAction nextAction = nextActionRepository.save(
            new NextAction(item, new BigDecimal("2.0"), Duration.ofMinutes(15), Set.of(context)));

        mockMvc.perform(post("/next-actions/{id}/ongoing", nextAction.getItemId()))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.status").value(NextActionStatus.ONGOING.name()));
    }

    @Test
    void marksNextActionAsDone() throws Exception {
        Context context = contextRepository.save(new Context("Home"));
        Item item = itemRepository.save(new Item(new Title("Buy milk"), null));
        NextAction nextAction = nextActionRepository.save(
            new NextAction(item, new BigDecimal("2.0"), Duration.ofMinutes(15), Set.of(context)));

        mockMvc.perform(post("/next-actions/{id}/done", nextAction.getItemId()))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.status").value(NextActionStatus.DONE.name()));
    }

    @Test
    void marksNextActionAsUndone() throws Exception {
        Context context = contextRepository.save(new Context("Home"));
        Item item = itemRepository.save(new Item(new Title("Buy milk"), null));
        NextAction nextAction = new NextAction(item, new BigDecimal("2.0"), Duration.ofMinutes(15), Set.of(context));
        nextAction.markDone(java.time.Clock.systemUTC());
        nextAction = nextActionRepository.save(nextAction);

        mockMvc.perform(post("/next-actions/{id}/undone", nextAction.getItemId()))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.status").value(NextActionStatus.NEXT_ACTION.name()));
    }

    @Test
    void getsNextActionsOrderedByEnergy() throws Exception {
        Context context = contextRepository.save(new Context("Home"));
        
        Item item1 = itemRepository.save(new Item(new Title("Task 1"), null));
        nextActionRepository.save(new NextAction(item1, new BigDecimal("2.0"), Duration.ofMinutes(15), Set.of(context)));

        Item item2 = itemRepository.save(new Item(new Title("Task 2"), null));
        nextActionRepository.save(new NextAction(item2, new BigDecimal("8.0"), Duration.ofMinutes(30), Set.of(context)));

        mockMvc.perform(get("/next-actions?contextId={contextId}&orderBy=energy", context.getId()))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$", hasSize(2)))
            .andExpect(jsonPath("$[0].energy").value(8.0))
            .andExpect(jsonPath("$[1].energy").value(2.0));
    }

    @Test
    void getsAllNextActionsOrderedByEnergyWithoutContext() throws Exception {
        Context home = contextRepository.save(new Context("Home"));
        Context office = contextRepository.save(new Context("Office"));
        Item item1 = itemRepository.save(new Item(new Title("Task 1"), null));
        nextActionRepository.save(new NextAction(item1, new BigDecimal("2.0"), Duration.ofMinutes(15), Set.of(home)));
        Item item2 = itemRepository.save(new Item(new Title("Task 2"), null));
        nextActionRepository.save(new NextAction(item2, new BigDecimal("8.0"), Duration.ofMinutes(30), Set.of(office)));

        mockMvc.perform(get("/next-actions?orderBy=energy"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$", hasSize(2)))
            .andExpect(jsonPath("$[0].energy").value(8.0))
            .andExpect(jsonPath("$[1].energy").value(2.0));
    }

    @Test
    void getsNextActionsOrderedByTime() throws Exception {
        Context context = contextRepository.save(new Context("Home"));
        
        Item item1 = itemRepository.save(new Item(new Title("Task 1"), null));
        nextActionRepository.save(new NextAction(item1, new BigDecimal("2.0"), Duration.ofMinutes(15), Set.of(context)));

        Item item2 = itemRepository.save(new Item(new Title("Task 2"), null));
        nextActionRepository.save(new NextAction(item2, new BigDecimal("8.0"), Duration.ofMinutes(30), Set.of(context)));

        mockMvc.perform(get("/next-actions?contextId={contextId}&orderBy=time", context.getId()))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$", hasSize(2)))
            .andExpect(jsonPath("$[0].estimatedTime").value("PT30M"))
            .andExpect(jsonPath("$[1].estimatedTime").value("PT15M"));
    }

    @Test
    void getsAllNextActionsOrderedByTimeWithoutContext() throws Exception {
        Context home = contextRepository.save(new Context("Home"));
        Context office = contextRepository.save(new Context("Office"));
        Item item1 = itemRepository.save(new Item(new Title("Task 1"), null));
        nextActionRepository.save(new NextAction(item1, new BigDecimal("2.0"), Duration.ofMinutes(15), Set.of(home)));
        Item item2 = itemRepository.save(new Item(new Title("Task 2"), null));
        nextActionRepository.save(new NextAction(item2, new BigDecimal("8.0"), Duration.ofMinutes(30), Set.of(office)));

        mockMvc.perform(get("/next-actions?orderBy=time"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$", hasSize(2)))
            .andExpect(jsonPath("$[0].estimatedTime").value("PT30M"))
            .andExpect(jsonPath("$[1].estimatedTime").value("PT15M"));
    }

    @Test
    void getsDeletedNextActions() throws Exception {
        Context context = contextRepository.save(new Context("Home"));
        Item item = new Item(new Title("Buy milk"), null);
        item.softDelete();
        item = itemRepository.save(item);
        nextActionRepository.save(
            new NextAction(item, new BigDecimal("2.0"), Duration.ofMinutes(15), Set.of(context)));

        mockMvc.perform(get("/next-actions/deleted"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$", hasSize(1)));
    }

    @Test
    void getsDoneNextActions() throws Exception {
        Context context = contextRepository.save(new Context("Home"));
        Item item = itemRepository.save(new Item(new Title("Buy milk"), null));
        NextAction nextAction = new NextAction(item, new BigDecimal("2.0"), Duration.ofMinutes(15), Set.of(context));
        nextAction.markDone(java.time.Clock.systemUTC());
        nextActionRepository.save(nextAction);

        mockMvc.perform(get("/next-actions/done?page=0&size=10"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.content", hasSize(1)))
            .andExpect(jsonPath("$.content[0].status").value(NextActionStatus.DONE.name()));
    }
}
