import { lazy, Suspense, type CSSProperties, type ReactNode } from "react";
import energyIcon from "../../assets/next-actions/energy icon.png";
import estimatedTimeIcon from "../../assets/next-actions/estimated time icon.png";
import scheduleIcon from "../../assets/next-actions/schdule-icon.png";
import { FilePreview } from "./FilePreview";
import { formatStuffCreatedAt, getStuffBodyPreviewLines, type Stuff, type ItemBody } from "./types";
import { formatScheduleDateTime, type NextAction } from "../next-actions/types";
import { buildApiUrl } from "../../config/env";
import { ContextNameWithIcon } from "../contexts/ContextNameWithIcon";

const LazyItemBodyMarkdownEditor = lazy(async () => {
  const module = await import("./ItemBodyMarkdownEditor");
  return { default: module.ItemBodyMarkdownEditor };
});

type InboxStuffDetailsProps = {
  item: Stuff;
  editing: boolean;
  onAutosaveEditing: (body: ItemBody) => Promise<void>;
  onCommitEditing: (body: ItemBody) => Promise<void>;
  onExitEditingFromNormalMode: (body: ItemBody) => Promise<void>;
  onCancelEditing: () => void;
  onVimModeChange?: (mode: "NORMAL" | "INSERT" | "VISUAL") => void;
  showCreatedMeta?: boolean;
  metaVariant?: "default" | "next-action";
};

function initialMetaParts(item: Stuff, showCreatedMeta: boolean): ReactNode[] {
  return showCreatedMeta && item.createdAt ? [`created: ${formatStuffCreatedAt(item.createdAt).toLowerCase()}`] : [];
}

function InboxDetailHeader({ item, showCreatedMeta = true }: Pick<InboxStuffDetailsProps, "item" | "showCreatedMeta">) {
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

  return (
    <>
      <h1 className="inbox-detail__title">{item.title}</h1>
      <p className="inbox-detail__meta"><MetaParts parts={metaParts} /></p>
      <div className="inbox-detail__divider" />
    </>
  );
}

function ContextMetaList({ contexts }: { contexts: NonNullable<Stuff["contexts"]> }) {
  return <span className="inbox-detail__context-list">contexts: {contexts.map((context) => <ContextNameWithIcon context={context} key={context.id} />)}</span>;
}

