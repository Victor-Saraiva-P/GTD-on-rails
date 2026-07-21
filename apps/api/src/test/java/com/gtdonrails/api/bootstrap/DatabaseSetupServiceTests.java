package com.gtdonrails.api.bootstrap;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.nio.file.Path;

import com.gtdonrails.api.config.DataSyncProperties;
import com.gtdonrails.api.services.DataSyncService;
import com.gtdonrails.api.services.RcloneDataSyncService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

class DatabaseSetupServiceTests {

    @TempDir
    private Path tempDir;

    @Test
    void acceptsSupavisorSessionUrlWithFullTlsVerification() {
        assertTrue(service().isSupavisorSessionUrl(
            "jdbc:postgresql://aws-0-us-east-1.pooler.supabase.com:5432/postgres?sslmode=verify-full"));
    }

    @Test
    void rejectsSupavisorTransactionModeUrl() {
        assertFalse(service().isSupavisorSessionUrl(
            "jdbc:postgresql://aws-0-us-east-1.pooler.supabase.com:6543/postgres?sslmode=verify-full"));
    }

    @Test
    void rejectsRemoteUrlWithoutFullTlsVerification() {
        assertFalse(service().isSupavisorSessionUrl(
            "jdbc:postgresql://aws-0-us-east-1.pooler.supabase.com:5432/postgres?sslmode=require"));
    }

    private DatabaseSetupService service() {
        DataSyncProperties properties = new DataSyncProperties();
        DataSyncService fileSync = new DataSyncService(
            properties, new RcloneDataSyncService(properties), tempDir.toString());
        return new DatabaseSetupService(tempDir.toString(), fileSync,
            (url, username, password) -> { throw new UnsupportedOperationException(); }, "PRODUCTION");
    }
}
