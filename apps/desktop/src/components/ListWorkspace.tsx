import type { CSSProperties, PropsWithChildren, ReactNode } from "react";
import { appMetadata } from "../config/appMetadata";
import type { ListTheme } from "../features/lists/listThemes";
import { SyncStatusIndicators } from "../features/sync-status/SyncStatusIndicators";

type ListWorkspaceProps = Readonly<PropsWithChildren<{
  theme: ListTheme;
  currentLabel: ReactNode;
  currentClassName?: string;
  modeLabel?: string | null;
}>>;

function buildWorkspaceStyle(theme: ListTheme): CSSProperties {
  return {
    "--list-accent": theme.accentColor,
    "--list-accent-rgb": theme.accentColorRgb
  } as CSSProperties;
}

function ListWorkspaceFooter({ currentClassName, currentLabel, modeLabel }: Readonly<Pick<ListWorkspaceProps, "currentClassName" | "currentLabel" | "modeLabel">>) {
  return (
    <footer className="list-workspace__footer" aria-label="Current list">
      <div className="list-workspace__brand">
        <span>{appMetadata.name}</span>
        <span className="list-workspace__brand-version">v{appMetadata.version}</span>
      </div>

      <div className={currentClassName ? `list-workspace__current ${currentClassName}` : "list-workspace__current"}>
        <span>{currentLabel}</span>
      </div>

      {modeLabel ? (
        <div className="list-workspace__mode" aria-label="Editing mode">
          <span>{modeLabel}</span>
        </div>
      ) : null}

      <SyncStatusIndicators />
    </footer>
  );
}

/**
 * Wraps list-oriented screens with shared shell chrome and theme variables.
 *
 * @example <ListWorkspace theme={inboxListTheme} currentLabel="Inbox">...</ListWorkspace>
 */
export function ListWorkspace({ theme, currentClassName, currentLabel, modeLabel, children }: ListWorkspaceProps) {
  return (
    <main className="list-workspace" style={buildWorkspaceStyle(theme)}>
      <div className="list-workspace__viewport">{children}</div>
      <ListWorkspaceFooter currentClassName={currentClassName} currentLabel={currentLabel} modeLabel={modeLabel} />
    </main>
  );
}
