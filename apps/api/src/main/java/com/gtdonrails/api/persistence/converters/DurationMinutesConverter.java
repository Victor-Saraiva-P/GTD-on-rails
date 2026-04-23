package com.gtdonrails.api.persistence.converters;

import java.time.Duration;

import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;

@Converter
public class DurationMinutesConverter implements AttributeConverter<Duration, Long> {

    @Override
    public Long convertToDatabaseColumn(Duration duration) {
        if (duration == null) {
            return null;
        }

        return duration.toMinutes();
    }

    @Override
    public Duration convertToEntityAttribute(Long minutes) {
        if (minutes == null) {
            return null;
        }

        return Duration.ofMinutes(minutes);
    }
}
