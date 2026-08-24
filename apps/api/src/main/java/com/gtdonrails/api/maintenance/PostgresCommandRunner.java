package com.gtdonrails.api.maintenance;

import java.util.List;
import java.util.Map;

/** Runs a fixed PostgreSQL client command without invoking a shell. */
public interface PostgresCommandRunner {

    void run(String executable, List<String> arguments, Map<String, String> environment);
}
