package com.gtdonrails.api.maintenance.cutover;

import java.time.Instant;
import java.util.UUID;

public record LegacyGoogleCredentialRecord(
    UUID id,
    String accessToken,
    String refreshToken,
    String tokenType,
    Instant expiresAt,
    String scope
) {}
