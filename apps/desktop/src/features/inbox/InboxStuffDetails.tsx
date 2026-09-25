import { lazy, Suspense, useEffect, useState, type CSSProperties, type ReactNode } from "react";
import energyIcon from "../../assets/next-actions/energy icon.png";
import estimatedTimeIcon from "../../assets/next-actions/estimated time icon.png";
import scheduleIcon from "../../assets/next-actions/schdule-icon.png";
import { FilePreview } from "./FilePreview";
import { formatStuffCreatedAt, getStuffBodyPreviewLines, type Stuff, type ItemBody } from "./types";
import { calendarDetailMetadata } from "../calendar/calendarDetailMetadata";
import type { Calendar } from "../calendar/types";
import { formatScheduleDateTime, type NextAction } from "../next-actions/types";
import { buildApiUrl } from "../../config/env";
import { ContextNameWithIcon } from "../contexts/ContextNameWithIcon";
import { ProjectAssociationMarker } from "../projects/ProjectAssociationMarker";
import { ensureItemBodyLoaded } from "./itemBodyLoader.ts";

const LazyItemBodyMarkdownEditor = lazy(async () => {
  const module = await import("./ItemBodyMarkdownEditor");
  return { default: module.ItemBodyMarkdownEditor };
});

type InboxStuffDetailsProps = Readonly<{
  item: Stuff;
  editing: boolean;
  onAutosaveEditing: (body: ItemBody) => Promise<void>;
  onCommitEditing: (body: ItemBody) => Promise<void>;
  onExitEditingFromNormalMode: (body: ItemBody) => Promise<void>;
  onCancelEditing: () => void;
  onVimModeChange?: (mode: "NORMAL" | "INSERT" | "VISUAL") => void;
  showCreatedMeta?: boolean;
  metaVariant?: "default" | "next-action" | "calendar";
}>;

function initialMetaParts(item: Stuff, showCreatedMeta: boolean): ReactNode[] {
  return showCreatedMeta && item.createdAt ? [`created: ${formatStuffCreatedAt(item.createdAt).toLowerCase()}`] : [];
}

function InboxDetailHeader({ item, showCreatedMeta = true }: Readonly<Pick<InboxStuffDetailsProps, "item" | "showCreatedMeta">>) {
  let metaParts = initialMetaParts(item, showCreatedMeta);
  
  if (item.energy !== undefined && item.energy !== null) {
    metaParts.push(`energy: ${item.energy}`);
  }
  
  if (item.estimatedTime) {
    const hoursPart = item.estimatedTime.hours > 0 ? `${item.estimatedTime.hours}h ` : "";
    metaParts.push(`estimated time: ${hoursPart}${item.estimatedTime.minutes}min`);
  }
   
  if (item.contexts && item.contexts.length > 0) {
    metaParts.push(<ContextMetaList contexts={item.contexts} />);
  }

  if (item.projectTitle) metaParts.push(<ProjectAssociationMarker projectTitle={item.projectTitle} />);

  return (
    <>
      <h1 className="inbox-detail__title">{item.title}</h1>
      <p className="inbox-detail__meta"><MetaParts parts={metaParts} /></p>
      <div className="inbox-detail__divider" />
    </>
  );
}

function ContextMetaList({ contexts }: Readonly<{ contexts: NonNullable<Stuff["contexts"]> }>) {
  return <span className="inbox-detail__context-list">contexts: {contexts.map((context) => <ContextNameWithIcon context={context} key={context.id} />)}</span>;
}

function MetaParts({ parts }: Readonly<{ parts: ReactNode[] }>) {
  return parts.map((part, index) => (
    <span className="inbox-detail__meta-part" key={index}>{index > 0 ? <span className="inbox-detail__meta-separator">|</span> : null}{part}</span>
  ));
}

function estimatedMinutesLabel(item: Stuff): string | null {
  if (!item.estimatedTime) return null;
  return `${item.estimatedTime.hours}h ${item.estimatedTime.minutes}min`;
}

