package com.gtdonrails.api;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.concurrent.atomic.AtomicInteger;
import java.util.function.Consumer;

import com.gtdonrails.api.bootstrap.BootstrapConfiguration;
import com.gtdonrails.api.services.FileSyncService;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.springframework.boot.SpringApplication;
import org.springframework.context.ConfigurableApplicationContext;

class BootstrapApplicationTests {

    @Test
    void returnsSuccessfulBootstrapExitCodeWithoutWaitingForSetup() throws InterruptedException {
        BootstrapConfiguration bootstrapConfiguration = mock(BootstrapConfiguration.class);
        FileSyncService fileSyncService = mock(FileSyncService.class);
        when(bootstrapConfiguration.run(fileSyncService)).thenReturn(0);

        int exitCode = BootstrapApplication.bootstrapExitCode(bootstrapConfiguration, fileSyncService);

        assertEquals(0, exitCode);
        verify(bootstrapConfiguration, never()).awaitSetupCompletion();
    }

    @Test
    void returnsTheHighestExitCodeFromBootstrapAndSpring() {
        BootstrapConfiguration bootstrapConfiguration = mock(BootstrapConfiguration.class);
        FileSyncService fileSyncService = mock(FileSyncService.class);
        ConfigurableApplicationContext context = mock(ConfigurableApplicationContext.class);
        when(context.getBean(BootstrapConfiguration.class)).thenReturn(bootstrapConfiguration);
        when(context.getBean(FileSyncService.class)).thenReturn(fileSyncService);
        when(bootstrapConfiguration.run(fileSyncService)).thenReturn(0);

        try (MockedStatic<SpringApplication> springApplication = mockStatic(SpringApplication.class)) {
            springApplication.when(() -> SpringApplication.exit(context)).thenReturn(1);

            assertEquals(1, BootstrapApplication.applicationExitCode(context));
        }
    }

    @Test
    void startsBootstrapAndExitsWithItsResult() {
        BootstrapConfiguration bootstrapConfiguration = mock(BootstrapConfiguration.class);
        FileSyncService fileSyncService = mock(FileSyncService.class);
        ConfigurableApplicationContext context = mock(ConfigurableApplicationContext.class);
        when(context.getBean(BootstrapConfiguration.class)).thenReturn(bootstrapConfiguration);
        when(context.getBean(FileSyncService.class)).thenReturn(fileSyncService);
        when(bootstrapConfiguration.run(fileSyncService)).thenReturn(0);
        AtomicInteger exitCode = new AtomicInteger();

        try (MockedStatic<SpringApplication> springApplication = mockStatic(SpringApplication.class)) {
            springApplication.when(() -> SpringApplication.exit(context)).thenReturn(0);

            BootstrapApplication.run(new String[] {"--bootstrap"}, args -> context, exitCode::set);
        }

        assertEquals(0, exitCode.get());
    }

    @Test
    void waitsForSetupWhenBootstrapRequiresInitialConfiguration() throws InterruptedException {
        assertSetupWaits(bootstrapConfiguration -> when(bootstrapConfiguration.setupRequired()).thenReturn(true));
    }

    @Test
    void waitsForSetupWhenBootstrapRequiresRepair() throws InterruptedException {
        assertSetupWaits(bootstrapConfiguration -> when(bootstrapConfiguration.repairRequired()).thenReturn(true));
    }

    @Test
    void preservesInterruptStatusWhenSetupWaitIsInterrupted() throws InterruptedException {
        BootstrapConfiguration bootstrapConfiguration = mock(BootstrapConfiguration.class);
        FileSyncService fileSyncService = mock(FileSyncService.class);
        when(bootstrapConfiguration.run(fileSyncService)).thenReturn(2);
        when(bootstrapConfiguration.setupRequired()).thenReturn(true);
        doThrow(new InterruptedException("test interruption"))
            .when(bootstrapConfiguration).awaitSetupCompletion();

        try {
            assertThrows(IllegalStateException.class,
                () -> BootstrapApplication.bootstrapExitCode(bootstrapConfiguration, fileSyncService));
            assertTrue(Thread.currentThread().isInterrupted());
        } finally {
            Thread.interrupted();
        }
    }

    private void assertSetupWaits(Consumer<BootstrapConfiguration> setupRequirement) throws InterruptedException {
        BootstrapConfiguration bootstrapConfiguration = mock(BootstrapConfiguration.class);
        FileSyncService fileSyncService = mock(FileSyncService.class);
        when(bootstrapConfiguration.run(fileSyncService)).thenReturn(2);
        setupRequirement.accept(bootstrapConfiguration);

        int exitCode = BootstrapApplication.bootstrapExitCode(bootstrapConfiguration, fileSyncService);

        assertEquals(2, exitCode);
        verify(bootstrapConfiguration).awaitSetupCompletion();
    }
}
