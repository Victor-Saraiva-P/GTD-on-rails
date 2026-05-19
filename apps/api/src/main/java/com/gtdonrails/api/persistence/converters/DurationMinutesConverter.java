package com.gtdonrails.api.persistence.converters;

import java.time.Duration;

import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;

@Converter
public class DurationMinutesConverter implements AttributeConverter<Duration, Long> {

    /**
     * Stores durations as whole minutes.
     *
     * <p>Example: {@code durationMinutesConverter.convertToDatabaseColumn(Duration.ofMinutes(90))}.</p>
     */
    @Override
    public Long convertToDatabaseColumn(Duration duration) {
        if (duration == null) {
            return null;
        }

        return duration.toMinutes();
    }

    /**
     * Rehydrates durations from stored whole minutes.
     *
     * <p>Example: {@code durationMinutesConverter.convertToEntityAttribute(90L)}.</p>
     */
    @Override
    public Duration convertToEntityAttribute(Long minutes) {
        if (minutes == null) {
            return null;
        }

        return Duration.ofMinutes(minutes);
    }
}
