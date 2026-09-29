package com.gtdonrails.syncserver;

import java.util.List;

public record MobileNextAction(
    String id,
    String title,
    Double energy,
    Long estimatedTimeMinutes,
    String deadline,
    String status,
    List<String> contextIds,
    String projectTitle
) {
}
