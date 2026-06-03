package com.gtdonrails.api.services;

import java.io.IOException;

class GoogleCalendarEventNotFoundException extends IOException {

    public GoogleCalendarEventNotFoundException(String eventId, Throwable cause) {
        super("google event value '" + eventId + "' is invalid; expected existing event", cause);
    }
}
