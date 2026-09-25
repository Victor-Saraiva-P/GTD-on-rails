package com.gtdonrails.syncserver;

import java.util.List;

public record SyncChangeFeed(long cursor, List<SyncChange> changes) {
}
