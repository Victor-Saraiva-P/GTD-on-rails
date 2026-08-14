package com.gtdonrails.api.maintenance;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;

import org.junit.jupiter.api.Test;
import org.springframework.context.annotation.AnnotationConfigApplicationContext;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

class DailyBackupSchedulingTests {

    @Test
    void productionRegistersAutomaticDailyBackups() {
        try (AnnotationConfigApplicationContext context = schedulingContext("prod")) {
            assertTrue(context.containsBeanDefinition("dailyBackupScheduler"));
        }
    }

    @Test
    void nonProductionDoesNotRegisterAutomaticDailyBackups() {
        for (String profile : List.of("development", "staging")) {
            try (AnnotationConfigApplicationContext context = schedulingContext(profile)) {
                assertFalse(context.containsBeanDefinition("dailyBackupScheduler"));
            }
        }
    }

    @Test
    void scheduledRunUsesTheDailyBackupPolicy() {
        FakeDailyBackupCreator backupCreator = new FakeDailyBackupCreator();

        new DailyBackupScheduler(backupCreator).createDailyBackup();

        assertTrue(backupCreator.requested);
    }

    private AnnotationConfigApplicationContext schedulingContext(String profile) {
        AnnotationConfigApplicationContext context = new AnnotationConfigApplicationContext();
        context.getEnvironment().setActiveProfiles(profile);
        context.register(DailyBackupScheduler.class, FakeBackupConfiguration.class);
        context.refresh();
        return context;
    }

    @Configuration
    static class FakeBackupConfiguration {

        @Bean
        DailyBackupCreator fakeDailyBackupCreator() {
            return new FakeDailyBackupCreator();
        }
    }

    static class FakeDailyBackupCreator implements DailyBackupCreator {

        private boolean requested;

        @Override
        public void createDailyBackupIfMissing() {
            requested = true;
        }
    }
}
