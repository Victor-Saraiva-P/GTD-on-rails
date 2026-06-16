package com.gtdonrails.api.services;

import java.io.IOException;
import java.math.BigDecimal;
import java.time.Clock;
import java.time.Duration;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;
import java.util.stream.Stream;

import com.gtdonrails.api.entities.Calendar;
import com.gtdonrails.api.entities.Context;
import com.gtdonrails.api.entities.ContextIconAsset;
import com.gtdonrails.api.entities.Item;
import com.gtdonrails.api.entities.ItemAsset;
import com.gtdonrails.api.entities.NextAction;
import com.gtdonrails.api.repositories.CalendarRepository;
import com.gtdonrails.api.repositories.ContextIconAssetRepository;
import com.gtdonrails.api.repositories.ContextRepository;
import com.gtdonrails.api.repositories.ItemAssetRepository;
import com.gtdonrails.api.repositories.ItemRepository;
import com.gtdonrails.api.repositories.NextActionRepository;
import com.gtdonrails.api.types.BlockEntity;
import com.gtdonrails.api.types.BlockEntityAttrs;
import com.gtdonrails.api.types.InlineMark;
import com.gtdonrails.api.types.InlineMarkAttrs;
import com.gtdonrails.api.types.ItemBody;
import com.gtdonrails.api.types.Title;
import org.springframework.context.annotation.Profile;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Profile("dev")
public class DemoDataSeedService {

    private static final String PDF_RESOURCE = "demo-assets/TauriSlideshow.pdf";
    private static final String PDF_FILE_NAME = "TauriSlideshow.pdf";
    private static final String COMPUTER_CONTEXT = "Computer";
    private static final String OFFICE_CONTEXT = "Office";
    private static final String HOME_CONTEXT = "Home";
    private static final String ERRANDS_CONTEXT = "Errands";

    private final AssetStorageService assetStorageService;
    private final CalendarRepository calendarRepository;
    private final ContextIconAssetRepository contextIconAssetRepository;
    private final ContextRepository contextRepository;
    private final ItemAssetRepository itemAssetRepository;
    private final ItemRepository itemRepository;
    private final NextActionRepository nextActionRepository;
    private final Clock clock;

    public DemoDataSeedService(
        AssetStorageService assetStorageService,
        CalendarRepository calendarRepository,
        ContextIconAssetRepository contextIconAssetRepository,
        ContextRepository contextRepository,
        ItemAssetRepository itemAssetRepository,
        ItemRepository itemRepository,
        NextActionRepository nextActionRepository,
        Clock clock
    ) {
        this.assetStorageService = assetStorageService;
        this.calendarRepository = calendarRepository;
        this.contextIconAssetRepository = contextIconAssetRepository;
        this.contextRepository = contextRepository;
        this.itemAssetRepository = itemAssetRepository;
        this.itemRepository = itemRepository;
        this.nextActionRepository = nextActionRepository;
        this.clock = clock;
    }

    /**
     * Recreates the development demo dataset and its asset files.
     *
     * <p>Example: {@code demoDataSeedService.resetDemoData()}.</p>
     */
    @Transactional
    public DemoSeedResult resetDemoData() {
        deleteDemoData();
        seedDemoData();
        return new DemoSeedResult(itemRepository.count(), contextRepository.count());
    }

    /**
     * Checks whether the development database should be seeded automatically.
     *
     * <p>Example: {@code if (demoDataSeedService.isDatabaseEmpty()) seed();}.</p>
     */
    public boolean isDatabaseEmpty() {
        return itemRepository.count() == 0;
    }

    private void deleteDemoData() {
        itemAssetRepository.findAll().forEach(this::deleteItemAsset);
        contextIconAssetRepository.findAll().forEach(this::deleteContextIconAsset);
        nextActionRepository.findAll().forEach(nextAction -> nextActionRepository.deleteContextLinks(nextAction.getItemId()));
        calendarRepository.deleteAll();
        nextActionRepository.deleteAll();
        itemAssetRepository.deleteAll();
        contextIconAssetRepository.deleteAll();
        itemRepository.deleteAll();
        contextRepository.deleteAll();
    }

    private void seedDemoData() {
        Map<String, Context> contexts = seedContexts();
        seedInboxStuff();
        seedNextActions(contexts);
        seedCalendars();
    }

    private Map<String, Context> seedContexts() {
        List<Context> contexts = Stream.of(COMPUTER_CONTEXT, OFFICE_CONTEXT, HOME_CONTEXT, ERRANDS_CONTEXT)
            .map(Context::new)
            .map(contextRepository::save)
            .toList();
        return contexts.stream().collect(Collectors.toMap(Context::getName, Function.identity()));
    }

