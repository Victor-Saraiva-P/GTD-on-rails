package com.gtdonrails.syncserver;

public class SyncObjectNotFoundException extends RuntimeException {

    public SyncObjectNotFoundException(String objectType, String objectId) {
        super("sync object '" + objectType + ":" + objectId + "' not found; expected existing canonical object");
    }
}
