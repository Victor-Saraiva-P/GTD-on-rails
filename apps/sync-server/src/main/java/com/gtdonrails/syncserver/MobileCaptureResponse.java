package com.gtdonrails.syncserver;

public record MobileCaptureResponse(
    String id,
    long revision,
    long cursor
) {
}
