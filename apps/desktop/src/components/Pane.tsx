import type { PropsWithChildren, ReactNode } from "react";

type PaneProps = PropsWithChildren<{
  iconSrc: string;
  label: string;
  status?: ReactNode;
  bodyClassName?: string;
  wrapLabel?: boolean;
}>;

export function Pane({ iconSrc, label, status, bodyClassName, wrapLabel = false, children }: PaneProps) {
  return (
    <div className="pane">
      <header className={`pane__header${wrapLabel ? " pane__header--wrap" : ""}`}>
        <span className={`pane__tab${wrapLabel ? " pane__tab--wrap" : ""}`}>
          <img src={iconSrc} alt="" className="pane__tab-icon" />
          <span className={`pane__tab-label${wrapLabel ? " pane__tab-label--wrap" : ""}`}>
            {label}
          </span>
        </span>
        {status ? <div className="pane__status">{status}</div> : null}
      </header>

      <div className={bodyClassName ? `pane__body ${bodyClassName}` : "pane__body"}>{children}</div>
    </div>
  );
}
