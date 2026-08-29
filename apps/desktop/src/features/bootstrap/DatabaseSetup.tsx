import { type FormEvent } from "react";
import { apiJson } from "../../lib/api/apiClient.ts";
import { useSupabaseConnectionState } from "./useSupabaseConnectionState.ts";
import { DatabaseConnectionFields } from "./DatabaseConnectionFields.tsx";
import "./database-setup.css";

type SetupResponse = { status: string };

/** Renders the first-installation setup flow for Database Connection Configuration.
 *
 * @example <DatabaseSetup />
 */
export function DatabaseSetup() {
  const form = useSupabaseConnectionState();

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    form.setSaving(true);
    form.setError(null);
    try {
      await apiJson<SetupResponse>("/bootstrap/database", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form.buildPayload())
      });
      form.setPassword("");
    } catch (cause) {
      form.setError(cause instanceof Error ? cause.message : "Database setup failed; expected a reachable PostgreSQL administrator");
    } finally {
      form.setSaving(false);
    }
  }

  return <main className="database-setup" aria-label="Database setup">
    <form className="database-setup__form" onSubmit={submit}>
      <h1>Database Setup</h1>
      <p>Connect once with a Supabase administrator account. GTD on Rails will create a limited application role.</p>
      <DatabaseConnectionFields
        host={form.host} setHost={form.setHost} port={form.port} setPort={form.setPort}
        database={form.database} setDatabase={form.setDatabase} user={form.user} setUser={form.setUser}
        password={form.password} setPassword={form.setPassword} onPaste={form.handlePaste}
      />
      {form.error ? <p role="alert">{form.error}</p> : null}
      <button type="submit" disabled={form.saving}>{form.saving ? "Provisioning..." : "Set up database"}</button>
    </form>
  </main>;
}
