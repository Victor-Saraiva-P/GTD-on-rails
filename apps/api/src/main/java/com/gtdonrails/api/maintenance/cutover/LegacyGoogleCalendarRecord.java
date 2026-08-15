package com.gtdonrails.api.maintenance.cutover;

import java.util.UUID;

public record LegacyGoogleCalendarRecord(
    UUID id,
    String googleCalendarId,
    String name,
    String colorHex
) {}
