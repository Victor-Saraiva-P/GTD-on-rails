package com.gtdonrails.api.sync;

import java.io.IOException;
import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;

import com.gtdonrails.api.dtos.sync.DatabaseSyncStatusDto;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

@Component
public class DomainChangeEventHub {

    private final List<SseEmitter> emitters = new CopyOnWriteArrayList<>();

    public SseEmitter subscribe() {
        SseEmitter emitter = new SseEmitter(0L);
        emitters.add(emitter);
        emitter.onCompletion(() -> emitters.remove(emitter));
        emitter.onTimeout(() -> emitters.remove(emitter));
        emitter.onError(ignored -> emitters.remove(emitter));
        try {
            emitter.send(SseEmitter.event().comment("connected"));
        } catch (IOException exception) {
            emitter.completeWithError(exception);
            emitters.remove(emitter);
        }
        return emitter;
    }

    public void publish(SyncRemoteChange change) {
        DomainChangeEvent event = new DomainChangeEvent(
            change.cursor(),
            change.objectType(),
            change.objectId(),
            change.operation(),
            change.revision()
        );
        for (SseEmitter emitter : emitters) {
            send(emitter, event);
        }
    }

    public void publishDatabaseSyncStatus(DatabaseSyncStatusDto status) {
        for (SseEmitter emitter : emitters) {
            try {
                emitter.send(SseEmitter.event().name("database-sync-status").data(status));
            } catch (IOException exception) {
                emitter.complete();
                emitters.remove(emitter);
            }
        }
    }

    private void send(SseEmitter emitter, DomainChangeEvent event) {
        try {
            emitter.send(SseEmitter.event().name("domain-change").data(event));
        } catch (IOException exception) {
            emitter.complete();
            emitters.remove(emitter);
        }
    }

    public record DomainChangeEvent(
        long cursor,
        String objectType,
        String objectId,
        String operation,
        long revision
    ) {}
}
