package com.gtdonrails.api.maintenance;

import org.flywaydb.core.api.MigrationVersion;

public record FlywaySchemaRange(int minSupportedVersion, int maxSupportedVersion) {

    public FlywaySchemaRange {
        if (minSupportedVersion < 1 || maxSupportedVersion < minSupportedVersion) {
            throw new IllegalArgumentException(
                "schema range bounds [%d, %d] are invalid; expected min >= 1 and max >= min"
                    .formatted(minSupportedVersion, maxSupportedVersion)
            );
        }
    }

    /**
     * Evaluates database schema compatibility against this sidecar's supported Flyway range.
     *
     * <p>Example: {@code range.evaluate("2")}.</p>
     */
    public SchemaCompatibilityStatus evaluate(String currentVersion) {
        if (currentVersion == null) return SchemaCompatibilityStatus.UPGRADEABLE;
        MigrationVersion version = parseVersion(currentVersion);
        if (version == null) return SchemaCompatibilityStatus.UNSUPPORTED;
        return compareWithRange(version);
    }

    private MigrationVersion parseVersion(String versionString) {
        try {
            return MigrationVersion.fromVersion(versionString);
        } catch (RuntimeException exception) {
            return null;
        }
    }

    private SchemaCompatibilityStatus compareWithRange(MigrationVersion version) {
        MigrationVersion min = MigrationVersion.fromVersion(String.valueOf(minSupportedVersion));
        MigrationVersion max = MigrationVersion.fromVersion(String.valueOf(maxSupportedVersion));
        if (version.compareTo(min) < 0) return SchemaCompatibilityStatus.UNSUPPORTED;
        if (version.compareTo(max) > 0) return SchemaCompatibilityStatus.UPDATE_REQUIRED;
        if (version.compareTo(max) == 0) return SchemaCompatibilityStatus.COMPATIBLE;
        return SchemaCompatibilityStatus.UPGRADEABLE;
    }
}
