import type { PropsWithChildren } from "react";
import { appMetadata } from "../../config/appMetadata";
import { shouldBlockDatabaseInteraction } from "./databaseReadiness";
import { useDatabaseReadiness } from "./DatabaseReadinessProvider";

/** Blocks every desktop interaction until PostgreSQL can serve authoritative state.
 *
 * @example <DatabaseReadinessBlocker><AppShell /></DatabaseReadinessBlocker>
 */
export function DatabaseReadinessBlocker({ children }: PropsWithChildren) {
  const { isReady } = useDatabaseReadiness();
  if (!shouldBlockDatabaseInteraction(isReady, false)) return children;

  return (
    <div aria-modal="true" className="boot-loader connectivity-blocker" role="dialog">
      <div className="boot-loader__terminal">
        <p className="boot-loader__brand">{appMetadata.name} v{appMetadata.version}</p>
        <p className="boot-loader__line"><span className="boot-loader__status">[DATABASE]</span> PostgreSQL unavailable</p>
        <p className="boot-loader__line connectivity-blocker__message">Waiting for PostgreSQL to restore authoritative application state.</p>
        <p className="boot-loader__line"><span className="boot-loader__status">[WAIT]</span> Checking database connection<span className="boot-loader__cursor">_</span></p>
      </div>
    </div>
  );
}
