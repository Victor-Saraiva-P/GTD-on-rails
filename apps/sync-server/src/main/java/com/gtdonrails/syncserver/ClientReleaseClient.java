package com.gtdonrails.syncserver;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

@Component
public class ClientReleaseClient {

    private static final String ARCHIVE_SUFFIX = "_linux-x86_64.tar.gz";
    private static final String MAIN_MANIFEST = "main-update.json";

    private final ObjectMapper mapper;
    private final HttpClient http;
    private final URI releaseUri;

    @Autowired
    public ClientReleaseClient(
        ObjectMapper mapper,
        @Value("$" + "{gtd.client.release-url}") String releaseUrl
    ) {
        this(mapper, HttpClient.newBuilder().followRedirects(HttpClient.Redirect.NORMAL).build(), releaseUrl);
    }

    public ClientReleaseClient(ObjectMapper mapper, HttpClient http, String releaseUrl) {
        this.mapper = mapper;
        this.http = http;
        this.releaseUri = URI.create(releaseUrl);
    }

    public Release release() {
        JsonNode root = readJson(fetchText(releaseUri, "fetch client release"));
        URI manifestUri = assetUrl(root, MAIN_MANIFEST);
        if (manifestUri != null) return rollingRelease(root, manifestUri);
        return versionedRelease(root);
    }

    public byte[] download(URI uri) {
        HttpRequest request = request(uri).build();
        try {
            HttpResponse<byte[]> response = http.send(request, HttpResponse.BodyHandlers.ofByteArray());
            requireSuccess(response.statusCode(), uri);
            return response.body();
        } catch (IOException exception) {
            throw failure("download release asset", exception);
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            throw failure("download release asset", exception);
        }
    }

    private Release rollingRelease(JsonNode release, URI manifestUri) {
        JsonNode manifest = readJson(fetchText(manifestUri, "fetch main update manifest"));
        String version = version(manifest.path("version").asText());
        String revision = revision(manifest.path("revision").asText());
        String archive = assetName(manifest, "clientArchiveName");
        String checksum = assetName(manifest, "clientChecksumName");
        return release(release, version, revision, archive, checksum);
    }

    private Release versionedRelease(JsonNode release) {
        String version = version(release.path("tag_name").asText());
        return release(release, version, null, archiveName(version), checksumName(version));
    }

    private Release release(
        JsonNode root,
        String version,
        String revision,
        String archive,
        String checksum
    ) {
        return new Release(
            version,
            revision,
            archive,
            checksum,
            assetUrl(root, archive),
            assetUrl(root, checksum)
        );
    }

    private String fetchText(URI uri, String action) {
        HttpRequest request = request(uri).build();
        try {
            HttpResponse<String> response = http.send(request, HttpResponse.BodyHandlers.ofString());
            requireSuccess(response.statusCode(), uri);
            return response.body();
        } catch (IOException exception) {
            throw failure(action, exception);
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            throw failure(action, exception);
        }
    }

    private HttpRequest.Builder request(URI uri) {
        return HttpRequest.newBuilder(uri)
            .header("Accept", "application/vnd.github+json")
            .header("User-Agent", "GTD-on-Rails-Client");
    }

    private JsonNode readJson(String body) {
        try {
            return mapper.readTree(body);
        } catch (IOException exception) {
            throw failure("decode client release payload", exception);
        }
    }

    private URI assetUrl(JsonNode root, String expectedName) {
        for (JsonNode asset : root.path("assets")) {
            if (expectedName.equals(asset.path("name").asText())) {
                return URI.create(asset.path("browser_download_url").asText());
            }
        }
        return null;
    }

    private String assetName(JsonNode manifest, String field) {
        String value = manifest.path(field).asText();
        if (!value.isBlank() && !value.contains("/") && !value.contains("\\")) return value;
        throw new IllegalArgumentException(
            "main update manifest field '" + field + "' is invalid; expected asset filename"
        );
    }

    private String version(String tagName) {
        String normalized = tagName.startsWith("app-v")
            ? tagName.substring(5)
            : tagName.startsWith("v") ? tagName.substring(1) : tagName;
        ClientVersion.newer(normalized, "0.0.0");
        return normalized;
    }

    private String revision(String value) {
        if (value.length() == 40 && value.chars().allMatch(this::hexCharacter)) return value.toLowerCase();
        throw new IllegalArgumentException(
            "build revision value '" + value + "' is invalid; expected 40-character Git SHA"
        );
    }

    private boolean hexCharacter(int value) {
        return Character.digit((char) value, 16) >= 0;
    }

    static String archiveName(String version) {
        return "GTD.on.Rails.Client_" + version + ARCHIVE_SUFFIX;
    }

    static String checksumName(String version) {
        return archiveName(version) + ".sha256";
    }

    private void requireSuccess(int status, URI uri) {
        if (status >= 200 && status < 300) return;
        throw new IllegalStateException("release request '" + uri + "' failed with HTTP " + status);
    }

    private IllegalStateException failure(String action, Exception exception) {
        return new IllegalStateException("Failed to " + action, exception);
    }

    public record Release(
        String version,
        String revision,
        String archiveName,
        String checksumName,
        URI archiveUrl,
        URI checksumUrl
    ) {

        public boolean installable() {
            return archiveUrl != null && checksumUrl != null;
        }
    }
}
