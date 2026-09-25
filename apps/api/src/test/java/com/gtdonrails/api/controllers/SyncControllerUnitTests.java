package com.gtdonrails.api.controllers;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.Instant;
import java.util.List;

import com.gtdonrails.api.services.DatabaseSyncService;
import com.gtdonrails.api.services.FileSyncService;
import com.gtdonrails.api.services.GoogleCalendarEventQueueService;
import com.gtdonrails.api.sync.LocalSyncStateStore;
import com.gtdonrails.api.sync.SyncConflictChoice;
import com.gtdonrails.api.sync.SyncConflictDetail;
import com.gtdonrails.api.sync.SyncConflictService;
import com.gtdonrails.api.sync.SyncServerRebootstrapService;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;

@Tag("unit")
@ExtendWith(MockitoExtension.class)
class SyncControllerUnitTests {

    @Mock
    private FileSyncService fileSyncService;
    @Mock
    private GoogleCalendarEventQueueService googleCalendarEventQueueService;
    @Mock
    private DatabaseSyncService databaseSyncService;
    @Mock
    private SyncConflictService conflictService;

    @Test
    void listsPendingConflicts() {
        List<LocalSyncStateStore.SyncConflictRecord> conflicts = List.of(
            new LocalSyncStateStore.SyncConflictRecord(
                1L, "items", "item-1", "operation-1", 2L, 3L, Instant.EPOCH
            )
        );
        when(conflictService.pending()).thenReturn(conflicts);

        assertSame(conflicts, controller().conflicts());
    }

    @Test
    void returnsConflictDetail() {
        SyncConflictDetail detail = new SyncConflictDetail(
            1L, "body_document", "item-1", 2L, Instant.EPOCH, true, "base", "local", "remote"
        );
        when(conflictService.detail(1L)).thenReturn(detail);

        assertSame(detail, controller().conflict(1L));
    }

    @Test
    void resolvesConflictAndTriggersBothSyncWorkers() {
        SyncController.ResolveConflictRequest request =
            new SyncController.ResolveConflictRequest(SyncConflictChoice.MERGED, "merged");

        var response = controller().resolveConflict(7L, request);

        assertEquals(HttpStatus.NO_CONTENT, response.getStatusCode());
        verify(conflictService).resolve(7L, SyncConflictChoice.MERGED, "merged");
        verify(databaseSyncService).notifyNewEvents();
        verify(fileSyncService).requestSync();
    }

    @Test
    void rebootstrapReturnsResultAndResumesFileSync() {
        SyncServerRebootstrapService.RebootstrapResult result =
            new SyncServerRebootstrapService.RebootstrapResult("recovery.zip", "epoch-2", 42L);
        when(databaseSyncService.rebootstrap()).thenReturn(result);

        var response = controller().rebootstrap();

        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertSame(result, response.getBody());
        verify(fileSyncService).resumeAfterRebootstrap();
    }

    private SyncController controller() {
        return new SyncController(
            fileSyncService,
            googleCalendarEventQueueService,
            databaseSyncService,
            conflictService
        );
    }
}
