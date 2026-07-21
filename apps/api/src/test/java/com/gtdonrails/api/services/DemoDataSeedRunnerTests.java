package com.gtdonrails.api.services;

import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.boot.DefaultApplicationArguments;

@ExtendWith(MockitoExtension.class)
class DemoDataSeedRunnerTests {

    @Mock
    private DemoDataSeedService demoDataSeedService;

    private DemoDataSeedRunner demoDataSeedRunner;

    @BeforeEach
    void setUp() {
        demoDataSeedRunner = new DemoDataSeedRunner(demoDataSeedService);
    }

    @Test
    void seedsDeterministicDemoDataWhenDevelopmentDatabaseIsEmpty() throws Exception {
        when(demoDataSeedService.isDatabaseEmpty()).thenReturn(true);

        demoDataSeedRunner.run(new DefaultApplicationArguments());

        verify(demoDataSeedService).resetDemoData();
    }

    @Test
    void preservesExistingDevelopmentData() throws Exception {
        when(demoDataSeedService.isDatabaseEmpty()).thenReturn(false);

        demoDataSeedRunner.run(new DefaultApplicationArguments());

        verify(demoDataSeedService, never()).resetDemoData();
    }
}
