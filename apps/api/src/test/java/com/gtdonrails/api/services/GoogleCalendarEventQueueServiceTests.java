package com.gtdonrails.api.services;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assertions.fail;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

import com.gtdonrails.api.dtos.sync.GoogleCalendarSyncState;
import com.gtdonrails.api.dtos.sync.GoogleCalendarSyncStatusDto;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;

@Tag("unit")
class GoogleCalendarEventQueueServiceTests {

    private FakeGoogleCalendarEventSyncService syncService;
    private GoogleCalendarEventQueueService queueService;

    @AfterEach
    void tearDown() {
        if (queueService != null) {
            queueService.shutdown();
        }
    }

    @Test
    void requestUpsertReturnsBeforeGoogleWorkExecutes() {
        syncService = new FakeGoogleCalendarEventSyncService();
        queueService = new GoogleCalendarEventQueueService(syncService, 0);
        syncService.pause = true;
        UUID itemId = UUID.randomUUID();

        queueService.requestUpsert(itemId);
        waitForRunning();

        assertTrue(queueService.status().running());
        assertTrue(syncService.operations.isEmpty());
        syncService.release();
        waitForIdle();
        assertEquals(List.of("upsert:" + itemId), syncService.operations);
    }

    @Test
    void sameItemKeepsLatestPendingOperation() {
        syncService = new FakeGoogleCalendarEventSyncService();
        queueService = new GoogleCalendarEventQueueService(syncService, 0);
        UUID firstItemId = UUID.randomUUID();
        UUID secondItemId = UUID.randomUUID();
        syncService.pause = true;

        queueService.requestUpsert(firstItemId);
        waitForRunning();
        queueService.requestDelete(secondItemId);
        queueService.requestUpsert(secondItemId);
        syncService.release();
        waitForIdle();

        assertEquals(List.of("upsert:" + firstItemId, "upsert:" + secondItemId), syncService.operations);
    }

    @Test
    void deleteOperationUsesItemId() {
        syncService = new FakeGoogleCalendarEventSyncService();
        queueService = new GoogleCalendarEventQueueService(syncService, 0);
        UUID itemId = UUID.randomUUID();

        queueService.requestDelete(itemId);
        waitForIdle();

        assertEquals(List.of("delete:" + itemId), syncService.operations);
    }

    @Test
    void failedWorkRetriesThreeAttemptsBeforeFailedStatus() {
        syncService = new FakeGoogleCalendarEventSyncService();
        queueService = new GoogleCalendarEventQueueService(syncService, 0);
        UUID itemId = UUID.randomUUID();
        syncService.failuresBeforeSuccess = 3;

        queueService.requestUpsert(itemId);
        waitForIdle();

        assertEquals(3, syncService.attempts);
        assertEquals(GoogleCalendarSyncState.FAILED, queueService.status().state());
        assertEquals("google failure 3", queueService.status().lastError());
    }

    @Test
    void successfulWorkClearsLastErrorAndRecordsSuccess() {
        syncService = new FakeGoogleCalendarEventSyncService();
        queueService = new GoogleCalendarEventQueueService(syncService, 0);
        UUID itemId = UUID.randomUUID();

        queueService.requestUpsert(itemId);
        waitForIdle();

        assertEquals(GoogleCalendarSyncState.SYNCED, queueService.status().state());
        assertFalse(queueService.status().pending());
        assertFalse(queueService.status().running());
        assertNull(queueService.status().lastError());
        assertTrue(queueService.status().lastSuccessfulSyncAt() != null);
    }

    private void waitForIdle() {
        GoogleCalendarSyncStatusDto status = queueService.status();
        for (int attempt = 0; attempt < 100; attempt += 1) {
            status = queueService.status();
            if (!status.running() && !status.pending()) return;
            sleep();
        }
        fail("queue did not become idle; last running=" + status.running() + ", pending=" + status.pending());
    }

    private void waitForRunning() {
        GoogleCalendarSyncStatusDto status = queueService.status();
        for (int attempt = 0; attempt < 100; attempt += 1) {
            status = queueService.status();
            if (status.running()) return;
            sleep();
        }
        fail("queue did not start running; last running=" + status.running() + ", pending=" + status.pending());
    }

    private void sleep() {
        try {
            Thread.sleep(20);
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException("test wait interrupted; expected queue state transition", exception);
        }
    }

    private static class FakeGoogleCalendarEventSyncService extends GoogleCalendarEventSyncService {

        private final List<String> operations = new ArrayList<>();
        private volatile boolean pause;
        private volatile int attempts;
        private volatile int failuresBeforeSuccess;

        private FakeGoogleCalendarEventSyncService() {
            super(null, null, null, null, null, null);
        }

        @Override
        public void syncCalendarEvent(UUID itemId) {
            awaitRelease();
            attempts += 1;
            failWhenRequested();
            operations.add("upsert:" + itemId);
        }

        @Override
        public void deleteCalendarEvent(UUID itemId) {
            awaitRelease();
            attempts += 1;
            failWhenRequested();
            operations.add("delete:" + itemId);
        }

        private void release() {
            pause = false;
        }

        private void awaitRelease() {
            while (pause) {
                sleepQuietly();
            }
        }

        private void failWhenRequested() {
            if (attempts <= failuresBeforeSuccess) {
                throw new IllegalStateException("google failure " + attempts);
            }
        }

        private void sleepQuietly() {
            try {
                Thread.sleep(20);
            } catch (InterruptedException exception) {
                Thread.currentThread().interrupt();
                throw new IllegalStateException("test wait interrupted; expected release", exception);
            }
        }
    }
}
