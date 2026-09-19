import type { CSSProperties, PropsWithChildren, ReactNode } from "react";
import { appMetadata } from "../config/appMetadata";
import type { ListTheme } from "../features/lists/listThemes";
import { SyncStatusIndicators } from "../features/sync-status/SyncStatusIndicators";
import { TitleSearchProvider } from "../features/title-search/TitleSearchContext";
import { ListTitleSearchBar } from "../features/title-search/ListTitleSearchBar";
import type { TitleSearchState } from "../features/title-search/types";
import { useZoomMode } from "../features/zoom-mode/ZoomModeContext";
import { ZoomModeExitButton } from "../features/zoom-mode/ZoomModeExitButton";

type ListWorkspaceProps = Readonly<PropsWithChildren<{
  theme: ListTheme;
  currentLabel: ReactNode;
  currentClassName?: string;
  modeLabel?: string | null;
  titleSearch?: TitleSearchState | null;
}>>;

type ListWorkspaceFooterProps = Readonly<
  Pick<ListWorkspaceProps, "currentClassName" | "currentLabel" | "modeLabel"> & {
    isZoomMode: boolean;
  }
>;

function buildWorkspaceStyle(theme: ListTheme): CSSProperties {
  return {
    "--list-accent": theme.accentColor,
    "--list-accent-rgb": theme.accentColorRgb
  } as CSSProperties;
}

function WorkspaceBrand() {
  return (
    <div className="list-workspace__brand">
      <span>{appMetadata.name}</span>
      <span className="list-workspace__brand-version">v{appMetadata.version}</span>
    </div>
  );
}

function ZoomFooter({ modeLabel }: Readonly<Pick<ListWorkspaceProps, "modeLabel">>) {
  return (
    <footer className="list-workspace__footer" aria-label="Current list">
      {modeLabel ? (
        <div className="list-workspace__mode" aria-label="Editing mode">
          <span>{modeLabel}</span>
        </div>
      ) : null}
    </footer>
  );
}

function ListWorkspaceFooter({ currentClassName, currentLabel, isZoomMode, modeLabel }: ListWorkspaceFooterProps) {
  if (isZoomMode) {
    return <ZoomFooter modeLabel={modeLabel} />;
  }

  return (
    <footer className="list-workspace__footer" aria-label="Current list">
      <WorkspaceBrand />
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
 * Wraps list-oriented screens with shared shell chrome, title search, and theme variables.
 *
 * @example <ListWorkspace theme={inboxListTheme} currentLabel="Inbox">...</ListWorkspace>
 */
export function ListWorkspace({ theme, currentClassName, currentLabel, modeLabel, titleSearch, children }: ListWorkspaceProps) {
  const { isZoomMode, exitZoomMode } = useZoomMode();

  return (
    <TitleSearchProvider value={titleSearch ?? null}>
      <main
        className={`list-workspace${isZoomMode ? " list-workspace--zoom" : ""}`}
        style={buildWorkspaceStyle(theme)}
        data-zoom-mode={isZoomMode ? "true" : undefined}
      >
        {isZoomMode && <ZoomModeExitButton onExit={exitZoomMode} />}
        <div className="list-workspace__viewport">{children}</div>
        {titleSearch?.isSearchOpen ? <ListTitleSearchBar search={titleSearch} /> : null}
        <ListWorkspaceFooter
          currentClassName={currentClassName}
          currentLabel={currentLabel}
          isZoomMode={isZoomMode}
          modeLabel={modeLabel}
        />
      </main>
    </TitleSearchProvider>
  );
}

