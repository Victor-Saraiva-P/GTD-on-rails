package com.gtdonrails.api.sidecar;

public record SidecarReadyPayload(
    String host,
    int port,
    String baseUrl,
    String startedAt
) {}
