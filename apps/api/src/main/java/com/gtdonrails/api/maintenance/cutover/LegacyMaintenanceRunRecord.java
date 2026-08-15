package com.gtdonrails.api.maintenance.cutover;

import java.time.Instant;

public record LegacyMaintenanceRunRecord(
    String name,
    Instant lastRunAt
) {}
