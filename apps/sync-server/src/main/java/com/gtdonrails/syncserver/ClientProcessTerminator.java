package com.gtdonrails.syncserver;

import org.springframework.stereotype.Component;

@Component
public class ClientProcessTerminator {

    public void exitAfterUpdate() {
        Thread thread = new Thread(this::delayedExit, "client-update-exit");
        thread.setDaemon(false);
        thread.start();
    }

    private void delayedExit() {
        try {
            Thread.sleep(500);
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
        }
        System.exit(0);
    }
}
