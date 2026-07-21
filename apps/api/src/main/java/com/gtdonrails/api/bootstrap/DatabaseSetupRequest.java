package com.gtdonrails.api.bootstrap;

public record DatabaseSetupRequest(
    String administrativeUrl,
    String administrativeUsername,
    String administrativePassword
) {
}
