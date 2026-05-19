package com.gtdonrails.api.services;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.util.concurrent.atomic.AtomicInteger;

import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

@Tag("unit")
class AfterCommitExecutorTests {

    private final AfterCommitExecutor executor = new AfterCommitExecutor();

    @Test
    void runsImmediatelyWhenTransactionSynchronizationIsInactive() {
        AtomicInteger calls = new AtomicInteger();

        executor.run(calls::incrementAndGet);

        assertEquals(1, calls.get());
    }

    @Test
    void runsAfterCommitWhenTransactionSynchronizationIsActive() {
        AtomicInteger calls = new AtomicInteger();

        withTransactionSynchronization(() -> {
            executor.run(calls::incrementAndGet);
            assertEquals(0, calls.get());
            runRegisteredAfterCommitCallbacks();
        });

        assertEquals(1, calls.get());
    }

    private void withTransactionSynchronization(Runnable action) {
        TransactionSynchronizationManager.initSynchronization();
        try {
            action.run();
        } finally {
            TransactionSynchronizationManager.clearSynchronization();
        }
    }

    private void runRegisteredAfterCommitCallbacks() {
        for (TransactionSynchronization synchronization : TransactionSynchronizationManager.getSynchronizations()) {
            synchronization.afterCommit();
        }
    }
}
