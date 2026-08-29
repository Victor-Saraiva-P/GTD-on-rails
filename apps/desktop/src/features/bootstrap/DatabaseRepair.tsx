import { type FormEvent } from "react";
import { apiJson } from "../../lib/api/apiClient.ts";
import { useSupabaseConnectionState } from "./useSupabaseConnectionState.ts";
import { DatabaseConnectionFields } from "./DatabaseConnectionFields.tsx";
import "./database-setup.css";

type RepairResponse = { status: string };

/** Renders the guarded repair flow for an existing Database Connection Configuration.
 *
 * @example <DatabaseRepair />
 */
export function DatabaseRepair() {
  const form = useSupabaseConnectionState();

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    form.setSaving(true);
    form.setError(null);
    try {
      await apiJson<RepairResponse>("/bootstrap/database/repair", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form.buildPayload())
      });
      form.setPassword("");
    } catch (cause) {
      form.setError(cause instanceof Error ? cause.message : "Database repair failed; expected a reachable PostgreSQL administrator");
    } finally {
      form.setSaving(false);
    }
  }

  return <main className="database-setup" aria-label="Database connection repair">
    <form className="database-setup__form" onSubmit={submit}>
      <h1>Repair Database Connection</h1>
      <p>The existing Database Connection Configuration is invalid. Enter a fresh administrator connection to rotate the limited application role.</p>
      <DatabaseConnectionFields
        host={form.host} setHost={form.setHost} port={form.port} setPort={form.setPort}
        database={form.database} setDatabase={form.setDatabase} user={form.user} setUser={form.setUser}
        password={form.password} setPassword={form.setPassword} onPaste={form.handlePaste}
      />
      {form.error ? <p role="alert">{form.error} Try again; the existing configuration was not replaced.</p> : null}
      <button type="submit" disabled={form.saving}>{form.saving ? "Repairing..." : "Repair database connection"}</button>
    </form>
  </main>;
}
