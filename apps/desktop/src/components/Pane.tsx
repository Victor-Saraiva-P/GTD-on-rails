import type { PropsWithChildren, ReactNode } from "react";

type PaneProps = PropsWithChildren<{
  iconSrc: string;
  label: string;
  status?: ReactNode;
  bodyClassName?: string;
}>;

export function Pane({ iconSrc, label, status, bodyClassName, children }: PaneProps) {
  return (
    <div className="pane">
      <header className="pane__header">
        <span className="pane__tab">
          <img src={iconSrc} alt="" className="pane__tab-icon" />
          <span>{label}</span>
        </span>
        {status ? <div className="pane__status">{status}</div> : null}
      </header>

      <div className={bodyClassName ? `pane__body ${bodyClassName}` : "pane__body"}>{children}</div>
    </div>
  );
}
