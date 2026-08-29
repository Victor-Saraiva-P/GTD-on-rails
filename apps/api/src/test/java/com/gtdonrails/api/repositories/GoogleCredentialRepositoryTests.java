package com.gtdonrails.api.repositories;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.sql.Timestamp;
import java.time.Instant;
import java.util.Map;

import com.gtdonrails.api.entities.GoogleCredential;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;

@SpringBootTest
@ActiveProfiles("test")
@Tag("integration")
class GoogleCredentialRepositoryTests {
    @Autowired
    private GoogleCredentialRepository credentialRepository;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @BeforeEach
    void setUp() {
        credentialRepository.deleteAll();
    }

    @Test
    void storesTokensEncryptedAndReadsThemDecrypted() {
        credentialRepository.saveAndFlush(credential("access-token", "refresh-token"));

        Map<String, Object> row = jdbcTemplate.queryForMap("select access_token, refresh_token from google_credentials");
        assertEncryptedToken(row.get("access_token"), "access-token");
        assertEncryptedToken(row.get("refresh_token"), "refresh-token");

        GoogleCredential savedCredential = credentialRepository.findAll().getFirst();
        assertEquals("access-token", savedCredential.getAccessToken());
        assertEquals("refresh-token", savedCredential.getRefreshToken());
    }

    @Test
    void readsLegacyPlaintextTokens() {
        jdbcTemplate.update(
            "insert into google_credentials (id, access_token, refresh_token, token_type, expires_at, scope) "
                + "values (?, ?, ?, ?, ?, ?)",
            java.util.UUID.randomUUID().toString(), "legacy-access", "legacy-refresh", "Bearer", Timestamp.from(Instant.now()), "calendar");

        GoogleCredential savedCredential = credentialRepository.findAll().getFirst();
        assertEquals("legacy-access", savedCredential.getAccessToken());
        assertEquals("legacy-refresh", savedCredential.getRefreshToken());
    }

    private void assertEncryptedToken(Object storedValue, String plaintextValue) {
        String tokenValue = storedValue.toString();
        assertNotEquals(plaintextValue, tokenValue);
        assertTrue(tokenValue.startsWith("gtdenc:v1:"));
    }

    private GoogleCredential credential(String accessToken, String refreshToken) {
        GoogleCredential credential = new GoogleCredential();
        credential.setAccessToken(accessToken);
        credential.setRefreshToken(refreshToken);
        credential.setTokenType("Bearer");
        credential.setExpiresAt(Instant.now().plusSeconds(3600));
        credential.setScope("calendar");
        return credential;
    }
}