function formatEnergyValue(energy: number): string {
  return energy.toFixed(1);
}

function formatDeadlineDate(deadline?: string | null): string | null {
  if (!deadline) return null;
  const date = new Date(`${deadline}T00:00:00Z`);
  if (isNaN(date.getTime())) return null;
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${day}/${month}/${year}`;
}

function NextActionContextMeta({ item }: Readonly<{ item: Stuff }>) {
  if (!item.contexts || item.contexts.length === 0) return null;
  return <>{item.contexts.map((context) => <span className="next-action-meta__item" key={context.id}><ContextNameWithIcon context={context} /></span>)}</>;
}

function NextActionMetaIcon({ src }: Readonly<{ src: string }>) {
  const style: CSSProperties = {
    WebkitMask: `url("${src}") center / contain no-repeat`,
    mask: `url("${src}") center / contain no-repeat`
  };

  return <span className="next-action-meta__icon" style={style} aria-hidden="true" />;
}

function NextActionDetailHeader({ item }: Readonly<Pick<InboxStuffDetailsProps, "item">>) {
  const estimatedMinutes = estimatedMinutesLabel(item);
  const nextAction = item as NextAction;
  const startedAt = formatScheduleDateTime(nextAction.schedule?.dateStart, nextAction.schedule?.timeStart);
  const endedAt = formatScheduleDateTime(nextAction.schedule?.dateEnd, nextAction.schedule?.timeEnd);
  const deadline = formatDeadlineDate(nextAction.deadline);

  return (
    <>
      <h1 className="inbox-detail__title">{item.title}</h1>
      <div className="next-action-meta" aria-label="Next action properties">
        <NextActionContextMeta item={item} />
        {item.energy !== undefined && item.energy !== null ? <span className="next-action-meta__item"><NextActionMetaIcon src={energyIcon} />{formatEnergyValue(item.energy)}</span> : null}
        {estimatedMinutes ? <span className="next-action-meta__item"><NextActionMetaIcon src={estimatedTimeIcon} />{estimatedMinutes}</span> : null}
        {deadline ? <span className="next-action-meta__item"><NextActionMetaIcon src={scheduleIcon} />{deadline}</span> : null}
        <ProjectAssociationMarker projectTitle={item.projectTitle} />
      </div>
      {(startedAt || endedAt) && (
        <div className="next-action-meta" aria-label="Next action schedule">
          <span className="next-action-meta__item">
            <NextActionMetaIcon src={scheduleIcon} />
            {startedAt}{endedAt ? ` → ${endedAt}` : ""}
          </span>
        </div>
      )}
      <div className="inbox-detail__divider" />
    </>
  );
}

function CalendarDetailHeader({ item }: Readonly<Pick<InboxStuffDetailsProps, "item">>) {
  const metadata = calendarDetailMetadata(item as Calendar);

  return (
    <>
      <h1 className="inbox-detail__title">{metadata.title}</h1>
      <CalendarScheduleMetaRow label="Calendar stated schedule" value={metadata.statedSchedule} />
      <CalendarScheduleMetaRow label="Calendar actual schedule" value={metadata.actualSchedule} />
      <div className="next-action-meta" aria-label="Calendar project">
        <ProjectAssociationMarker projectTitle={item.projectTitle} />
      </div>
      <div className="inbox-detail__divider" />
    </>
  );
}

function CalendarScheduleMetaRow({ label, value }: Readonly<{ label: string; value: string | null }>) {
  if (!value) return null;
  return (
    <div className="next-action-meta" aria-label={label}>
      <span className="next-action-meta__item">
        <NextActionMetaIcon src={scheduleIcon} />
        {value}
      </span>
    </div>
  );
}

function DetailHeader({ item, metaVariant, showCreatedMeta }: Readonly<Pick<InboxStuffDetailsProps, "item" | "metaVariant" | "showCreatedMeta">>) {
  if (metaVariant === "calendar") return <CalendarDetailHeader item={item} />;
  if (metaVariant === "next-action") return <NextActionDetailHeader item={item} />;
  return <InboxDetailHeader item={item} showCreatedMeta={showCreatedMeta} />;
}

const ASSET_TOKEN_PATTERN = /(\[\[asset:([0-9a-fA-F-]{36})]]|\[asset:([0-9a-fA-F-]{36})]|⟦asset:([0-9a-fA-F-]{36})⟧)/g;

function findNextBoundary(marks: ItemBody["inlineMarks"], entities: ItemBody["blockEntities"], currentPos: number, from: number, to: number) {
  return Math.min(
    to, 
    ...marks.flatMap(m => [Math.max(from, m.from), Math.min(to, m.to)]).filter(x => x > currentPos),
    ...entities.flatMap(e => [Math.max(from, e.from), Math.min(to, e.to)]).filter(x => x > currentPos)
  );
}

function renderSegmentEntities(entities: ItemBody["blockEntities"], currentPos: number, nextBoundary: number, from: number, nodes: ReactNode[]) {
  const segmentEntities = entities.filter(e => e.from <= currentPos && e.to >= nextBoundary);
  if (segmentEntities.length === 0) return false;

  const entity = segmentEntities[0];
  if (currentPos === Math.max(from, entity.from)) {
    nodes.push(
      <span key={`entity-${entity.id}-${currentPos}`} className="cm-block-entity">
        {renderBlockEntity(entity, `entity-content-${entity.id}-${currentPos}`)}
      </span>
    );
  }
  return true;
}

function renderSegmentMarks(text: string, marks: ItemBody["inlineMarks"], currentPos: number, nextBoundary: number, nodes: ReactNode[]) {
  const segmentMarks = marks.filter(m => m.from <= currentPos && m.to >= nextBoundary);
  let el: ReactNode = text.substring(currentPos, nextBoundary);
  
  for (const mark of segmentMarks) {
    if (mark.type === "bold") el = <span className="cm-bold-text">{el}</span>;
    else if (mark.type === "italic") el = <span className="cm-italic-text">{el}</span>;
    else if (mark.type === "inlineCode") el = <span className="cm-code-text">{el}</span>;
    else if (mark.type === "link") el = <a href={mark.attrs?.href} className="cm-markdown-link" target="_blank" rel="noreferrer">{el}</a>;
  }
  
  nodes.push(<span key={currentPos}>{el}</span>);
}

function renderInlineBody(text: string, inlineMarks: ItemBody["inlineMarks"], blockEntities: ItemBody["blockEntities"], from: number, to: number) {
  if (from >= to) return null;
  const applicableMarks = inlineMarks.filter(m => Math.max(m.from, from) < Math.min(m.to, to));
  const applicableEntities = blockEntities.filter(e => Math.max(e.from, from) < Math.min(e.to, to));
  const segmentText = text.substring(from, to);
  
  if (applicableMarks.length === 0 && applicableEntities.length === 0) {
    return renderAssetTokens(segmentText, blockEntities);
  }

  const nodes: ReactNode[] = [];
  let currentPos = from;
  while (currentPos < to) {
     const nextBoundary = findNextBoundary(applicableMarks, applicableEntities, currentPos, from, to);
     
     if (nextBoundary === Infinity || nextBoundary <= currentPos) break;
     
     if (!renderSegmentEntities(applicableEntities, currentPos, nextBoundary, from, nodes)) {
       renderSegmentMarks(text, applicableMarks, currentPos, nextBoundary, nodes);
     }
     
     currentPos = nextBoundary;
  }
  return nodes;
}

function renderAssetTokens(value: string, blockEntities: ItemBody["blockEntities"]) {
  const nodes: ReactNode[] = [];
  let currentIndex = 0;
  for (const match of value.matchAll(ASSET_TOKEN_PATTERN)) {
    nodes.push(value.substring(currentIndex, match.index));
    nodes.push(renderAssetToken(match[2] ?? match[3] ?? match[4], blockEntities));
    currentIndex = (match.index ?? 0) + match[0].length;
  }

  nodes.push(value.substring(currentIndex));
  return nodes.length === 1 ? value : nodes;
}

function renderAssetToken(assetId: string, blockEntities: ItemBody["blockEntities"]) {
  const entity = blockEntities.find((candidate) => candidate.assetId === assetId);
  if (!entity) {
    return <a className="cm-markdown-link" href={`#asset-${assetId}`} key={assetId}>[ASSET] {assetId}</a>;
  }

  return renderBlockEntity(entity, assetId);
}

