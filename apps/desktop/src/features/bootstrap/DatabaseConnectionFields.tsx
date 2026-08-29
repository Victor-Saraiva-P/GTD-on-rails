import type { ClipboardEvent } from "react";

type DatabaseConnectionFieldsProps = {
  host: string;
  setHost: (host: string) => void;
  port: string;
  setPort: (port: string) => void;
  database: string;
  setDatabase: (database: string) => void;
  user: string;
  setUser: (user: string) => void;
  password: string;
  setPassword: (password: string) => void;
  onPaste: (event: ClipboardEvent<HTMLInputElement>) => void;
};

/** Renders Supabase connection parameter input fields.
 *
 * @example <DatabaseConnectionFields host={host} setHost={setHost} ... />
 */
export function DatabaseConnectionFields(props: DatabaseConnectionFieldsProps) {
  return <>
    <label>Host<input required value={props.host} onChange={(e) => props.setHost(e.target.value)} onPaste={props.onPaste} placeholder="aws-0-[region].pooler.supabase.com" autoCapitalize="none" autoCorrect="off" spellCheck="false" /></label>
    <div className="database-setup__row">
      <label>Port<input required value={props.port} onChange={(e) => props.setPort(e.target.value)} onPaste={props.onPaste} placeholder="5432" inputMode="numeric" /></label>
      <label>Database<input required value={props.database} onChange={(e) => props.setDatabase(e.target.value)} onPaste={props.onPaste} placeholder="postgres" autoCapitalize="none" autoCorrect="off" spellCheck="false" /></label>
    </div>
    <label>User<input required value={props.user} onChange={(e) => props.setUser(e.target.value)} onPaste={props.onPaste} placeholder="postgres.[project-ref]" autoComplete="username" autoCapitalize="none" autoCorrect="off" spellCheck="false" /></label>
    <label>Password<input required type="password" value={props.password} onChange={(e) => props.setPassword(e.target.value)} autoComplete="current-password" placeholder="••••••••••••" /></label>
  </>;
}