function MetaParts({ parts }: { parts: ReactNode[] }) {
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
  return new Intl.DateTimeFormat("en-US", { year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

function NextActionContextMeta({ item }: { item: Stuff }) {
  if (!item.contexts || item.contexts.length === 0) return null;
  return <>{item.contexts.map((context) => <span className="next-action-meta__item" key={context.id}><ContextNameWithIcon context={context} /></span>)}</>;
}

function NextActionMetaIcon({ src }: { src: string }) {
  const style: CSSProperties = {
    WebkitMask: `url("${src}") center / contain no-repeat`,
    mask: `url("${src}") center / contain no-repeat`
  };

  return <span className="next-action-meta__icon" style={style} aria-hidden="true" />;
}

function NextActionDetailHeader({ item }: Pick<InboxStuffDetailsProps, "item">) {
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

function DetailHeader({ item, metaVariant, showCreatedMeta }: Pick<InboxStuffDetailsProps, "item" | "metaVariant" | "showCreatedMeta">) {
  if (metaVariant === "next-action") return <NextActionDetailHeader item={item} />;
  return <InboxDetailHeader item={item} showCreatedMeta={showCreatedMeta} />;
}

type EditingInboxStuffDetailsProps = Omit<InboxStuffDetailsProps, "editing" | "onCancelEditing">;

const ASSET_TOKEN_PATTERN = /(\[\[asset:([0-9a-fA-F-]{36})]]|\[asset:([0-9a-fA-F-]{36})]|⟦asset:([0-9a-fA-F-]{36})⟧)/g;

function EditingInboxStuffDetails(props: EditingInboxStuffDetailsProps) {
  return (
    <div className="inbox-detail">
      <DetailHeader item={props.item} metaVariant={props.metaVariant} showCreatedMeta={props.showCreatedMeta} />
      <Suspense fallback={<p className="pane-state">Loading editor...</p>}>
        <LazyItemBodyMarkdownEditor
          itemId={props.item.id}
          initialBody={props.item.body}
          onAutosave={props.onAutosaveEditing}
          onSave={props.onCommitEditing}
          onExitNormalMode={props.onExitEditingFromNormalMode}
          onVimModeChange={props.onVimModeChange}
        />
      </Suspense>
    </div>
  );
}

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

function ReadOnlyInboxStuffDetails({ item, metaVariant, showCreatedMeta }: Pick<InboxStuffDetailsProps, "item" | "metaVariant" | "showCreatedMeta">) {
  const body = item.body;

  if (!body || !body.text) {
    return (
      <div className="inbox-detail">
        <DetailHeader item={item} metaVariant={metaVariant} showCreatedMeta={showCreatedMeta} />
        <p className="pane-state">No details yet for this stuff.</p>
      </div>
    );
  }

  const lines = getStuffBodyPreviewLines(body);
  const docLength = body.text.length;

  return (
    <div className="inbox-detail">
      <DetailHeader item={item} metaVariant={metaVariant} showCreatedMeta={showCreatedMeta} />
      <div className="inbox-detail__body inbox-detail__body-preview" aria-label="Selected item details">
        {lines.map((lineText, index) => {
           // To get exact character offset for each line, we could accumulate lengths.
           const from = body.text.split("\n").slice(0, index).join("\n").length + (index > 0 ? 1 : 0);
           const to = from + lineText.length;
           
           const blocks = body.lineBlocks.filter(b => b.from <= to && b.from >= from);
           const block = blocks[0]; // assuming one block per line max for rendering
           
           const lineEntities = body.blockEntities.filter(e => e.from >= from && e.to <= to);

           if (block?.type === "heading1") {
             return (
               <div className="inbox-detail__body-line" key={index}>
                 <span className="inbox-detail__line-number">{index + 1}</span>
                 <span className="inbox-detail__line-content cm-md-heading-1">
                   {renderInlineBody(body.text, body.inlineMarks, body.blockEntities, from, to)}
                 </span>
               </div>
             );
           }
           if (block?.type === "heading2") {
             return (
               <div className="inbox-detail__body-line" key={index}>
                 <span className="inbox-detail__line-number">{index + 1}</span>
                 <span className="inbox-detail__line-content cm-md-heading-2">
                   {renderInlineBody(body.text, body.inlineMarks, body.blockEntities, from, to)}
                 </span>
               </div>
             );
           }
           if (block?.type === "heading3") {
             return (
               <div className="inbox-detail__body-line" key={index}>
                 <span className="inbox-detail__line-number">{index + 1}</span>
                 <span className="inbox-detail__line-content cm-md-heading-3">
                   {renderInlineBody(body.text, body.inlineMarks, body.blockEntities, from, to)}
                 </span>
               </div>
             );
           }
           if (block?.type === "bullet") {
             const indentStr = lineText.match(/^\s*/)?.[0] ?? "";
             const level = Math.floor(indentStr.length / 2) % 3;
             return (
               <div className="inbox-detail__body-line" key={index}>
                 <span className="inbox-detail__line-number">{index + 1}</span>
                 <span className="inbox-detail__line-content">
                   {indentStr}<span className={`cm-bullet-mark cm-bullet-level-${level}`}>• </span>
                   {renderInlineBody(body.text, body.inlineMarks, body.blockEntities, from + indentStr.length, to)}
                 </span>
               </div>
             );
           }
           if (block?.type === "numbered") {
             const indentStr = lineText.match(/^\s*/)?.[0] ?? "";
             return (
               <div className="inbox-detail__body-line" key={index}>
                 <span className="inbox-detail__line-number">{index + 1}</span>
                 <span className="inbox-detail__line-content">
                   {indentStr}<span className="cm-numbered-mark">1. </span>
                   {renderInlineBody(body.text, body.inlineMarks, body.blockEntities, from + indentStr.length, to)}
                 </span>
               </div>
             );
           }
           if (block?.type === "lettered") {
             const indentStr = lineText.match(/^\s*/)?.[0] ?? "";
             return (
               <div className="inbox-detail__body-line" key={index}>
                 <span className="inbox-detail__line-number">{index + 1}</span>
                 <span className="inbox-detail__line-content">
                   {indentStr}<span className="cm-lettered-mark">a. </span>
                   {renderInlineBody(body.text, body.inlineMarks, body.blockEntities, from + indentStr.length, to)}
                 </span>
               </div>
             );
           }
           if (block?.type === "checklist") {
             const indentStr = lineText.match(/^\s*/)?.[0] ?? "";
             const isChecked = block.attrs?.checked ?? false;
             return (
               <div className="inbox-detail__body-line" key={index}>
                 <span className="inbox-detail__line-number">{index + 1}</span>
                 <span className="inbox-detail__line-content">
                   {indentStr}
                   <span className={isChecked ? "cm-checklist-box cm-checklist-box--checked" : "cm-checklist-box"} />
                   <span className={isChecked ? "cm-checklist-text cm-checklist-text--checked" : "cm-checklist-text"}>
                     {renderInlineBody(body.text, body.inlineMarks, body.blockEntities, from + indentStr.length, to)}
                   </span>
                 </span>
               </div>
             );
           }
           if (block?.type === "divider") {
             return (
               <div className="inbox-detail__body-line" key={index}>
                 <span className="inbox-detail__line-number">{index + 1}</span>
                 <span className="inbox-detail__line-content">
                   <span className="cm-divider" />
                 </span>
               </div>
             );
           }
           if (block?.type === "quote") {
             const indentStr = lineText.match(/^\s*/)?.[0] ?? "";
             return (
               <div className="inbox-detail__body-line" key={index}>
                 <span className="inbox-detail__line-number">{index + 1}</span>
                 <span className="inbox-detail__line-content cm-quote-line">
                   {indentStr}<span className="cm-quote-mark">▌ </span>
                   {renderInlineBody(body.text, body.inlineMarks, body.blockEntities, from + indentStr.length, to)}
                 </span>
               </div>
             );
           }

           return (
             <div className="inbox-detail__body-line" key={index}>
               <span className="inbox-detail__line-number">{index + 1}</span>
               <span className="inbox-detail__line-content">
                 {lineText ? renderInlineBody(body.text, body.inlineMarks, body.blockEntities, from, to) : "\u00A0"}
               </span>
             </div>
           );
        })}
      </div>
    </div>
  );
}

/**
 * Renders selected stuff details with optional body editing controls.
 *
 * @example <InboxStuffDetails item={stuff} editing={false} ... />
 */
export function InboxStuffDetails(props: InboxStuffDetailsProps) {
  if (props.editing) {
    return <EditingInboxStuffDetails {...props} />;
  }

  return <ReadOnlyInboxStuffDetails item={props.item} metaVariant={props.metaVariant} showCreatedMeta={props.showCreatedMeta} />;
}
