package com.gtdonrails.api.maintenance.cutover;

import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;

import org.junit.jupiter.api.Test;
import org.springframework.boot.ApplicationArguments;
import org.springframework.context.ConfigurableApplicationContext;

class LegacyCutoverRunnerTests {

    @Test
    void runsCutoverOnApplicationStartup() {
        LegacyDatabaseCutoverService service = mock(LegacyDatabaseCutoverService.class);
        ConfigurableApplicationContext context = mock(ConfigurableApplicationContext.class);
        LegacyCutoverRunner runner = new LegacyCutoverRunner(service, context);
        ApplicationArguments args = mock(ApplicationArguments.class);

        runner.run(args);

        verify(service).executeCutover();
        verify(context).close();
    }
}
