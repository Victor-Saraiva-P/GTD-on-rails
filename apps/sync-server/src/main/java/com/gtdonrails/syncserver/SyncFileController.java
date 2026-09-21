package com.gtdonrails.syncserver;

import java.util.UUID;

import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/v1/files")
public class SyncFileController {

    private final SyncFileService files;

    public SyncFileController(SyncFileService files) {
        this.files = files;
    }

    @PostMapping
    public SyncMutationResult mutate(
        @RequestHeader("X-Operation-Id") UUID operationId,
        @RequestHeader("X-Object-Type") String objectType,
        @RequestHeader("X-Object-Id") String objectId,
        @RequestHeader("X-Base-Revision") long baseRevision,
        @RequestHeader(value = "X-Sync-Operation", defaultValue = "UPSERT") String operation,
        @RequestHeader("X-Relative-Path") String relativePath,
        @RequestHeader(value = "X-Content-Sha256", required = false) String sha256,
        @RequestHeader(value = HttpHeaders.CONTENT_TYPE, required = false) String mediaType,
        @RequestBody(required = false) byte[] content
    ) {
        SyncFileMutation mutation = new SyncFileMutation(
            operationId,
            objectType,
            objectId,
            baseRevision,
            operation,
            relativePath,
            sha256,
            mediaType
        );
        return files.apply(mutation, content);
    }

    @GetMapping
    public ResponseEntity<byte[]> read(
        @RequestHeader("X-Object-Type") String objectType,
        @RequestHeader("X-Object-Id") String objectId
    ) {
        SyncFileContent file = files.read(objectType, objectId);
        return ResponseEntity.ok()
            .contentType(mediaType(file.mediaType()))
            .header("X-Revision", Long.toString(file.revision()))
            .header("X-Content-Sha256", file.sha256())
            .header("X-Relative-Path", file.relativePath())
            .body(file.content());
    }

    private MediaType mediaType(String value) {
        if (value == null || value.isBlank()) return MediaType.APPLICATION_OCTET_STREAM;
        try {
            return MediaType.parseMediaType(value);
        } catch (IllegalArgumentException exception) {
            return MediaType.APPLICATION_OCTET_STREAM;
        }
    }
}
