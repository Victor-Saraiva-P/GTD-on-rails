package com.gtdonrails.syncserver;

import java.util.List;

public record MobileBootstrap(
    long cursor,
    List<MobileContext> contexts,
    List<MobileNextAction> nextActions,
    List<MobileCalendarItem> calendar,
    String calendarLocalDate,
    List<MobileCalendarEntry> calendarEntries
) {
}
