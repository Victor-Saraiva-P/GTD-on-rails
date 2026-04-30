package com.gtdonrails.api.dtos.item;

import java.time.Duration;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;

public record ItemTimeRequestDto(
    @NotNull(message = "time.hours is required")
    @Min(value = 0, message = "time.hours must be greater than or equal to 0")
    Long hours,

    @NotNull(message = "time.minutes is required")
    @Min(value = 0, message = "time.minutes must be greater than or equal to 0")
    @Max(value = 59, message = "time.minutes must be less than or equal to 59")
    Integer minutes
) {

    /**
     * Converts request hour and minute fields into a Java duration.
     *
     * <p>Example: {@code new ItemTimeRequestDto(1L, 30).toDuration()}.</p>
     */
    public Duration toDuration() {
        return Duration.ofHours(hours).plusMinutes(minutes);
    }
}
