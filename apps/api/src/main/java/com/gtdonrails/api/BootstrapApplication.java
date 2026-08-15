package com.gtdonrails.api;

import java.util.function.Function;
import java.util.function.IntConsumer;

import com.gtdonrails.api.bootstrap.BootstrapConfiguration;
import com.gtdonrails.api.services.FileSyncService;
import org.springframework.boot.autoconfigure.EnableAutoConfiguration;
import org.springframework.boot.SpringApplication;
import org.springframework.context.annotation.ComponentScan;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.ConfigurableApplicationContext;
import org.springframework.context.annotation.Profile;

/** Runs the pre-persistence startup checks without constructing the normal API. */
@Configuration
@Profile("bootstrap")
@EnableAutoConfiguration(
    excludeName = {
        "org.springframework.boot.jdbc.autoconfigure.DataSourceAutoConfiguration",
        "org.springframework.boot.jdbc.autoconfigure.JdbcTemplateAutoConfiguration",
        "org.springframework.boot.hibernate.autoconfigure.HibernateJpaAutoConfiguration",
        "org.springframework.boot.flyway.autoconfigure.FlywayAutoConfiguration"
    })
@ComponentScan(basePackageClasses = BootstrapConfiguration.class)
public class BootstrapApplication {

    /**
     * Runs the temporary bootstrap context and exits with its lifecycle result.
     *
     * <p>Example: {@code BootstrapApplication.run(args)}.</p>
     */
    public static void run(String[] args) {
        run(args, bootstrapArguments -> SpringApplication.run(BootstrapApplication.class, bootstrapArguments), System::exit);
    }

    static void run(
        String[] args,
        Function<String[], ConfigurableApplicationContext> bootstrapContextStarter,
        IntConsumer exitProcess
    ) {
        ConfigurableApplicationContext context = bootstrapContextStarter.apply(args);
        exitProcess.accept(applicationExitCode(context));
    }

    static int applicationExitCode(ConfigurableApplicationContext context) {
        BootstrapConfiguration bootstrapConfiguration = context.getBean(BootstrapConfiguration.class);
        int exitCode = bootstrapExitCode(bootstrapConfiguration, context.getBean(FileSyncService.class));
        int springExitCode = SpringApplication.exit(context);
        return Math.max(exitCode, springExitCode);
    }

    static int bootstrapExitCode(BootstrapConfiguration configuration, FileSyncService fileSyncService) {
        int exitCode = configuration.run(fileSyncService);
        if (setupCompletionRequired(exitCode, configuration)) awaitSetup(configuration);
        return exitCode;
    }

    private static boolean setupCompletionRequired(int exitCode, BootstrapConfiguration configuration) {
        return exitCode == 2 && (configuration.setupRequired() || configuration.repairRequired());
    }

    private static void awaitSetup(BootstrapConfiguration configuration) {
        try {
            configuration.awaitSetupCompletion();
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException("database setup wait was interrupted; expected completed setup", exception);
        }
    }

    private BootstrapApplication() {
    }
}
