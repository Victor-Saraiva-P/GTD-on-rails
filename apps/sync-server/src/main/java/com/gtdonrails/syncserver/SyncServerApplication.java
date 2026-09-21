package com.gtdonrails.syncserver;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
public class SyncServerApplication {

    public static void main(String[] args) {
        SpringApplication.run(SyncServerApplication.class, args);
    }
}