function renderBlockEntity(entity: ItemBody["blockEntities"][number], key: string) {
  if (entity.type === "image" || entity.attrs?.contentType?.startsWith("image/")) {
    return <FilePreview contentType={entity.attrs?.contentType} displayName={entity.attrs?.displayName} fallbackUrl={entity.attrs?.url} key={key} relativePath={entityAssetRelativePath(entity)} />;
  }
  if (isPdfEntity(entity)) {
    return <FilePreview contentType={entity.attrs?.contentType} displayName={entity.attrs?.displayName} fallbackUrl={entity.attrs?.url} key={key} relativePath={entityAssetRelativePath(entity)} />;
  }

  return <a className="cm-markdown-link" href={buildApiUrl(entity.attrs?.url || "")} key={key} rel="noreferrer" target="_blank">[{entity.type.toUpperCase()}] {entity.attrs?.displayName || entity.assetId}</a>;
}

function isPdfEntity(entity: ItemBody["blockEntities"][number]): boolean {
  return entity.attrs?.contentType === "application/pdf" || entity.attrs?.url?.toLowerCase().endsWith(".pdf") === true;
}

function entityAssetRelativePath(entity: ItemBody["blockEntities"][number]): string {
  return entity.attrs?.relativePath ?? entity.attrs?.localPath ?? "";
}

