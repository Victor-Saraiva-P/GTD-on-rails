package com.gtdonrails.syncserver;

import java.time.Instant;
import java.util.Map;

import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.util.UriComponentsBuilder;

@Service
public class GoogleCalendarOAuthService {

    private static final String AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
    private static final String TOKEN_URL = "https://oauth2.googleapis.com/token";
    private static final String SCOPE = "https://www.googleapis.com/auth/calendar";
    private static final ParameterizedTypeReference<Map<String, Object>> TOKEN_TYPE =
        new ParameterizedTypeReference<>() {};

    private final GoogleCalendarCredentialsStore credentials;
    private final RestTemplate restTemplate = new RestTemplate();

    public GoogleCalendarOAuthService(GoogleCalendarCredentialsStore credentials) {
        this.credentials = credentials;
    }

    public String buildAuthUrl(String redirectUri) {
        var client = requiredClientCredentials();
        String state = credentials.createOAuthState();
        return UriComponentsBuilder.fromUriString(AUTH_URL)
            .queryParam("client_id", client.clientId())
            .queryParam("redirect_uri", redirectUri)
            .queryParam("response_type", "code")
            .queryParam("scope", SCOPE)
            .queryParam("access_type", "offline")
            .queryParam("prompt", "consent")
            .queryParam("state", state)
            .build()
            .encode()
            .toUriString();
    }

    public void exchangeCode(String code, String state, String redirectUri) {
        if (!credentials.consumeOAuthState(state)) {
            throw new IllegalArgumentException("OAuth state is invalid or expired");
        }
        var client = requiredClientCredentials();
        Map<String, Object> body = tokenRequest(authCodeBody(client, code, redirectUri));
        credentials.saveToken(tokenFrom(body, null));
    }

    public String accessToken() {
        var token = credentials.token()
            .orElseThrow(() -> new IllegalStateException("Google Calendar is not connected"));
        if (!expiresSoon(token)) return token.accessToken();
        return refresh(token);
    }

    private String refresh(GoogleCalendarCredentialsStore.Token token) {
        if (blank(token.refreshToken())) {
            credentials.clearToken();
            throw new IllegalStateException("Google Calendar refresh token is unavailable");
        }
        var client = requiredClientCredentials();
        try {
            Map<String, Object> body = tokenRequest(refreshBody(client, token.refreshToken()));
            var refreshed = tokenFrom(body, token.refreshToken());
            credentials.saveToken(refreshed);
            return refreshed.accessToken();
        } catch (HttpClientErrorException exception) {
            credentials.clearToken();
            throw new IllegalStateException("Google Calendar authorization is invalid or revoked", exception);
        }
    }

    private MultiValueMap<String, String> authCodeBody(
        GoogleCalendarCredentialsStore.ClientCredentials client,
        String code,
        String redirectUri
    ) {
        MultiValueMap<String, String> body = clientBody(client);
        body.add("code", code);
        body.add("grant_type", "authorization_code");
        body.add("redirect_uri", redirectUri);
        return body;
    }

    private MultiValueMap<String, String> refreshBody(
        GoogleCalendarCredentialsStore.ClientCredentials client,
        String refreshToken
    ) {
        MultiValueMap<String, String> body = clientBody(client);
        body.add("refresh_token", refreshToken);
        body.add("grant_type", "refresh_token");
        return body;
    }

    private MultiValueMap<String, String> clientBody(
        GoogleCalendarCredentialsStore.ClientCredentials client
    ) {
        MultiValueMap<String, String> body = new LinkedMultiValueMap<>();
        body.add("client_id", client.clientId());
        body.add("client_secret", client.clientSecret());
        return body;
    }

    private Map<String, Object> tokenRequest(MultiValueMap<String, String> body) {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_FORM_URLENCODED);
        var response = restTemplate.exchange(
            TOKEN_URL,
            HttpMethod.POST,
            new HttpEntity<>(body, headers),
            TOKEN_TYPE
        );
        if (response.getBody() == null) {
            throw new IllegalStateException("Google token endpoint returned an empty response");
        }
        return response.getBody();
    }

    private GoogleCalendarCredentialsStore.Token tokenFrom(
        Map<String, Object> body,
        String fallbackRefreshToken
    ) {
        String accessToken = text(body.get("access_token"));
        if (blank(accessToken)) throw new IllegalStateException("Google token response lacks access_token");
        String refreshToken = text(body.get("refresh_token"));
        if (blank(refreshToken)) refreshToken = fallbackRefreshToken;
        Number expiresIn = body.get("expires_in") instanceof Number number ? number : 3600;
        return new GoogleCalendarCredentialsStore.Token(
            accessToken,
            refreshToken,
            text(body.get("token_type")),
            text(body.get("scope")),
            Instant.now().plusSeconds(expiresIn.longValue())
        );
    }

    private GoogleCalendarCredentialsStore.ClientCredentials requiredClientCredentials() {
        return credentials.clientCredentials()
            .orElseThrow(() -> new IllegalStateException("Google OAuth client credentials are not configured"));
    }

    private boolean expiresSoon(GoogleCalendarCredentialsStore.Token token) {
        return blank(token.accessToken())
            || token.expiresAt() == null
            || token.expiresAt().isBefore(Instant.now().plusSeconds(60));
    }

    private String text(Object value) {
        return value == null ? null : value.toString();
    }

    private boolean blank(String value) {
        return value == null || value.isBlank();
    }
}
