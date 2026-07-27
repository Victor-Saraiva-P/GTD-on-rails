import { useState, type FormEvent } from "react";
import { apiJson } from "../../lib/api/apiClient.ts";
import "./database-setup.css";

type RepairResponse = { status: string };

/** Renders the guarded repair flow for an existing Database Connection Configuration.
 *
 * @example <DatabaseRepair />
 */
export function DatabaseRepair() {
  const [url, setUrl] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await apiJson<RepairResponse>("/bootstrap/database/repair", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ administrativeUrl: url, administrativeUsername: username, administrativePassword: password })
      });
      setPassword("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Database repair failed; expected a reachable PostgreSQL administrator");
    } finally {
      setSaving(false);
    }
  }

  return <main className="database-setup" aria-label="Database connection repair">
    <form className="database-setup__form" onSubmit={submit}>
      <h1>Repair Database Connection</h1>
      <p>The existing Database Connection Configuration is invalid. Enter a fresh administrator connection to rotate the limited application role.</p>
      <label>Administrative PostgreSQL URL<input required value={url} onChange={(event) => setUrl(event.target.value)} placeholder="jdbc:postgresql://...?...&sslmode=verify-full" /></label>
      <label>Administrative username<input required value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="username" /></label>
      <label>Administrative password<input required type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" /></label>
      {error ? <p role="alert">{error} Try again; the existing configuration was not replaced.</p> : null}
      <button type="submit" disabled={saving}>{saving ? "Repairing..." : "Repair database connection"}</button>
    </form>
  </main>;
}
