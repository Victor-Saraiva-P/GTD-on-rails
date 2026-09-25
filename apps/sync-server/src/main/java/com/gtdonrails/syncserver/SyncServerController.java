package com.gtdonrails.syncserver;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/v1")
public class SyncServerController {

    private final SyncObjectStore store;
    private final GoogleCalendarProjectionQueue googleCalendarQueue;

    public SyncServerController(
        SyncObjectStore store,
        GoogleCalendarProjectionQueue googleCalendarQueue
    ) {
        this.store = store;
        this.googleCalendarQueue = googleCalendarQueue;
    }

    @PostMapping("/mutations")
    public SyncMutationResult mutate(@RequestBody SyncMutation mutation) {
        SyncMutationResult result = store.apply(mutation);
        requestGoogleProjection(mutation);
        return result;
    }

    private void requestGoogleProjection(SyncMutation mutation) {
        if (!isGoogleProjectionType(mutation.objectType())) return;
        googleCalendarQueue.wake();
    }

    private boolean isGoogleProjectionType(String objectType) {
        return "items".equals(objectType)
            || "next_actions".equals(objectType)
            || "calendars".equals(objectType)
            || "projects".equals(objectType);
    }

    @GetMapping("/changes")
    public SyncChangeFeed changes(
        @RequestParam(defaultValue = "0") long after,
        @RequestParam(defaultValue = "100") int limit
    ) {
        return store.changesAfter(after, limit);
    }

    @GetMapping("/objects/{objectType}/{objectId}")
    public SyncObjectSnapshot object(
        @PathVariable String objectType,
        @PathVariable String objectId
    ) {
        return store.object(objectType, objectId)
            .orElseThrow(() -> new SyncObjectNotFoundException(objectType, objectId));
    }

    @GetMapping("/state")
    public SyncServerState state() {
        return new SyncServerState(store.datasetEpoch(), store.currentCursor());
    }

    @ExceptionHandler(SyncConflictException.class)
    @ResponseStatus(HttpStatus.CONFLICT)
    public SyncConflictResponse conflict(SyncConflictException exception) {
        return new SyncConflictResponse(exception.getMessage(), exception.currentRevision());
    }

    @ExceptionHandler(SyncObjectNotFoundException.class)
    @ResponseStatus(HttpStatus.NOT_FOUND)
    public String notFound(SyncObjectNotFoundException exception) {
        return exception.getMessage();
    }

    public record SyncConflictResponse(String message, long currentRevision) {
    }
}
