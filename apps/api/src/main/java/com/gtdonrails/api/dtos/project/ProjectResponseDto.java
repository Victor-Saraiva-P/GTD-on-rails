package com.gtdonrails.api.dtos.project;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.UUID;

public record ProjectResponseDto(UUID id, String title, LocalDate deadline, LocalDate doneDate, LocalTime doneTime) {
}
