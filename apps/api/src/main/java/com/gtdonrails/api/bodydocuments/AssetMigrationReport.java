package com.gtdonrails.api.bodydocuments;

public record AssetMigrationReport(int copied, int alreadyPresent, int missing) {
}
