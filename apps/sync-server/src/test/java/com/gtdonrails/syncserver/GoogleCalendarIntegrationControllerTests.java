package com.gtdonrails.syncserver;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;
import static org.mockito.Mockito.verify;

import java.util.List;
import org.junit.jupiter.api.Test;

class GoogleCalendarIntegrationControllerTests {

    @Test
    void statusShowsTheNormalizedRedirectUriUsedByAuthorization() {
        GoogleCalendarCredentialsStore credentials = mock(GoogleCalendarCredentialsStore.class);
        GoogleCalendarMirrorStore mirrors = mock(GoogleCalendarMirrorStore.class);
        GoogleCalendarOAuthService oauth = mock(GoogleCalendarOAuthService.class);
        when(credentials.credentialsConfigured()).thenReturn(true);
        when(credentials.connected()).thenReturn(false);
        when(mirrors.calendars()).thenReturn(List.of());
        String redirectUri = "https://calendar.example.test/oauth/google/callback";
        when(oauth.buildAuthUrl(redirectUri)).thenReturn("https://accounts.google.com/authorize");

        GoogleCalendarIntegrationController controller = new GoogleCalendarIntegrationController(
            credentials, mirrors, oauth, mock(GoogleCalendarReconciliationService.class),
            mock(GoogleCalendarProjectionQueue.class), "https://calendar.example.test/"
        );

        assertEquals(redirectUri, controller.status().redirectUri());
        assertEquals("https://accounts.google.com/authorize", controller.authUrl().get("url"));
        verify(oauth).buildAuthUrl(redirectUri);
    }
}
