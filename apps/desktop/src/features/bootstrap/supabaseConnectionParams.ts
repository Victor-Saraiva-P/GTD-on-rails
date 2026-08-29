export type SupabaseConnectionFields = {
  host: string;
  port: string;
  database: string;
  user: string;
  password?: string;
};

/** Parses key-value pairs formatted as "key: value" or "key=value" per line. */
function parseKeyValueText(text: string): Partial<SupabaseConnectionFields> | null {
  const hostMatch = text.match(/^\s*host\s*[:=]\s*(.+)$/im);
  const userMatch = text.match(/^\s*(?:user|username)\s*[:=]\s*(.+)$/im);
  if (!hostMatch && !userMatch) return null;
  const portMatch = text.match(/^\s*port\s*[:=]\s*(.+)$/im);
  const dbMatch = text.match(/^\s*(?:database|dbname|db)\s*[:=]\s*(.+)$/im);
  const passMatch = text.match(/^\s*(?:password|pass)\s*[:=]\s*(.+)$/im);
  return {
    ...(hostMatch ? { host: hostMatch[1].trim() } : {}),
    ...(portMatch ? { port: portMatch[1].trim() } : {}),
    ...(dbMatch ? { database: dbMatch[1].trim() } : {}),
    ...(userMatch ? { user: userMatch[1].trim() } : {}),
    ...(passMatch ? { password: passMatch[1].trim() } : {})
  };
}

/** Parses PostgreSQL or JDBC connection URLs. */
function parseUriText(text: string): Partial<SupabaseConnectionFields> | null {
  const trimmed = text.trim();
  const withoutJdbc = trimmed.startsWith("jdbc:") ? trimmed.substring(5) : trimmed;
  if (!withoutJdbc.startsWith("postgresql://") && !withoutJdbc.startsWith("postgres://")) return null;
  try {
    const parsed = new URL(withoutJdbc.replace(/^postgres(?:ql)?:\/\//, "http://"));
    const pathDb = parsed.pathname.replace(/^\//, "");
    const pass = decodeURIComponent(parsed.password);
    return {
      host: parsed.hostname,
      port: parsed.port || "5432",
      database: pathDb || "postgres",
      user: decodeURIComponent(parsed.username),
      ...(pass && pass !== "[YOUR-PASSWORD]" ? { password: pass } : {})
    };
  } catch {
    return null;
  }
}

/** Parses JSON payloads containing connection fields. */
function parseJsonText(text: string): Partial<SupabaseConnectionFields> | null {
  const trimmed = text.trim();
  if (!trimmed.startsWith("{") || !trimmed.endsWith("}")) return null;
  try {
    const raw = JSON.parse(trimmed) as Record<string, unknown>;
    const host = typeof raw.host === "string" ? raw.host : undefined;
    const user = typeof raw.user === "string" ? raw.user : typeof raw.username === "string" ? raw.username : undefined;
    if (!host && !user) return null;
    return {
      ...(host ? { host } : {}),
      ...(raw.port ? { port: String(raw.port) } : {}),
      ...(typeof raw.database === "string" ? { database: raw.database } : {}),
      ...(user ? { user } : {}),
      ...(typeof raw.password === "string" ? { password: raw.password } : {})
    };
  } catch {
    return null;
  }
}

/** Parses psql CLI strings containing connection flags. */
function parsePsqlCommand(text: string): Partial<SupabaseConnectionFields> | null {
  if (!text.includes("psql ") && !text.startsWith("psql")) return null;
  const hostMatch = text.match(/(?:-h|--host)[=\s]+([^\s]+)/);
  const userMatch = text.match(/(?:-U|--username)[=\s]+([^\s]+)/);
  if (!hostMatch && !userMatch) return null;
  const portMatch = text.match(/(?:-p|--port)[=\s]+([^\s]+)/);
  const dbMatch = text.match(/(?:-d|--dbname)[=\s]+([^\s]+)/);
  return {
    ...(hostMatch ? { host: hostMatch[1] } : {}),
    ...(portMatch ? { port: portMatch[1] } : {}),
    ...(dbMatch ? { database: dbMatch[1] } : {}),
    ...(userMatch ? { user: userMatch[1] } : {})
  };
}

/** Parses Supabase connection parameters from pasted text or connection strings.
 *
 * @example parseSupabaseConnectionText("host: aws-1.pooler.supabase.com\nport: 5432")
 */
export function parseSupabaseConnectionText(text: string): Partial<SupabaseConnectionFields> | null {
  if (!text || !text.trim()) return null;
  return parseKeyValueText(text) || parseUriText(text) || parseJsonText(text) || parsePsqlCommand(text);
}

/** Cleans a hostname string from potential schemes, ports, or paths. */
function cleanHostString(rawHost: string): string {
  let cleaned = rawHost.trim().replace(/^jdbc:/i, "").replace(/^postgres(?:ql)?:\/\//i, "").replace(/^https?:\/\//i, "");
  const slashIdx = cleaned.indexOf("/");
  if (slashIdx >= 0) cleaned = cleaned.substring(0, slashIdx);
  const colonIdx = cleaned.indexOf(":");
  if (colonIdx >= 0) cleaned = cleaned.substring(0, colonIdx);
  return cleaned.trim();
}

/** Builds a Supavisor session JDBC URL with TLS verification from connection fields.
 *
 * @example buildSupabaseJdbcUrl({ host: "aws-1.pooler.supabase.com", port: "5432", database: "postgres" })
 */
export function buildSupabaseJdbcUrl(fields: { host: string; port?: string; database?: string }): string {
  const host = cleanHostString(fields.host);
  const port = (fields.port || "").trim() || "5432";
  const database = (fields.database || "").trim() || "postgres";
  return `jdbc:postgresql://${host}:${port}/${database}?sslmode=verify-full&stringType=unspecified`;
}
