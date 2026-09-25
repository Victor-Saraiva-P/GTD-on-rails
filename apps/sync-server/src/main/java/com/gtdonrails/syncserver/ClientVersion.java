package com.gtdonrails.syncserver;

import java.util.Arrays;

final class ClientVersion {

    private ClientVersion() {
    }

    static String current() {
        String version = SyncServerApplication.class.getPackage().getImplementationVersion();
        return version == null || version.isBlank() ? "0.0.0" : version;
    }

    static boolean newer(String candidate, String current) {
        return compare(candidate, current) > 0;
    }

    private static int compare(String left, String right) {
        int[] leftParts = parts(left);
        int[] rightParts = parts(right);
        for (int index = 0; index < 3; index += 1) {
            int result = Integer.compare(leftParts[index], rightParts[index]);
            if (result != 0) return result;
        }
        return 0;
    }

    private static int[] parts(String version) {
        String normalized = normalize(version);
        int[] parts = Arrays.stream(normalized.split("\\."))
            .mapToInt(ClientVersion::parsePart)
            .toArray();
        if (parts.length == 3) return parts;
        throw invalid(version);
    }

    private static String normalize(String version) {
        if (version.startsWith("app-v")) return version.substring(5);
        if (version.startsWith("v")) return version.substring(1);
        return version;
    }

    private static int parsePart(String value) {
        if (!value.isBlank() && value.chars().allMatch(Character::isDigit)) {
            return Integer.parseInt(value);
        }
        throw invalid(value);
    }

    private static IllegalArgumentException invalid(String value) {
        return new IllegalArgumentException(
            "version value '" + value + "' is invalid; expected semantic version like 1.2.3"
        );
    }
}
