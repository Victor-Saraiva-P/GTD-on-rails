package com.gtdonrails.api.services;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.when;

import java.time.Instant;

import com.gtdonrails.api.config.GoogleProperties;
import com.gtdonrails.api.entities.GoogleCredential;
import com.gtdonrails.api.repositories.GoogleCalendarRepository;
import com.gtdonrails.api.repositories.GoogleCredentialRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
@Tag("unit")
class GoogleCalendarServiceTests {

    @Mock
    private GoogleProperties googleProperties;

    @Mock
    private GoogleCredentialRepository credentialRepository;

    @Mock
    private GoogleCalendarRepository calendarRepository;

    private GoogleCalendarService service;

    @BeforeEach
    void setUp() {
        service = new GoogleCalendarService(googleProperties, credentialRepository, calendarRepository);
    }

    @Test
    void buildAuthUrlUsesClientIdAndRedirectUri() {
        when(googleProperties.getClientId()).thenReturn("my-client-id");
        String url = service.buildAuthUrl("http://localhost/callback");
        assertTrue(url.contains("client_id=my-client-id"));
        assertTrue(url.contains("redirect_uri=http://localhost/callback"));
        assertTrue(url.contains("response_type=code"));
    }

    @Test
    void getValidCredentialReturnsNullWhenEmpty() {
        when(credentialRepository.findAll()).thenReturn(java.util.List.of());
        assertNull(service.getValidCredential());
    }

    @Test
    void getValidCredentialReturnsUnexpiredCredential() {
        GoogleCredential cred = new GoogleCredential();
        cred.setAccessToken("token");
        cred.setExpiresAt(Instant.now().plusSeconds(3600));
        when(credentialRepository.findAll()).thenReturn(java.util.List.of(cred));
        
        assertEquals(cred, service.getValidCredential());
    }
}
