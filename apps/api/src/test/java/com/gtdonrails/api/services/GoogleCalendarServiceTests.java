package com.gtdonrails.api.services;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.verifyNoMoreInteractions;
import static org.mockito.Mockito.when;

import java.time.Instant;
import java.util.Map;

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
import org.springframework.web.client.RestTemplate;

@ExtendWith(MockitoExtension.class)
@Tag("unit")
class GoogleCalendarServiceTests {

    @Mock
    private GoogleProperties googleProperties;

    @Mock
    private GoogleCredentialRepository credentialRepository;

    @Mock
    private GoogleCalendarRepository calendarRepository;

    @Mock
    private GoogleClientCredentialsStore credentialsStore;

    @Mock
    private RestTemplate restTemplate;

    private GoogleCalendarService service;

    @BeforeEach
    void setUp() {
        service = new GoogleCalendarService(
            googleProperties,
            credentialRepository,
            calendarRepository,
            credentialsStore,
            restTemplate);
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

    @Test
    void getValidCredentialRefreshesWhenExpiresAtIsMissing() {
        GoogleCredential cred = new GoogleCredential();
        cred.setAccessToken("token");
        cred.setRefreshToken("refresh-token");
        when(credentialRepository.findAll()).thenReturn(java.util.List.of(cred));
        when(restTemplate.postForEntity(eq("https://oauth2.googleapis.com/token"), any(), eq(Map.class)))
            .thenThrow(new RuntimeException("network disabled in unit test"));

        assertEquals(cred, service.getValidCredential());

        verify(restTemplate).postForEntity(eq("https://oauth2.googleapis.com/token"), any(), eq(Map.class));
    }

    @Test
    void getValidCredentialRejectsMissingRefreshToken() {
        GoogleCredential cred = new GoogleCredential();
        cred.setAccessToken("expired-token");
        cred.setExpiresAt(Instant.now().minusSeconds(60));
        when(credentialRepository.findAll()).thenReturn(java.util.List.of(cred));

        IllegalStateException exception = assertThrows(IllegalStateException.class, service::getValidCredential);

        assertEquals("google refresh token value 'null' is invalid; expected non-blank token", exception.getMessage());
        verifyNoInteractions(restTemplate);
        verify(credentialRepository).findAll();
        verifyNoMoreInteractions(credentialRepository);
    }

    @Test
    void getValidCredentialRejectsBlankRefreshToken() {
        GoogleCredential cred = new GoogleCredential();
        cred.setAccessToken("expired-token");
        cred.setRefreshToken(" ");
        cred.setExpiresAt(Instant.now().minusSeconds(60));
        when(credentialRepository.findAll()).thenReturn(java.util.List.of(cred));

        IllegalStateException exception = assertThrows(IllegalStateException.class, service::getValidCredential);

        assertEquals("google refresh token value ' ' is invalid; expected non-blank token", exception.getMessage());
        verifyNoInteractions(restTemplate);
        verify(credentialRepository).findAll();
        verifyNoMoreInteractions(credentialRepository);
    }
}
