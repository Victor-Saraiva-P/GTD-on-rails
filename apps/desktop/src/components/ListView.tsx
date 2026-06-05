import type { PropsWithChildren, ReactNode } from "react";

type ListViewProps = Readonly<PropsWithChildren<{
  title: string;
  viewIndex?: number;
  panelIndex?: number;
  meta?: ReactNode;
  active?: boolean;
  bodyClassName?: string;
  className?: string;
}>>;

function listViewClassName(active: boolean, className?: string): string {
  return `list-pane${active ? " list-pane--active" : ""}${className ? ` ${className}` : ""}`;
}

function ListViewTitle({ title, meta }: Readonly<Pick<ListViewProps, "title" | "meta">>) {
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

function ListViewIndexLabel({ panelIndex, viewIndex }: Readonly<Pick<ListViewProps, "panelIndex" | "viewIndex">>) {
  if (panelIndex) return <span className="list-pane__view-index">[Panel {panelIndex}]</span>;
  if (viewIndex) return <span className="list-pane__view-index">[View {viewIndex}]</span>;
  return null;
}

function ListViewHeader({ title, meta, panelIndex, viewIndex }: Readonly<Pick<ListViewProps, "title" | "meta" | "panelIndex" | "viewIndex">>) {
  return (
    <header className="list-pane__header">
      <ListViewTitle title={title} meta={meta} />
      <ListViewIndexLabel panelIndex={panelIndex} viewIndex={viewIndex} />
    </header>
  );
}

/**
 * Renders a titled list view with consistent terminal-style header metadata.
 *
 * @example <ListView title="Inbox">...</ListView>
 */
export function ListView({ bodyClassName, active = false, className, children, ...headerProps }: ListViewProps) {
  return (
    <section className={listViewClassName(active, className)}>
      <ListViewHeader {...headerProps} />
      <div className={bodyClassName ? `list-pane__body ${bodyClassName}` : "list-pane__body"}>
        {children}
      </div>
    </section>
  );
}
