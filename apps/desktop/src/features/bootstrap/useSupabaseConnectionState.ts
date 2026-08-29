import { useState, type ClipboardEvent } from "react";
import { parseSupabaseConnectionText, buildSupabaseJdbcUrl } from "./supabaseConnectionParams.ts";

/** Manages Supabase connection inputs and paste parsing.
 *
 * @example const state = useSupabaseConnectionState();
 */
export function useSupabaseConnectionState() {
  const [host, setHost] = useState("");
  const [port, setPort] = useState("5432");
  const [database, setDatabase] = useState("postgres");
  const [user, setUser] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function applyPasted(text: string): boolean {
    const p = parseSupabaseConnectionText(text);
    if (!p) return false;
    if (p.host) setHost(p.host);
    if (p.port) setPort(p.port);
    if (p.database) setDatabase(p.database);
    if (p.user) setUser(p.user);
    if (p.password) setPassword(p.password);
    return true;
  }

  function handlePaste(event: ClipboardEvent<HTMLInputElement>) {
    if (applyPasted(event.clipboardData.getData("text"))) event.preventDefault();
  }

  function buildPayload() {
    return {
      administrativeUrl: buildSupabaseJdbcUrl({ host, port, database }),
      administrativeUsername: user.trim(),
      administrativePassword: password
    };
  }

  return {
    host, setHost, port, setPort, database, setDatabase,
    user, setUser, password, setPassword,
    error, setError, saving, setSaving, handlePaste, buildPayload
  };
}
