import type { PropsWithChildren } from "react";
import { appMetadata } from "../../config/appMetadata";
import { buildDatabaseReadinessBlockerModel, shouldBlockDatabaseInteraction } from "./databaseReadiness";
import { useDatabaseReadiness } from "./DatabaseReadinessProvider";

/** Blocks every desktop interaction until PostgreSQL can serve authoritative state.
 *
 * @example <DatabaseReadinessBlocker><AppShell /></DatabaseReadinessBlocker>
 */
export function DatabaseReadinessBlocker({ children }: PropsWithChildren) {
  const { isReady, status } = useDatabaseReadiness();
  if (!shouldBlockDatabaseInteraction(isReady, false)) return children;

  const model = buildDatabaseReadinessBlockerModel(status);

  return (
    <dialog open aria-label={model.title} aria-modal="true" className="boot-loader connectivity-blocker">
      <div className="boot-loader__terminal">
        <p className="boot-loader__brand">{appMetadata.name} v{appMetadata.version}</p>
        <p className="boot-loader__line">
          <span className="boot-loader__status">[{model.statusLabel}]</span> {model.title}
        </p>
        <p className="boot-loader__line connectivity-blocker__message">{model.message}</p>
        <p className="boot-loader__line">
          <span className="boot-loader__status">[{status === "update-required" ? "INFO" : "WAIT"}]</span> {model.actionText}
          <span className="boot-loader__cursor">_</span>
        </p>
      </div>
    </dialog>
  );
}
