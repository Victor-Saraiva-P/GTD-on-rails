package com.gtdonrails.api.maintenance.cutover;

import java.util.UUID;

public record LegacyNextActionContextRecord(
    UUID nextActionId,
    UUID contextId
) {}
