package com.gtdonrails.syncserver;

import static org.junit.jupiter.api.Assertions.assertArrayEquals;
import static org.junit.jupiter.api.Assertions.assertEquals;

import java.io.IOException;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.net.URI;
import java.nio.charset.StandardCharsets;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class ClientReleaseClientTests {

    private HttpServer server;
    private String serverUrl;

    @BeforeEach
    void setUp() throws IOException {
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/redirect", this::handleRedirect);
        server.createContext("/final-asset", this::handleFinalAsset);
        server.createContext("/release.json", this::handleReleaseJson);
        server.start();
        serverUrl = "http://127.0.0.1:" + server.getAddress().getPort();
    }

    @AfterEach
    void tearDown() {
        if (server != null) {
            server.stop(0);
        }
    }

    @Test
    void downloadFollowsHttpRedirects() {
        ClientReleaseClient client = new ClientReleaseClient(
            new ObjectMapper(),
            serverUrl + "/release.json"
        );
        byte[] downloaded = client.download(URI.create(serverUrl + "/redirect"));
        assertArrayEquals("final-content".getBytes(StandardCharsets.UTF_8), downloaded);
    }

    @Test
    void releaseParsesAssetsAndVersion() {
        ClientReleaseClient client = new ClientReleaseClient(
            new ObjectMapper(),
            serverUrl + "/release.json"
        );
        ClientReleaseClient.Release release = client.release();
        assertEquals("3.0.3", release.version());
        assertEquals(URI.create(serverUrl + "/redirect"), release.archiveUrl());
    }

    private void handleRedirect(HttpExchange exchange) throws IOException {
        exchange.getResponseHeaders().set("Location", serverUrl + "/final-asset");
        exchange.sendResponseHeaders(302, -1);
        exchange.close();
    }

    private void handleFinalAsset(HttpExchange exchange) throws IOException {
        byte[] bytes = "final-content".getBytes(StandardCharsets.UTF_8);
        exchange.sendResponseHeaders(200, bytes.length);
        try (OutputStream outputStream = exchange.getResponseBody()) {
            outputStream.write(bytes);
        }
    }

    private void handleReleaseJson(HttpExchange exchange) throws IOException {
        String json = """
            {
              "tag_name": "v3.0.3",
              "assets": [
                {
                  "name": "GTD.on.Rails.Client_3.0.3_linux-x86_64.tar.gz",
                  "browser_download_url": "%s/redirect"
                },
                {
                  "name": "GTD.on.Rails.Client_3.0.3_linux-x86_64.tar.gz.sha256",
                  "browser_download_url": "%s/final-asset"
                }
              ]
            }
            """.formatted(serverUrl, serverUrl);
        byte[] bytes = json.getBytes(StandardCharsets.UTF_8);
        exchange.getResponseHeaders().set("Content-Type", "application/json");
        exchange.sendResponseHeaders(200, bytes.length);
        try (OutputStream outputStream = exchange.getResponseBody()) {
            outputStream.write(bytes);
        }
    }
}
