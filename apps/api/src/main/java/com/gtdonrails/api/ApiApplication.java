package com.gtdonrails.api;

import java.time.Clock;

import com.gtdonrails.api.bootstrap.DatabaseTrustCertificateProvisioner;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.annotation.Bean;

@SpringBootApplication
public class ApiApplication {

    /**
     * Starts the Spring Boot API process.
     *
     * <p>Example: {@code ApiApplication.main(args)}.</p>
     */
    public static void main(String[] args) {
        if (hasBootstrapProfile(args)) {
            BootstrapApplication.run(args);
            return;
        }
        new DatabaseTrustCertificateProvisioner().ensureCertificate();
        SpringApplication.run(ApiApplication.class, args);
    }

    private static boolean hasBootstrapProfile(String[] args) {
        for (String arg : args) {
            if (arg.contains("bootstrap")) return true;
        }
        return false;
    }

    @Bean
    public Clock clock() {
        return Clock.systemDefaultZone();
    }
}
