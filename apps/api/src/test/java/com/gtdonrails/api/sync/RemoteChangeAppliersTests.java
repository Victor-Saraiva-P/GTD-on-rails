package com.gtdonrails.api.sync;

import static org.junit.jupiter.api.Assertions.assertArrayEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.nio.file.Files;
import java.nio.file.Path;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.io.TempDir;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.jdbc.core.JdbcTemplate;

@Tag("unit")
@ExtendWith(MockitoExtension.class)
class RemoteChangeAppliersTests {

    @TempDir
    private Path tempDir;

    @Mock
    private SyncFileServerGateway fileGateway;
    @Mock
    private SyncFileBaseStore baseStore;
    @Mock
    private JdbcTemplate jdbc;

    @Test
    void remoteFileApplierWritesCanonicalContentAndBaseSnapshot() throws Exception {
        byte[] content = "remote body".getBytes();
        SyncRemoteChange change = fileChange("body_document", "UPSERT", "items/item-1/body.md");
        when(fileGateway.read("body_document", "item-1"))
            .thenReturn(new SyncFileServerGateway.RemoteFileContent(
                content, "items/item-1/body.md", "sha", "text/markdown", 4L
            ));
        RemoteFileChangeApplier applier = fileApplier();

        applier.apply(change);

        assertArrayEquals(content, Files.readAllBytes(tempDir.resolve("items/item-1/body.md")));
        verify(baseStore).save("body_document", "item-1", 4L, content);
    }

    @Test
    void remoteFileApplierDeletesFileAndBaseSnapshot() throws Exception {
        Path file = tempDir.resolve("items/item-1/body.md");
        Files.createDirectories(file.getParent());
        Files.writeString(file, "old");
        RemoteFileChangeApplier applier = fileApplier();

        applier.apply(fileChange("body_document", "DELETE", "items/item-1/body.md"));

        assertFalse(Files.exists(file));
        verify(baseStore).delete("body_document", "item-1");
    }

    @Test
    void remoteFileApplierRejectsTraversalAndReportsSupportedTypes() {
        RemoteFileChangeApplier applier = fileApplier();

        assertTrue(applier.supports("body_document"));
        assertTrue(applier.supports("item_asset_file"));
        assertTrue(applier.supports("context_icon_file"));
        assertFalse(applier.supports("items"));
        assertThrows(
            IllegalArgumentException.class,
            () -> applier.apply(fileChange("body_document", "DELETE", "../outside.md"))
        );
        assertThrows(
            IllegalArgumentException.class,
            () -> applier.apply(fileChange("body_document", "DELETE", ""))
        );
    }

    @Test
    void structuredApplierUpsertsAllowedPayloadAndConvertsJdbcValues() {
        RemoteStructuredChangeApplier applier = structuredApplier();

        applier.apply(new SyncRemoteChange(
            1L,
            "items",
            "item-1",
            2L,
            "UPSERT",
            """
            {
              "id":"item-1",
              "title":true,
              "status":2,
              "created_at":1.5,
              "updated_at":null,
              "ignored":"not persisted"
            }
            """,
            null,
            null,
            null
        ));
    }

    @Test
    void structuredApplierSynchronizesNextActionContexts() {
        RemoteStructuredChangeApplier applier = structuredApplier();

        applier.apply(new SyncRemoteChange(
            1L,
            "next_actions",
            "item-1",
            2L,
            "UPSERT",
            """
            {
              "item_id":"item-1",
              "energy":"HIGH",
              "context_ids":["context-1","context-2"]
            }
            """,
            null,
            null,
            null
        ));
    }

    @Test
    void structuredApplierDeletesNextActionAndItsRelations() {
        structuredApplier().apply(new SyncRemoteChange(
            1L, "next_actions", "item-1", 2L, "DELETE", null, null, null, null
        ));
    }

    @Test
    void structuredApplierIgnoresPayloadWithoutAllowedColumns() {
        structuredApplier().apply(new SyncRemoteChange(
            1L, "items", "item-1", 2L, "UPSERT", "{\"unknown\":\"value\"}", null, null, null
        ));
    }

    @Test
    void structuredApplierNormalizesTimestampsLackingFractionalSeconds() {
        RemoteStructuredChangeApplier applier = structuredApplier();

        applier.apply(new SyncRemoteChange(
            1L,
            "items",
            "item-1",
            2L,
            "UPSERT",
            """
            {
              "id":"item-1",
              "title":"title",
              "status":"STUFF",
              "created_at":"2026-06-23 00:31:00+00",
              "updated_at":"2026-06-23 00:31:00"
            }
            """,
            null,
            null,
            null
        ));

        verify(jdbc).update(
            org.mockito.ArgumentMatchers.contains("insert into items"),
            org.mockito.ArgumentMatchers.eq("item-1"),
            org.mockito.ArgumentMatchers.eq("title"),
            org.mockito.ArgumentMatchers.eq("STUFF"),
            org.mockito.ArgumentMatchers.eq("2026-06-23 00:31:00.000000+00"),
            org.mockito.ArgumentMatchers.eq("2026-06-23 00:31:00.000000")
        );
    }

    @Test
    void structuredApplierRejectsUnsupportedTableAndMalformedJson() {
        RemoteStructuredChangeApplier applier = structuredApplier();

        assertThrows(
            IllegalArgumentException.class,
            () -> applier.apply(new SyncRemoteChange(
                1L, "unknown", "item-1", 2L, "UPSERT", "{}", null, null, null
            ))
        );
        assertThrows(
            IllegalStateException.class,
            () -> applier.apply(new SyncRemoteChange(
                1L, "items", "item-1", 2L, "UPSERT", "{", null, null, null
            ))
        );
    }

    private RemoteFileChangeApplier fileApplier() {
        return new RemoteFileChangeApplier(fileGateway, baseStore, tempDir.toString());
    }

    private RemoteStructuredChangeApplier structuredApplier() {
        return new RemoteStructuredChangeApplier(jdbc, new ObjectMapper());
    }

    private SyncRemoteChange fileChange(String type, String operation, String path) {
        return new SyncRemoteChange(1L, type, "item-1", 3L, operation, path, null, null, null);
    }
}