    private void seedInboxStuff() {
        saveStuff("Plan team offsite", "Need a realistic venue, budget range, and agenda before proposing dates.");
        saveStuff("Ideas for improving release notes", "Compare current changelog with the last three customer-facing releases.");
        saveStuff("Replace hallway light bulb", "Check if the spare warm-white bulbs still fit the hallway fixture.");
        saveStuff("Article about local-first software", "Read later and decide whether it belongs in the architecture notes.");
        saveStuff("Ask Maya about conference travel", "Confirm whether she already booked flights before I reserve the hotel.");
        Item deleted = saveStuff("Old note about unused task app", "No longer relevant after moving the workflow here.");
        deleted.softDelete();
        itemRepository.save(deleted);
    }

    private void seedNextActions(Map<String, Context> contexts) {
        savePdfNextAction(contexts);
        saveNextAction("Prepare demo script for project walkthrough", "Use the README screenshot sequence as the speaking outline.", "8.3", 45, contexts(COMPUTER_CONTEXT, OFFICE_CONTEXT, contexts), 2);
        saveNextAction("Reply to Jordan's API review comments", "Answer the pagination question and link the failing test case.", "7.2", 30, contexts(COMPUTER_CONTEXT, contexts), 1);
        saveNextAction("Schedule dentist cleaning", "Call the clinic before lunch; ask for a morning slot next week.", "3.0", 10, contexts(ERRANDS_CONTEXT, contexts), 6);
        saveNextAction("Buy coffee beans for the office", "Get two medium roasts and one decaf bag.", "2.5", 20, contexts(ERRANDS_CONTEXT, OFFICE_CONTEXT, contexts), null);
        saveNextAction("Compare hotel options for conference week", "Check distance to venue and cancellation policy.", "5.5", 50, contexts(COMPUTER_CONTEXT, contexts), 7);
        saveNextAction("Update household budget spreadsheet", "Add subscription changes and the hardware receipt.", "4.2", 35, contexts(HOME_CONTEXT, COMPUTER_CONTEXT, contexts), 4);
        saveNextAction("Send reimbursement receipts", "Attach taxi and dinner receipts before Friday.", "6.0", 25, contexts(COMPUTER_CONTEXT, contexts), 3);
        saveOngoing("Fix Drive sync warning on laptop", contexts(COMPUTER_CONTEXT, contexts));
        saveOngoing("Draft project presentation opening", contexts(OFFICE_CONTEXT, COMPUTER_CONTEXT, contexts));
        saveDone("Send weekly status report", contexts(COMPUTER_CONTEXT, OFFICE_CONTEXT, contexts));
        saveDone("Renew personal domain", contexts(COMPUTER_CONTEXT, contexts));
        saveDone("Clear desk before Monday planning", contexts(HOME_CONTEXT, contexts));
        saveDeletedNextAction(contexts(COMPUTER_CONTEXT, contexts));
    }

    private void seedCalendars() {
        LocalDate today = LocalDate.now(clock);
        saveCalendar("Daily stand-up", today, "Share blockers and confirm the demo owner.");
        saveCalendar("Dentist appointment", today.plusDays(1), "Bring insurance card and arrive ten minutes early.");
        saveCalendar("Project demo", today.plusDays(3), "Use the seeded screenshot flow as the demo path.");
        saveCalendar("Grocery pickup", today.plusDays(4), "Pickup window is flexible after work.");
        saveCalendar("Weekly review", today.plusDays(5), "Review inbox, next actions, and waiting-for notes.");
        Calendar done = saveCalendar("Morning planning", today, "Closed during the first work block.");
        done.markDone(clock);
        calendarRepository.save(done);
        Calendar deleted = saveCalendar("Cancelled vendor call", today.plusDays(2), "Removed after the vendor moved the meeting.");
        deleted.getItem().softDelete();
        calendarRepository.save(deleted);
    }

    private void savePdfNextAction(Map<String, Context> contexts) {
        Item item = saveNextAction(
            "Review Tauri architecture slides before Friday demo",
            pdfBodyText(),
            "9.4",
            40,
            contexts(COMPUTER_CONTEXT, OFFICE_CONTEXT, contexts),
            2);
        attachPdf(item);
    }

