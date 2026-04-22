import type { PropsWithChildren } from "react";

type ListPaneProps = PropsWithChildren<{
  title: string;
  panelIndex?: number;
  meta?: string;
  active?: boolean;
  bodyClassName?: string;
  iconSrc?: string;
  className?: string;
}>;

export function ListPane({
  title,
  panelIndex,
  meta,
  active = false,
  bodyClassName,
  iconSrc,
  className,
  children
}: ListPaneProps) {
  return (
    <section className={`list-pane${active ? " list-pane--active" : ""}${className ? ` ${className}` : ""}`}>
      <header className="list-pane__header">
        <div className="list-pane__heading">
          {iconSrc ? <img src={iconSrc} alt="" className="list-pane__icon" /> : null}
          <span className="list-pane__title">{title}</span>
          {meta ? <span className="list-pane__meta">({meta})</span> : null}
        </div>

        {panelIndex ? <span className="list-pane__panel-index">[Panel {panelIndex}]</span> : null}
      </header>

      <div className={bodyClassName ? `list-pane__body ${bodyClassName}` : "list-pane__body"}>
        {children}
      </div>
    </section>
  );
}
