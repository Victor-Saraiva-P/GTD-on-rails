package com.gtdonrails.api.sync;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Comparator;

import com.gtdonrails.api.services.CacheInvalidationService;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;

@Service
public class SyncServerRebootstrapService {

    private final JdbcTemplate jdbc;
    private final SyncServerGateway gateway;
    private final SyncServerPullService pullService;
    private final LocalSyncStateStore stateStore;
    private final LocalRecoverySnapshotService recoverySnapshots;
    private final CacheInvalidationService cacheInvalidation;
    private final Path dataRoot;
    private final TransactionTemplate transactions;

    public SyncServerRebootstrapService(
        JdbcTemplate jdbc,
        SyncServerGateway gateway,
        SyncServerPullService pullService,
        LocalSyncStateStore stateStore,
        LocalRecoverySnapshotService recoverySnapshots,
        CacheInvalidationService cacheInvalidation,
        TransactionTemplate transactions,
        @Value("${gtd.data.root-directory}") String dataRoot
    ) {
        this.jdbc = jdbc;
        this.gateway = gateway;
        this.pullService = pullService;
        this.stateStore = stateStore;
        this.recoverySnapshots = recoverySnapshots;
        this.cacheInvalidation = cacheInvalidation;
        this.transactions = transactions;
        this.dataRoot = Path.of(dataRoot).toAbsolutePath().normalize();
    }

    public RebootstrapResult rebootstrap() {
        Path recovery = recoverySnapshots.create();
        SyncServerGateway.SyncRemoteState remote = gateway.state();
        resetLocalDataset(remote.datasetEpoch());
        pullService.pullAll();
        cacheInvalidation.evictAll();
        return new RebootstrapResult(
            recovery.getFileName().toString(),
            remote.datasetEpoch(),
            stateStore.clientState().cursor()
        );
    }

    private void resetLocalDataset(String datasetEpoch) {
        transactions.executeWithoutResult(status -> {
            deleteRelations();
            deleteDomainRows();
            deleteSyncState();
            stateStore.updateClientState(datasetEpoch, 0L);
        });
        deletePhysicalContent();
    }

    private void deleteRelations() {
        jdbc.update("delete from next_action_contexts");
        jdbc.update("delete from project_items");
    }

    private void deleteDomainRows() {
        jdbc.update("delete from calendars");
        jdbc.update("delete from next_actions");
        jdbc.update("delete from projects");
        jdbc.update("delete from item_assets");
        jdbc.update("delete from context_icon_assets");
        jdbc.update("delete from items");
        jdbc.update("delete from contexts");
    }

    private void deleteSyncState() {
        jdbc.update("delete from sync_outbox");
        jdbc.update("delete from sync_file_outbox");
        jdbc.update("delete from sync_object_revisions");
        jdbc.update("delete from sync_conflicts");
    }

    private void deletePhysicalContent() {
        deleteTree(dataRoot.resolve("items"));
        deleteTree(dataRoot.resolve("assets").resolve("contexts"));
    }

    private void deleteTree(Path root) {
        if (!Files.exists(root)) return;
        try (var stream = Files.walk(root)) {
            for (Path path : stream.sorted(Comparator.reverseOrder()).toList()) {
                Files.deleteIfExists(path);
            }
        } catch (IOException exception) {
            throw new IllegalStateException(
                "Failed to reset local sync content at '" + root + "'",
                exception
            );
        }
    }

    public record RebootstrapResult(
        String recoverySnapshot,
        String datasetEpoch,
        long cursor
    ) {
    }
}
