package com.gtdonrails.api.config;

import java.util.List;

/**
 * Declares domain cache region names for Spring Cache.
 */
public final class CacheNames {

    public static final String INBOX = "inbox";
    public static final String NEXT_ACTIONS = "nextActions";
    public static final String PROJECTS = "projects";
    public static final String CONTEXTS = "contexts";
    public static final String CALENDAR = "calendar";

    public static final List<String> ALL = List.of(
        INBOX,
        NEXT_ACTIONS,
        PROJECTS,
        CONTEXTS,
        CALENDAR
    );

    private CacheNames() {
    }
}
