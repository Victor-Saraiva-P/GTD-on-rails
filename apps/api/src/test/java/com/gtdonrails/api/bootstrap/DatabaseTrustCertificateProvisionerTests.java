package com.gtdonrails.api.bootstrap;

import static org.junit.jupiter.api.Assertions.assertArrayEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

class DatabaseTrustCertificateProvisionerTests {

    @TempDir
    private Path tempDir;

    @Test
    void readsEmbeddedCertificateFromClasspath() {
        DatabaseTrustCertificateProvisioner provisioner = new DatabaseTrustCertificateProvisioner();
        byte[] certBytes = provisioner.readEmbeddedCertificate();

        assertTrue(certBytes.length > 0);
        String certText = new String(certBytes, StandardCharsets.UTF_8);
        assertTrue(certText.contains("-----BEGIN CERTIFICATE-----"));
        assertTrue(certText.contains("-----END CERTIFICATE-----"));
    }

    @Test
    void ensureCertificateWritesRootCertificateToDataDirectory() throws IOException {
        DatabaseTrustCertificateProvisioner provisioner = new DatabaseTrustCertificateProvisioner();
        Path localCert = provisioner.ensureCertificate(tempDir);

        assertTrue(Files.isRegularFile(localCert));
        assertArrayEquals(provisioner.readEmbeddedCertificate(), Files.readAllBytes(localCert));
    }

    @Test
    void ensureCertificatePreservesExistingUpToDateCertificate() throws IOException {
        DatabaseTrustCertificateProvisioner provisioner = new DatabaseTrustCertificateProvisioner();
        byte[] original = provisioner.readEmbeddedCertificate();
        Path targetCert = tempDir.resolve("root.crt");
        Files.write(targetCert, original);

        Path resultCert = provisioner.ensureCertificate(tempDir);

        assertTrue(Files.isRegularFile(resultCert));
        assertArrayEquals(original, Files.readAllBytes(resultCert));
    }
}
