package com.gtdonrails.api.maintenance.cutover;

import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;

import org.junit.jupiter.api.Test;
import org.springframework.boot.ApplicationArguments;

class LegacyCutoverRunnerTests {

    @Test
    void runsCutoverOnApplicationStartup() {
        LegacyDatabaseCutoverService service = mock(LegacyDatabaseCutoverService.class);
        LegacyCutoverRunner runner = new LegacyCutoverRunner(service);
        ApplicationArguments args = mock(ApplicationArguments.class);

        runner.run(args);

        verify(service).executeCutover();
    }
}