function BodyMarkdownSurface(props: InboxStuffDetailsProps) {
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    if (props.item.bodyLoaded !== false) {
      setLoadError(false);
      return;
    }
    let active = true;
    void ensureItemBodyLoaded(props.item).catch(() => {
      if (active) setLoadError(true);
    });
    return () => {
      active = false;
    };
  }, [props.item.id, props.item.bodyLoaded]);

  if (props.item.bodyLoaded === false) {
    return <p className="pane-state">{loadError ? "Failed to load body." : "Loading body..."}</p>;
  }

  const hasBody = Boolean(props.item.body?.text);
  if (!props.editing && !hasBody) {
    return <p className="pane-state">No details yet for this stuff.</p>;
  }

  const className = props.editing
    ? "inbox-detail__body-surface"
    : "inbox-detail__body inbox-detail__body-preview inbox-detail__body-surface";

  return (
    <div className={className} aria-label="Selected item details">
      <Suspense fallback={<p className="pane-state">Loading body...</p>}>
        <LazyItemBodyMarkdownEditor
          itemId={props.item.id}
          initialBody={props.item.body}
          readOnly={!props.editing}
          onAutosave={props.onAutosaveEditing}
          onSave={props.onCommitEditing}
          onExitNormalMode={props.onExitEditingFromNormalMode}
          onVimModeChange={props.onVimModeChange}
        />
      </Suspense>
    </div>
  );
}

/**
 * Renders selected stuff details with optional body editing controls.
 *
 * @example <InboxStuffDetails item={stuff} editing={false} ... />
 */
export function InboxStuffDetails(props: InboxStuffDetailsProps) {
  return (
    <div className="inbox-detail">
      <DetailHeader item={props.item} metaVariant={props.metaVariant} showCreatedMeta={props.showCreatedMeta} />
      <BodyMarkdownSurface {...props} />
    </div>
  );
}
