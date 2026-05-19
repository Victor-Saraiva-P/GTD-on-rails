import type { PropsWithChildren, ReactNode } from "react";

type PaneProps = PropsWithChildren<{
  iconSrc: string;
  label: string;
  status?: ReactNode;
  bodyClassName?: string;
  wrapLabel?: boolean;
  active?: boolean;
}>;

function paneClassName(active: boolean): string {
  return `pane${active ? " pane--active" : ""}`;
}

function PaneHeader({ iconSrc, label, status, wrapLabel = false }: Omit<PaneProps, "children">) {
  return (
    <header className={`pane__header${wrapLabel ? " pane__header--wrap" : ""}`}>
      <span className={`pane__tab${wrapLabel ? " pane__tab--wrap" : ""}`}>
        <img src={iconSrc} alt="" className="pane__tab-icon" />
        <span className={`pane__tab-label${wrapLabel ? " pane__tab-label--wrap" : ""}`}>
          {label}
        </span>
      </span>
      {status ? <div className="pane__status">{status}</div> : null}
    </header>
  );
}

/**
 * Renders a generic pane with a tab-like header and active-state styling.
 *
 * @example <Pane iconSrc="/icon.svg" label="Inbox">...</Pane>
 */
export function Pane({ bodyClassName, active = false, children, ...headerProps }: PaneProps) {
  return (
    <div className={paneClassName(active)}>
      <PaneHeader {...headerProps} />
      <div className={bodyClassName ? `pane__body ${bodyClassName}` : "pane__body"}>{children}</div>
    </div>
  );
}
