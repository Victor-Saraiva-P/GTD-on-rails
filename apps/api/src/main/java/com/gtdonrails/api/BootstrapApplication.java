package com.gtdonrails.api;

import com.gtdonrails.api.bootstrap.BootstrapConfiguration;
import com.gtdonrails.api.services.DataSyncService;
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
        ConfigurableApplicationContext context = SpringApplication.run(BootstrapApplication.class, args);
        int exitCode = context.getBean(BootstrapConfiguration.class)
            .run(context.getBean(DataSyncService.class));
        BootstrapConfiguration bootstrapConfiguration = context.getBean(BootstrapConfiguration.class);
        if (exitCode == 2 && (bootstrapConfiguration.setupRequired() || bootstrapConfiguration.repairRequired())) {
            awaitSetup(context);
        }
        int springExitCode = SpringApplication.exit(context);
        System.exit(Math.max(exitCode, springExitCode));
    }

    private static void awaitSetup(ConfigurableApplicationContext context) {
        try {
            context.getBean(BootstrapConfiguration.class).awaitSetupCompletion();
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException("database setup wait was interrupted; expected completed setup", exception);
        }
    }

    private BootstrapApplication() {
    }
}
