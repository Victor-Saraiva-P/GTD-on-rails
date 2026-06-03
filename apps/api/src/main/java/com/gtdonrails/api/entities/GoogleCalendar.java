package com.gtdonrails.api.entities;

import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

@Entity
@Table(name = "google_calendars")
@Getter
@Setter
public class GoogleCalendar {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(nullable = false, updatable = false)
    private UUID id;

    @Column(name = "google_calendar_id", nullable = false, columnDefinition = "text")
    private String googleCalendarId;

    @Column(name = "name", nullable = false, columnDefinition = "text")
    private String name;

    @Column(name = "color_hex", nullable = false, columnDefinition = "text")
    private String colorHex;
}
