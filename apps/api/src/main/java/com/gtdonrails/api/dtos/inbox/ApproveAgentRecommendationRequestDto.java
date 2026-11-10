package com.gtdonrails.api.dtos.inbox;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * Explicit user approval of a recommendation, not an agent-executable command.
 *
 * <p>Example: POST /inbox/{id}/approve-recommendation with kind and title.</p>
 */
public record ApproveAgentRecommendationRequestDto(
    @NotBlank String kind,
    @NotBlank @Size(max = 500) String title,
    @Size(max = 100000) String body,
    @DecimalMin("0") @DecimalMax("10") BigDecimal energy,
    @Min(0) Long minutes,
    List<UUID> contextIds,
    LocalDate deadline,
    String scheduledDate,
    String scheduledTime
) {
}
