package com.worldsim.server;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
public class WorldSimServerApplication {
    public static void main(String[] args) {
        SpringApplication.run(WorldSimServerApplication.class, args);
    }
}
