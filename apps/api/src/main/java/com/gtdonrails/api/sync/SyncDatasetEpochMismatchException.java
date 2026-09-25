package com.gtdonrails.api.sync;

public class SyncDatasetEpochMismatchException extends RuntimeException {

    public SyncDatasetEpochMismatchException(String localEpoch, String remoteEpoch) {
        super(
            "sync dataset epoch changed from '" + localEpoch + "' to '" + remoteEpoch
                + "'; expected client rebootstrap before applying remote changes"
        );
    }
}
