import type { CSSProperties, PropsWithChildren } from "react";
import { appMetadata } from "../config/appMetadata";
import type { ListTheme } from "../features/lists/listThemes";
import { SyncStatusIndicators } from "../features/sync-status/SyncStatusIndicators";

type ListWorkspaceProps = PropsWithChildren<{
  theme: ListTheme;
  currentLabel: string;
}>;

function buildWorkspaceStyle(theme: ListTheme): CSSProperties {
  return {
    "--list-accent": theme.accentColor,
    "--list-accent-rgb": theme.accentColorRgb
  } as CSSProperties;
}

function ListWorkspaceFooter({ currentLabel }: Pick<ListWorkspaceProps, "currentLabel">) {
  return (
    <footer className="list-workspace__footer" aria-label="Current list">
      <div className="list-workspace__brand">
        <span>{appMetadata.name}</span>
        <span className="list-workspace__brand-version">v{appMetadata.version}</span>
      </div>

      <div className="list-workspace__current">
        <span>{currentLabel}</span>
      </div>

      <SyncStatusIndicators />
    </footer>
  );
}

export function ListWorkspace({ theme, currentLabel, children }: ListWorkspaceProps) {
  return (
    <main className="list-workspace" style={buildWorkspaceStyle(theme)}>
      <div className="list-workspace__viewport">{children}</div>
      <ListWorkspaceFooter currentLabel={currentLabel} />
    </main>
  );
}
