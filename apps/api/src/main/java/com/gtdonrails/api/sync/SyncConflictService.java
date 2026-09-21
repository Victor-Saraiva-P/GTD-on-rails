package com.gtdonrails.api.sync;

import java.util.List;
import java.util.Set;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class SyncConflictService {

    private static final Set<String> FILE_TYPES = Set.of(
        "body_document",
        "item_asset_file",
        "context_icon_file"
    );

    private final LocalSyncStateStore stateStore;
    private final FileConflictResolutionService fileConflicts;
    private final StructuredConflictResolutionService structuredConflicts;

    public SyncConflictService(
        LocalSyncStateStore stateStore,
        FileConflictResolutionService fileConflicts,
        StructuredConflictResolutionService structuredConflicts
    ) {
        this.stateStore = stateStore;
        this.fileConflicts = fileConflicts;
        this.structuredConflicts = structuredConflicts;
    }

    public List<LocalSyncStateStore.SyncConflictRecord> pending() {
        return stateStore.pendingConflicts();
    }


    public SyncConflictDetail detail(long conflictId) {
        LocalSyncStateStore.SyncConflictRecord conflict = pendingConflict(conflictId);
        return FILE_TYPES.contains(conflict.objectType())
            ? fileConflicts.detail(conflict)
            : structuredConflicts.detail(conflict);
    }

    @Transactional
    public void resolve(long conflictId, SyncConflictChoice choice, String mergedContent) {
        LocalSyncStateStore.SyncConflictRecord conflict = pendingConflict(conflictId);
        if (FILE_TYPES.contains(conflict.objectType())) {
            fileConflicts.resolvePendingConflict(conflict, choice, mergedContent);
            return;
        }
        structuredConflicts.resolve(conflict, choice);
    }
    private LocalSyncStateStore.SyncConflictRecord pendingConflict(long conflictId) {
        return stateStore.pendingConflict(conflictId)
            .orElseThrow(() -> new IllegalArgumentException(
                "sync conflict id '" + conflictId + "' is invalid; expected pending conflict"
            ));
    }

}
