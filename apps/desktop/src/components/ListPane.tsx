import type { PropsWithChildren } from "react";

type ListPaneProps = PropsWithChildren<{
  title: string;
  panelIndex?: number;
  meta?: string;
  active?: boolean;
  bodyClassName?: string;
  className?: string;
}>;

function listPaneClassName(active: boolean, className?: string): string {
  return `list-pane${active ? " list-pane--active" : ""}${className ? ` ${className}` : ""}`;
}

function ListPaneTitle({ title, meta }: Pick<ListPaneProps, "title" | "meta">) {
  return (
    <div className="list-pane__heading">
      <span className="list-pane__line list-pane__line--left" aria-hidden="true" />
      <div className="list-pane__cap">
        <div className="list-pane__title-row">
          <span className="list-pane__title">{title}</span>
          {meta ? <span className="list-pane__meta">({meta})</span> : null}
        </div>
      </div>
      <span className="list-pane__line list-pane__line--right" aria-hidden="true" />
    </div>
  );
}

function ListPaneHeader({ title, meta, panelIndex }: Pick<ListPaneProps, "title" | "meta" | "panelIndex">) {
  return (
    <header className="list-pane__header">
      <ListPaneTitle title={title} meta={meta} />
      {panelIndex ? <span className="list-pane__panel-index">[Panel {panelIndex}]</span> : null}
    </header>
  );
}

export function ListPane({ bodyClassName, active = false, className, children, ...headerProps }: ListPaneProps) {
  return (
    <section className={listPaneClassName(active, className)}>
      <ListPaneHeader {...headerProps} />
      <div className={bodyClassName ? `list-pane__body ${bodyClassName}` : "list-pane__body"}>
        {children}
      </div>
    </section>
  );
}
