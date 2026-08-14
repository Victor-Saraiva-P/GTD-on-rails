import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import "./postgres-tools-required.css";

type Props = Readonly<{
  missingTools: string[];
  manualInstallCommand: string;
  onResolved: () => void;
}>;

type InstallationResult = {
  available: boolean;
  cancelled: boolean;
  error: string | null;
  manualInstallCommand: string;
};

/** Explains and explicitly repairs missing Arch PostgreSQL client tools.
 *
 * @example <PostgresToolsRequired missingTools={["pg_dump"]} manualInstallCommand="sudo pacman ..." onResolved={reload} />
 */
export function PostgresToolsRequired({ missingTools, manualInstallCommand, onResolved }: Props) {
  const [installing, setInstalling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function install() {
    setInstalling(true);
    setError(null);
    try {
      const result = await invoke<InstallationResult>("install_postgres_tools");
      if (result.available) return onResolved();
      setError(installationFailureMessage(result));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Installation failed; use the manual command below.");
    } finally {
      setInstalling(false);
    }
  }

  return <main className="postgres-tools-required" aria-label="PostgreSQL client tools required">
    <section className="postgres-tools-required__panel">
      <h1>PostgreSQL client tools required</h1>
      <p>Backup and restore need {missingTools.join(" and ")}. Install the Arch Linux package before continuing.</p>
      <button type="button" onClick={() => void install()} disabled={installing}>
        {installing ? "Waiting for authorization..." : "Install PostgreSQL tools"}
      </button>
      <p>Polkit will ask for authorization. Nothing is installed automatically.</p>
      {error ? <p role="alert">{error}</p> : null}
      <p>Manual fallback:</p>
      <code>{manualInstallCommand}</code>
    </section>
  </main>;
}

function installationFailureMessage(result: InstallationResult): string {
  if (result.cancelled) return `Installation was cancelled; run ${result.manualInstallCommand}.`;
  return result.error ?? "Installation did not complete; use the manual command below.";
}
