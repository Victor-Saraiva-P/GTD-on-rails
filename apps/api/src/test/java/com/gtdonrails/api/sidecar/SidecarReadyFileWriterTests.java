package com.gtdonrails.api.sidecar;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

class SidecarReadyFileWriterTests {

    @TempDir
    Path temporaryDirectory;

    @Test
    void writeCreatesReadyJson() throws Exception {
        Path readyFile = temporaryDirectory.resolve("backend-ready.json");
        writer().write(readyFile, 43127);

        String json = Files.readString(readyFile);
        assertThat(json).contains("\"host\":\"127.0.0.1\"");
        assertThat(json).contains("\"port\":43127");
        assertThat(json).contains("\"baseUrl\":\"http://127.0.0.1:43127\"");
        assertThat(json).contains("\"startedAt\":\"2026-05-15T12:00:00Z\"");
        assertThat(Files.exists(readyFile.resolveSibling("backend-ready.json.tmp"))).isFalse();
    }

    @Test
    void writeRejectsInvalidPort() {
        Path readyFile = temporaryDirectory.resolve("backend-ready.json");

        assertThatThrownBy(() -> writer().write(readyFile, 0))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessage("sidecar port value '0' is invalid; expected 1..65535");
    }

    private SidecarReadyFileWriter writer() {
        Clock clock = Clock.fixed(Instant.parse("2026-05-15T12:00:00Z"), ZoneOffset.UTC);
        return new SidecarReadyFileWriter(clock);
    }
}
