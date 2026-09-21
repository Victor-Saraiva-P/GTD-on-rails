package com.gtdonrails.syncserver;

import java.util.List;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/v1/admin")
public class SyncServerAdminController {

    private final SyncServerAdminService admin;

    public SyncServerAdminController(SyncServerAdminService admin) {
        this.admin = admin;
    }

    @GetMapping("/overview")
    public SyncServerAdminService.Overview overview() {
        return admin.overview();
    }

    @GetMapping("/objects")
    public List<SyncServerAdminService.AdminObject> objects(
        @RequestParam(required = false) String type,
        @RequestParam(defaultValue = "false") boolean includeDeleted,
        @RequestParam(defaultValue = "100") int limit
    ) {
        return admin.objects(type, includeDeleted, limit);
    }

    @GetMapping("/changes")
    public List<SyncServerAdminService.AdminChange> changes(
        @RequestParam(defaultValue = "100") int limit
    ) {
        return admin.recentChanges(limit);
    }

    @GetMapping("/files")
    public List<SyncServerAdminService.AdminFile> files(
        @RequestParam(defaultValue = "200") int limit
    ) {
        return admin.files(limit);
    }

    @GetMapping("/backups")
    public List<SyncServerAdminService.BackupInfo> backups() {
        return admin.backups();
    }

    @DeleteMapping("/backups/{fileName}")
    public ResponseEntity<Void> deleteBackup(@PathVariable String fileName) {
        admin.deleteBackup(fileName);
        return ResponseEntity.noContent().build();
    }
}
