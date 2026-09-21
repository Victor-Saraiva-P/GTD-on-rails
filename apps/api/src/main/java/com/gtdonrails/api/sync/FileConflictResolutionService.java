package com.gtdonrails.api.sync;

import java.nio.charset.StandardCharsets;
import java.util.Optional;

import org.springframework.stereotype.Service;

@Service
public class FileConflictResolutionService {

    private final SyncFileServerGateway filesGateway;
    private final SyncServerGateway objectsGateway;
    private final SyncFileOutboxStore outbox;
    private final LocalSyncStateStore stateStore;
    private final SyncLocalFileStore localFiles;
    private final SyncFileBaseStore bases;
    private final SyncConflictSnapshotStore snapshots;
    private final MarkdownThreeWayMerger merger;

    public FileConflictResolutionService(
        SyncFileServerGateway filesGateway,
        SyncServerGateway objectsGateway,
        SyncFileOutboxStore outbox,
        LocalSyncStateStore stateStore,
        SyncLocalFileStore localFiles,
        SyncFileBaseStore bases,
        SyncConflictSnapshotStore snapshots,
        MarkdownThreeWayMerger merger
    ) {
        this.filesGateway = filesGateway;
        this.objectsGateway = objectsGateway;
        this.outbox = outbox;
        this.stateStore = stateStore;
        this.localFiles = localFiles;
        this.bases = bases;
        this.snapshots = snapshots;
        this.merger = merger;
    }

    public Resolution resolvePushConflict(
        SyncFileOutboxEntry entry,
        SyncServerConflictException conflict
    ) {
        SyncServerGateway.SyncRemoteObject object = objectsGateway.object(entry.objectType(), entry.objectId());
        return resolveAgainstCurrent(entry, object, conflict.currentRevision(), remoteCursor());
    }

    public Resolution resolvePullConflict(SyncRemoteChange change) {
        Optional<SyncFileOutboxEntry> active = outbox.activeFor(change.objectType(), change.objectId());
        if (active.isEmpty()) return Resolution.pending();
        SyncServerGateway.SyncRemoteObject object = objectsGateway.object(change.objectType(), change.objectId());
        return resolveAgainstCurrent(active.get(), object, change.revision(), change.cursor());
    }


    public SyncConflictDetail detail(LocalSyncStateStore.SyncConflictRecord conflict) {
        boolean markdown = "body_document".equals(conflict.objectType());
        if (!markdown) return detailWithoutContent(conflict);
        SyncConflictSnapshotStore.ConflictFiles files = snapshots.read(
            conflict.objectType(), conflict.objectId(), conflict.remoteRevision()
        );
        return new SyncConflictDetail(
            conflict.id(), conflict.objectType(), conflict.objectId(), conflict.remoteRevision(),
            conflict.createdAt(), true, files.base().map(this::text).orElse(null),
            text(files.local()), text(files.remote())
        );
    }

    private SyncConflictDetail detailWithoutContent(LocalSyncStateStore.SyncConflictRecord conflict) {
        return new SyncConflictDetail(
            conflict.id(), conflict.objectType(), conflict.objectId(), conflict.remoteRevision(),
            conflict.createdAt(), false, null, null, null
        );
    }

    public void resolvePendingConflict(
        LocalSyncStateStore.SyncConflictRecord conflict,
        SyncConflictChoice choice,
        String mergedContent
    ) {
        SyncServerGateway.SyncRemoteObject remote = currentRemote(conflict);
        SyncFileOutboxEntry entry = activeEntry(conflict);
        SyncConflictSnapshotStore.ConflictFiles files = snapshots.read(
            conflict.objectType(), conflict.objectId(), conflict.remoteRevision()
        );
        applyChoice(conflict, entry, remote, files, choice, mergedContent);
        finishConflict(conflict);
    }

    private Resolution resolveAgainstCurrent(
        SyncFileOutboxEntry entry,
        SyncServerGateway.SyncRemoteObject remote,
        long expectedRevision,
        long remoteCursor
    ) {
        requireRevision(remote, expectedRevision);
        byte[] local = localContent(entry);
        Optional<byte[]> base = baseContent(entry);
        if (remote.deleted()) {
            preserveConflict(entry, remote, base, local, new byte[0], remoteCursor);
            return Resolution.pending();
        }
        SyncFileServerGateway.RemoteFileContent remoteFile = filesGateway.read(
            entry.objectType(), entry.objectId()
        );
        return resolveContent(entry, remoteFile, base, local, remoteCursor);
    }

