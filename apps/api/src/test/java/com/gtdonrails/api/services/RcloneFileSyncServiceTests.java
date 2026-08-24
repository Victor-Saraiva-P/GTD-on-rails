package com.gtdonrails.api.services;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;

import com.gtdonrails.api.config.FileSyncProperties;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;

@Tag("unit")
class RcloneFileSyncServiceTests {

    @Test
    void runsNormalBisyncWithScriptAlignedFlags() {
        RecordingRcloneFileSyncService service = newService();

        service.bisync(Path.of("/home/victor/Documents/gtd-on-rails"));

        assertStartsWithRemoteThenLocal(service.command());
        assertContainsCommonScriptFlags(service.command());
        assertContainsFinalScriptFlags(service.command());
        assertContainsCheckAccess(service.command());
    }

    @Test
    void runsBootstrapBisyncWithoutCheckAccess() {
        RecordingRcloneFileSyncService service = newService();

        service.bootstrapBisync(Path.of("/home/victor/Documents/gtd-on-rails"));

        assertEquals(List.of("rclone", "mkdir", "gdrive:gtd-on-rails"), service.commands().get(0));
        assertStartsWithRemoteThenLocal(service.command());
        assertContainsCommonScriptFlags(service.command());
        assertTrue(service.command().contains("--resync"));
        assertFalse(service.command().contains("--resilient"));
        assertFalse(service.command().contains("--check-access"));
    }

    @Test
    void publishesBootstrapSyncCheckWithoutCheckAccess() {
        RecordingRcloneFileSyncService service = newService();

        service.publishBootstrapSyncCheck(Path.of("/home/victor/Documents/gtd-on-rails"));

        assertStartsWithRemoteThenLocal(service.command());
        assertContainsCommonScriptFlags(service.command());
        assertContainsFinalScriptFlags(service.command());
        assertFalse(service.command().contains("--check-access"));
    }

    @Test
    void rejectsBlankRemoteWithOffendingValue() {
        FileSyncProperties properties = properties();
        properties.getRclone().setRemote("  ");
        RecordingRcloneFileSyncService service = new RecordingRcloneFileSyncService(properties);

        org.junit.jupiter.api.Assertions.assertThrows(
            IllegalStateException.class,
            () -> service.bisync(Path.of("/home/victor/Documents/gtd-on-rails")));
    }

    private RecordingRcloneFileSyncService newService() {
        return new RecordingRcloneFileSyncService(properties());
    }

    private FileSyncProperties properties() {
        FileSyncProperties properties = new FileSyncProperties();
        properties.getRclone().setEnabled(true);
        properties.getRclone().setRemote("gdrive:gtd-on-rails");
        properties.setSyncCheckFilename("gtd-on-rails-sync-check");
        return properties;
    }

    private void assertStartsWithRemoteThenLocal(List<String> command) {
        assertEquals("rclone", command.get(0));
        assertEquals("bisync", command.get(1));
        assertEquals("gdrive:gtd-on-rails", command.get(2));
        assertEquals("/home/victor/Documents/gtd-on-rails", command.get(3));
    }

    private void assertContainsCommonScriptFlags(List<String> command) {
        assertTrue(command.contains("--force"));
        assertTrue(command.contains("size,modtime,checksum"));
        assertTrue(command.contains("--modify-window"));
        assertTrue(command.contains("--drive-acknowledge-abuse"));
        assertTrue(command.contains("--drive-skip-gdocs"));
        assertTrue(command.contains("--drive-skip-shortcuts"));
        assertTrue(command.contains("--drive-skip-dangling-shortcuts"));
        assertTrue(command.contains("--metadata"));
    }

    private void assertContainsFinalScriptFlags(List<String> command) {
        assertTrue(command.contains("--track-renames"));
        assertTrue(command.contains("--fix-case"));
        assertTrue(command.contains("--resilient"));
        assertTrue(command.contains("--recover"));
        assertTrue(command.contains("--max-lock"));
    }

    private void assertContainsCheckAccess(List<String> command) {
        assertTrue(command.contains("--check-access"));
        assertTrue(command.contains("--check-filename"));
        assertTrue(command.contains("gtd-on-rails-sync-check"));
    }

    private static class RecordingRcloneFileSyncService extends RcloneFileSyncService {

        private final List<List<String>> commands = new ArrayList<>();
        private List<String> command = List.of();

        private RecordingRcloneFileSyncService(FileSyncProperties fileSyncProperties) {
            super(fileSyncProperties);
        }

        @Override
        protected void executeRcloneCommand(List<String> command) {
            this.commands.add(new ArrayList<>(command));
            this.command = new ArrayList<>(command);
        }

        private List<List<String>> commands() {
            return commands;
        }

        private List<String> command() {
            return command;
        }
    }
}
