package com.gtdonrails.api.maintenance;

import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import org.springframework.stereotype.Component;

@Component
public class ProcessPostgresCommandRunner implements PostgresCommandRunner {

    @Override
    public void run(String executable, List<String> arguments, Map<String, String> environment) {
        List<String> command = new ArrayList<>();
        command.add(executable);
        command.addAll(arguments);
        try {
            ProcessBuilder builder = new ProcessBuilder(command).redirectErrorStream(true);
            builder.environment().putAll(environment);
            Process process = builder.start();
            process.getInputStream().readAllBytes();
            int exitCode = process.waitFor();
            if (exitCode != 0) throw failedCommand(executable, exitCode);
        } catch (IOException exception) {
            throw new IllegalStateException("PostgreSQL command value '%s' is invalid; expected installed client executable: %s".formatted(executable, exception.getMessage()), exception);
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException("PostgreSQL command value '%s' was interrupted; expected completed command".formatted(executable), exception);
        }
    }

    private IllegalStateException failedCommand(String executable, int exitCode) {
        return new IllegalStateException("PostgreSQL command value '%s' failed with exit code %d; expected success".formatted(executable, exitCode));
    }
}