    private Resolution resolveContent(
        SyncFileOutboxEntry entry,
        SyncFileServerGateway.RemoteFileContent remote,
        Optional<byte[]> base,
        byte[] local,
        long remoteCursor
    ) {
        if (!canAutoMerge(entry, base)) {
            preserveConflict(entry, remote, base, local, remoteCursor);
            return Resolution.pending();
        }
        MarkdownThreeWayMerger.MergeResult result = merger.merge(
            text(base.orElseThrow()), text(local), text(remote.content())
        );
        if (!result.clean()) {
            preserveConflict(entry, remote, base, local, remoteCursor);
            return Resolution.pending();
        }
        applyAutomaticMerge(entry, remote, result.merged());
        return Resolution.merged();
    }

    private boolean canAutoMerge(SyncFileOutboxEntry entry, Optional<byte[]> base) {
        return "body_document".equals(entry.objectType())
            && !"DELETE".equals(entry.operation())
            && base.isPresent();
    }

    private void applyAutomaticMerge(
        SyncFileOutboxEntry entry,
        SyncFileServerGateway.RemoteFileContent remote,
        String merged
    ) {
        byte[] content = merged.getBytes(StandardCharsets.UTF_8);
        localFiles.write(entry.relativePath(), content);
        supersede(entry, "superseded by automatic three-way merge");
        stateStore.updateRevision(entry.objectType(), entry.objectId(), remote.revision());
        bases.save(entry.objectType(), entry.objectId(), remote.revision(), remote.content());
        outbox.enqueueUpsert(entry.objectType(), entry.objectId(), entry.relativePath(), entry.contentType());
    }

    private void applyChoice(
        LocalSyncStateStore.SyncConflictRecord conflict,
        SyncFileOutboxEntry entry,
        SyncServerGateway.SyncRemoteObject remote,
        SyncConflictSnapshotStore.ConflictFiles files,
        SyncConflictChoice choice,
        String mergedContent
    ) {
        switch (choice) {
            case REMOTE -> acceptRemote(conflict, entry, remote, files.remote());
            case LOCAL -> rebaseLocal(conflict, entry, remote, files.local());
            case MERGED -> rebaseMerged(conflict, entry, remote, mergedContent);
        }
    }

    private void acceptRemote(
        LocalSyncStateStore.SyncConflictRecord conflict,
        SyncFileOutboxEntry entry,
        SyncServerGateway.SyncRemoteObject remote,
        byte[] remoteContent
    ) {
        supersede(entry, "resolved using remote version");
        stateStore.updateRevision(conflict.objectType(), conflict.objectId(), remote.revision());
        if (remote.deleted()) {
            localFiles.delete(entry.relativePath());
            bases.delete(conflict.objectType(), conflict.objectId());
            return;
        }
        localFiles.write(remote.payload(), remoteContent);
        bases.save(conflict.objectType(), conflict.objectId(), remote.revision(), remoteContent);
    }

    private void rebaseLocal(
        LocalSyncStateStore.SyncConflictRecord conflict,
        SyncFileOutboxEntry entry,
        SyncServerGateway.SyncRemoteObject remote,
        byte[] localContent
    ) {
        prepareLocalRebase(conflict, entry, remote);
        if ("DELETE".equals(entry.operation())) {
            outbox.enqueueDelete(entry.objectType(), entry.objectId(), entry.relativePath(), entry.contentType());
            return;
        }
        localFiles.write(entry.relativePath(), localContent);
        outbox.enqueueUpsert(entry.objectType(), entry.objectId(), entry.relativePath(), entry.contentType());
    }

    private void rebaseMerged(
        LocalSyncStateStore.SyncConflictRecord conflict,
        SyncFileOutboxEntry entry,
        SyncServerGateway.SyncRemoteObject remote,
        String mergedContent
    ) {
        if (!"body_document".equals(entry.objectType()) || mergedContent == null) {
            throw new IllegalArgumentException(
                "merged conflict resolution is invalid; expected Markdown body conflict with merged content"
            );
        }
        prepareLocalRebase(conflict, entry, remote);
        localFiles.write(entry.relativePath(), mergedContent.getBytes(StandardCharsets.UTF_8));
        outbox.enqueueUpsert(entry.objectType(), entry.objectId(), entry.relativePath(), entry.contentType());
    }

