package com.gtdonrails.api.maintenance;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.flyway.autoconfigure.FlywayMigrationStrategy;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;

@Configuration
public class FlywaySchemaConfiguration {

    @Bean
    public FlywaySchemaRange flywaySchemaRange(
        @Value("${gtd.schema.min-supported-version:1}") int minSupportedVersion,
        @Value("${gtd.schema.max-supported-version:2}") int maxSupportedVersion
    ) {
        return new FlywaySchemaRange(minSupportedVersion, maxSupportedVersion);
    }

    @Bean
    @Profile("!prod")
    public FlywayMigrationStrategy safeFlywayMigrationStrategy(FlywaySchemaRange supportedSchemaRange) {
        return flyway -> new FlywaySchemaMigration(flyway, supportedSchemaRange).migrate();
    }
}