    private Item saveNextAction(String title, String body, String energy, long minutes, Set<Context> contexts, Integer deadlineOffset) {
        Item item = new Item(new Title(title), body);
        NextAction nextAction = item.convertToNextAction(new BigDecimal(energy), Duration.ofMinutes(minutes), contexts);
        if (deadlineOffset != null) nextAction.setDeadline(LocalDate.now(clock).plusDays(deadlineOffset));
        return itemRepository.save(item);
    }

    private void saveOngoing(String title, Set<Context> contexts) {
        Item item = saveNextAction(title, "Keep the current state visible while finishing the active work.", "6.5", 60, contexts, 1);
        item.getNextAction().markOnGoing(clock);
        itemRepository.save(item);
    }

    private void saveDone(String title, Set<Context> contexts) {
        Item item = saveNextAction(title, "Finished and kept for review context.", "4.0", 25, contexts, null);
        item.getNextAction().markDone(clock);
        itemRepository.save(item);
    }

    private void saveDeletedNextAction(Set<Context> contexts) {
        Item item = saveNextAction("Archive old onboarding checklist", "Replaced by the current project notes.", "2.0", 15, contexts, null);
        item.softDelete();
        itemRepository.save(item);
    }

    private Calendar saveCalendar(String title, LocalDate date, String body) {
        Item item = new Item(new Title(title), body);
        item.convertToCalendar(date, null);
        return itemRepository.save(item).getCalendar();
    }

    private Item saveStuff(String title, String body) {
        Item item = new Item(new Title(title), body);
        item.markAsStuff();
        return itemRepository.save(item);
    }

    private Set<Context> contexts(String first, Map<String, Context> contexts) {
        return Set.of(contexts.get(first));
    }

    private Set<Context> contexts(String first, String second, Map<String, Context> contexts) {
        return Set.of(contexts.get(first), contexts.get(second));
    }

    private void attachPdf(Item item) {
        ClassPathResource resource = new ClassPathResource(PDF_RESOURCE);
        ItemAsset asset = new ItemAsset(item, PDF_FILE_NAME, PDF_FILE_NAME, "application/pdf", resourceSize(resource));
        copyPdfAsset(resource, asset);
        itemAssetRepository.save(asset);
        item.setBody(pdfBody(asset));
        itemRepository.save(item);
    }

    private void copyPdfAsset(ClassPathResource resource, ItemAsset asset) {
        try {
            assetStorageService.copyBundledItemAsset(asset.relativePath(), resource.getInputStream(), PDF_FILE_NAME);
        } catch (IOException exception) {
            throw new IllegalStateException("Demo PDF resource value '" + PDF_RESOURCE + "' is invalid; expected readable classpath resource", exception);
        }
    }

    private long resourceSize(ClassPathResource resource) {
        try {
            return resource.contentLength();
        } catch (IOException exception) {
            throw new IllegalStateException("Demo PDF resource value '" + PDF_RESOURCE + "' is invalid; expected readable content length", exception);
        }
    }

    private ItemBody pdfBody(ItemAsset asset) {
        String text = pdfBodyText() + "\n\n⟦asset:" + asset.getId() + "⟧";
        int from = text.indexOf("⟦asset:");
        BlockEntity entity = new BlockEntity("demo-pdf", "pdf", from, text.length(), asset.getId().toString(), pdfAttrs(asset));
        InlineMark link = tauriDocsLink(text);
        return new ItemBody(text, List.of(link), List.of(), List.of(entity));
    }

    private InlineMark tauriDocsLink(String text) {
        int from = text.indexOf("Tauri docs");
        int to = from + "Tauri docs".length();
        return new InlineMark("tauri-docs", "link", from, to, new InlineMarkAttrs("https://tauri.app/", null));
    }

    private BlockEntityAttrs pdfAttrs(ItemAsset asset) {
        return new BlockEntityAttrs(PDF_FILE_NAME, "application/pdf", asset.relativePath(), asset.publicUrl("/assets"), asset.relativePath());
    }

    private String pdfBodyText() {
        return """
            Notes for the Friday walkthrough:
            - Re-read the Tauri section before the demo.
            - Check the Tauri docs for wording about sidecars.
            - Keep the architecture explanation under two minutes.
            - Mention why the local-first storage model matters.
            """.trim();
    }

    private void deleteItemAsset(ItemAsset asset) {
        assetStorageService.deleteAsset(asset.relativePath());
    }

    private void deleteContextIconAsset(ContextIconAsset asset) {
        assetStorageService.deleteAsset(asset.relativePath());
    }

    public record DemoSeedResult(long itemCount, long contextCount) {}
}
