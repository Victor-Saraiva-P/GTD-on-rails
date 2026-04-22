import type { CSSProperties, PropsWithChildren } from "react";
import { appMetadata } from "../config/appMetadata";
import type { ListTheme } from "../features/lists/listThemes";

type ListWorkspaceProps = PropsWithChildren<{
  theme: ListTheme;
  currentLabel: string;
  currentIconSrc: string;
}>;

export function ListWorkspace({
  theme,
  currentLabel,
  currentIconSrc,
  children
}: ListWorkspaceProps) {
  const style = {
    "--list-accent": theme.accentColor,
    "--list-accent-rgb": theme.accentColorRgb
  } as CSSProperties;

  return (
    <main className="list-workspace" style={style}>
      <div className="list-workspace__viewport">{children}</div>

      <footer className="list-workspace__footer" aria-label="Current list">
        <div className="list-workspace__brand">
          <span>{appMetadata.name}</span>
          <span className="list-workspace__brand-version">v{appMetadata.version}</span>
        </div>

        <div className="list-workspace__current">
          <img src={currentIconSrc} alt="" className="list-workspace__current-icon" />
          <span>{currentLabel}</span>
        </div>
      </footer>
    </main>
  );
}
