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
            byte[] outputBytes = process.getInputStream().readAllBytes();
            int exitCode = process.waitFor();
            if (exitCode != 0) {
                String output = new String(outputBytes, java.nio.charset.StandardCharsets.UTF_8).trim();
                throw failedCommand(executable, exitCode, output);
            }
        } catch (IOException exception) {
            throw new IllegalStateException("PostgreSQL command value '%s' is invalid; expected installed client executable: %s".formatted(executable, exception.getMessage()), exception);
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException("PostgreSQL command value '%s' was interrupted; expected completed command".formatted(executable), exception);
        }
    }

    private IllegalStateException failedCommand(String executable, int exitCode, String output) {
        String detail = output.isBlank() ? "" : ": " + output;
        return new IllegalStateException("PostgreSQL command value '%s' failed with exit code %d%s; expected success".formatted(executable, exitCode, detail));
    }
}
