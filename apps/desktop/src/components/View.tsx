import type { PropsWithChildren, ReactNode } from "react";

type ViewProps = Readonly<PropsWithChildren<{
  iconSrc: string;
  label: string;
  status?: ReactNode;
  bodyClassName?: string;
  wrapLabel?: boolean;
  active?: boolean;
}>>;

function viewClassName(active: boolean): string {
  return `pane${active ? " pane--active" : ""}`;
}

function ViewHeader({ iconSrc, label, status, wrapLabel = false }: Readonly<Omit<ViewProps, "children">>) {
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
 * Renders a generic view with a tab-like header and active-state styling.
 *
 * @example <View iconSrc="/icon.svg" label="Inbox">...</View>
 */
export function View({ bodyClassName, active = false, children, ...headerProps }: ViewProps) {
  return (
    <div className={viewClassName(active)}>
      <ViewHeader {...headerProps} />
      <div className={bodyClassName ? `pane__body ${bodyClassName}` : "pane__body"}>{children}</div>
    </div>
  );
}
