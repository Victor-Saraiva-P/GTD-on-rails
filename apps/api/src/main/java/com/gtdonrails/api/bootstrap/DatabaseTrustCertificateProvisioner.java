package com.gtdonrails.api.bootstrap;

import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.attribute.PosixFilePermission;
import java.util.EnumSet;

/** Provisions and synchronizes trusted database root CA certificates for remote PostgreSQL TLS connections. */
public class DatabaseTrustCertificateProvisioner {

    private static final String EMBEDDED_CERTIFICATE_RESOURCE = "certs/supabase-root.crt";
    private static final String CERTIFICATE_FILENAME = "root.crt";

    /**
     * Ensures the trusted Supabase root certificate exists in the data directory and user home PostgreSQL path.
     *
     * <p>Example: {@code provisioner.ensureCertificate(dataRoot)}.</p>
     */
    public Path ensureCertificate(Path dataRoot) {
        byte[] certificateBytes = readEmbeddedCertificate();
        Path localDataCert = dataRoot.resolve(CERTIFICATE_FILENAME);
        writeCertificateIfMissingOrChanged(localDataCert, certificateBytes);
        Path userHomeCert = Path.of(System.getProperty("user.home"), ".postgresql", CERTIFICATE_FILENAME);
        writeCertificateIfMissingOrChanged(userHomeCert, certificateBytes);
        return localDataCert;
    }

    /**
     * Ensures the trusted Supabase root certificate using data directory from environment or user home.
     *
     * <p>Example: {@code provisioner.ensureCertificate()}.</p>
     */
    public Path ensureCertificate() {
        String dataRoot = System.getenv("GTD_DATA_ROOT_DIRECTORY");
        if (dataRoot != null && !dataRoot.isBlank()) {
            return ensureCertificate(Path.of(dataRoot));
        }
        return ensureCertificate(Path.of(System.getProperty("user.home"), "Documents", "gtd-on-rails"));
    }

    /**
     * Reads the bundled public Supabase root CA certificate from application resources.
     *
     * <p>Example: {@code provisioner.readEmbeddedCertificate()}.</p>
     */
    public byte[] readEmbeddedCertificate() {
        try (InputStream stream = getClass().getClassLoader().getResourceAsStream(EMBEDDED_CERTIFICATE_RESOURCE)) {
            if (stream == null) {
                throw new IllegalStateException("certificate resource value '" + EMBEDDED_CERTIFICATE_RESOURCE + "' is invalid; expected existing classpath resource");
            }
            return stream.readAllBytes();
        } catch (IOException exception) {
            throw new IllegalStateException("failed reading certificate resource '" + EMBEDDED_CERTIFICATE_RESOURCE + "'; expected readable bytes", exception);
        }
    }

    private void writeCertificateIfMissingOrChanged(Path targetFile, byte[] certificateBytes) {
        try {
            if (isUpToDate(targetFile, certificateBytes)) return;
            Files.createDirectories(targetFile.getParent());
            Files.write(targetFile, certificateBytes);
            setRestrictedPermissionsIfPosix(targetFile);
        } catch (IOException exception) {
            throw new IllegalStateException("failed writing certificate value to '" + targetFile + "'; expected writable file", exception);
        }
    }

    private boolean isUpToDate(Path targetFile, byte[] certificateBytes) {
        try {
            return Files.isRegularFile(targetFile) && java.util.Arrays.equals(Files.readAllBytes(targetFile), certificateBytes);
        } catch (IOException ignored) {
            return false;
        }
    }

    private void setRestrictedPermissionsIfPosix(Path file) {
        try {
            Files.setPosixFilePermissions(file, EnumSet.of(PosixFilePermission.OWNER_READ, PosixFilePermission.OWNER_WRITE));
        } catch (UnsupportedOperationException | IOException ignored) {
            // WHY: Posix permissions are ignored on non-POSIX filesystems without failing execution.
        }
    }
}
