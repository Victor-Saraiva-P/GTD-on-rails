package com.gtdonrails.api.maintenance;

import java.nio.file.Path;

public record BackupResult(String fileName, long size, Path path) {
}
