package com.gtdonrails.api.services;

import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

@Service
public class AfterCommitExecutor {

    /**
     * Runs an action after transaction commit, or immediately outside a transaction.
     *
     * <p>Example: {@code afterCommitExecutor.run(syncAction)}.</p>
     */
    public void run(Runnable action) {
        if (!TransactionSynchronizationManager.isSynchronizationActive()) {
            action.run();
            return;
        }

        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override
            public void afterCommit() {
                action.run();
            }
        });
    }
}