    private void prepareLocalRebase(
        LocalSyncStateStore.SyncConflictRecord conflict,
        SyncFileOutboxEntry entry,
        SyncServerGateway.SyncRemoteObject remote
    ) {
        supersede(entry, "superseded by manual conflict resolution");
        stateStore.updateRevision(conflict.objectType(), conflict.objectId(), remote.revision());
        if (remote.deleted()) {
            bases.delete(conflict.objectType(), conflict.objectId());
            return;
        }
        byte[] remoteContent = snapshots.read(
            conflict.objectType(), conflict.objectId(), conflict.remoteRevision()
        ).remote();
        bases.save(conflict.objectType(), conflict.objectId(), remote.revision(), remoteContent);
    }

    private void finishConflict(LocalSyncStateStore.SyncConflictRecord conflict) {
        stateStore.markConflictResolved(conflict.id());
        snapshots.delete(conflict.objectType(), conflict.objectId(), conflict.remoteRevision());
    }

    private SyncServerGateway.SyncRemoteObject currentRemote(
        LocalSyncStateStore.SyncConflictRecord conflict
    ) {
        SyncServerGateway.SyncRemoteObject remote = objectsGateway.object(
            conflict.objectType(), conflict.objectId()
        );
        requireRevision(remote, conflict.remoteRevision());
        return remote;
    }

    private SyncFileOutboxEntry activeEntry(LocalSyncStateStore.SyncConflictRecord conflict) {
        return outbox.activeFor(conflict.objectType(), conflict.objectId())
            .orElseThrow(() -> new IllegalStateException(
                "sync conflict '" + conflict.id() + "' has no local file mutation to resolve"
            ));
    }

    private void requireRevision(SyncServerGateway.SyncRemoteObject remote, long expected) {
        if (remote.revision() == expected) return;
        throw new IllegalStateException(
            "sync conflict revision '" + expected + "' is stale; server is now at revision '"
                + remote.revision() + "'"
        );
    }

    private byte[] localContent(SyncFileOutboxEntry entry) {
        return "DELETE".equals(entry.operation()) ? new byte[0] : localFiles.read(entry.relativePath());
    }

    private Optional<byte[]> baseContent(SyncFileOutboxEntry entry) {
        long revision = stateStore.revision(entry.objectType(), entry.objectId());
        return bases.read(entry.objectType(), entry.objectId(), revision)
            .map(SyncFileBaseStore.BaseSnapshot::content);
    }

    private long remoteCursor() {
        return objectsGateway.state().cursor();
    }

    private void supersede(SyncFileOutboxEntry entry, String reason) {
        outbox.supersedeObject(entry.objectType(), entry.objectId(), reason);
    }

    private void preserveConflict(
        SyncFileOutboxEntry entry,
        SyncServerGateway.SyncRemoteObject remote,
        Optional<byte[]> base,
        byte[] local,
        byte[] remoteContent,
        long remoteCursor
    ) {
        snapshots.save(entry.objectType(), entry.objectId(), remote.revision(), base, local, remoteContent);
        stateStore.recordConflict(
            remoteChange(entry, remote, remoteCursor),
            entry.operationId().toString()
        );
    }

    private void preserveConflict(
        SyncFileOutboxEntry entry,
        SyncFileServerGateway.RemoteFileContent remote,
        Optional<byte[]> base,
        byte[] local,
        long remoteCursor
    ) {
        snapshots.save(entry.objectType(), entry.objectId(), remote.revision(), base, local, remote.content());
        SyncRemoteChange change = new SyncRemoteChange(
            remoteCursor, entry.objectType(), entry.objectId(), remote.revision(),
            "UPSERT", remote.relativePath(), remote.sha256(),
            (long) remote.content().length, remote.mediaType()
        );
        stateStore.recordConflict(change, entry.operationId().toString());
    }

    private SyncRemoteChange remoteChange(
        SyncFileOutboxEntry entry,
        SyncServerGateway.SyncRemoteObject remote,
        long cursor
    ) {
        return new SyncRemoteChange(
            cursor, entry.objectType(), entry.objectId(), remote.revision(),
            remote.deleted() ? "DELETE" : "UPSERT", remote.payload(),
            remote.sha256(), remote.byteLength(), remote.mediaType()
        );
    }

    private String text(byte[] value) {
        return new String(value, StandardCharsets.UTF_8);
    }

    public record Resolution(boolean mergedAutomatically, boolean pendingConflict) {

        static Resolution merged() {
            return new Resolution(true, false);
        }

        static Resolution pending() {
            return new Resolution(false, true);
        }
    }
}
