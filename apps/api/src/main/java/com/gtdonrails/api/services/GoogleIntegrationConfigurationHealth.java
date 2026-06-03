package com.gtdonrails.api.services;

/**
 * Describes Google Integration Configuration health for API status responses.
 *
 * <p>Example: {@code health.status() == GoogleIntegrationConfigurationStatus.READY}.</p>
 */
public record GoogleIntegrationConfigurationHealth(
    GoogleIntegrationConfigurationStatus status,
    String message
) {
}
