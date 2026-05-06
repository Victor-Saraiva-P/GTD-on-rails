import { ItemBodyMarkdownEditor } from "./ItemBodyMarkdownEditor";
import { formatStuffCreatedAt, getStuffBodyPreviewLines, type Stuff, type ItemBody } from "./types";
import { buildApiUrl } from "../../config/env";

type InboxStuffDetailsProps = {
  item: Stuff;
  editing: boolean;
  onAutosaveEditing: (body: ItemBody) => Promise<void>;
  onCommitEditing: (body: ItemBody) => Promise<void>;
  onExitEditingFromNormalMode: (body: ItemBody) => Promise<void>;
  onCancelEditing: () => void;
  onVimModeChange?: (mode: "NORMAL" | "INSERT" | "VISUAL") => void;
};

function InboxDetailHeader({ item }: Pick<InboxStuffDetailsProps, "item">) {
  const createdAtLabel = `created: ${formatStuffCreatedAt(item.createdAt).toLowerCase()}`;

  return (
    <>
      <h1 className="inbox-detail__title">{item.title}</h1>
      <p className="inbox-detail__meta">{createdAtLabel}</p>
      <div className="inbox-detail__divider" />
    </>
  );
}

type EditingInboxStuffDetailsProps = Omit<InboxStuffDetailsProps, "editing" | "onCancelEditing">;

const ASSET_TOKEN_PATTERN = /(\[\[asset:([0-9a-fA-F-]{36})\]\]|\[asset:([0-9a-fA-F-]{36})\]|⟦asset:([0-9a-fA-F-]{36})⟧)/g;

function EditingInboxStuffDetails(props: EditingInboxStuffDetailsProps) {
  return (
    <div className="inbox-detail">
      <InboxDetailHeader item={props.item} />
      <ItemBodyMarkdownEditor
        itemId={props.item.id}
        initialBody={props.item.body}
        onAutosave={props.onAutosaveEditing}
        onSave={props.onCommitEditing}
        onExitNormalMode={props.onExitEditingFromNormalMode}
        onVimModeChange={props.onVimModeChange}
      />
    </div>
  );
}

function renderInlineBody(text: string, inlineMarks: ItemBody["inlineMarks"], blockEntities: ItemBody["blockEntities"], from: number, to: number) {
  if (from >= to) return null;
  const applicableMarks = inlineMarks.filter(m => Math.max(m.from, from) < Math.min(m.to, to));
  const applicableEntities = blockEntities.filter(e => Math.max(e.from, from) < Math.min(e.to, to));
  const segmentText = text.substring(from, to);
  
  if (applicableMarks.length === 0 && applicableEntities.length === 0) {
    return renderAssetTokens(segmentText, blockEntities);
  }

  const nodes = [];
  let currentPos = from;
  while (currentPos < to) {
     const nextBoundary = Math.min(to, 
       ...applicableMarks.flatMap(m => [Math.max(from, m.from), Math.min(to, m.to)]).filter(x => x > currentPos),
       ...applicableEntities.flatMap(e => [Math.max(from, e.from), Math.min(to, e.to)]).filter(x => x > currentPos)
     );
     
     if (nextBoundary === Infinity || nextBoundary <= currentPos) break;
     
     const segmentEntities = applicableEntities.filter(e => e.from <= currentPos && e.to >= nextBoundary);
     if (segmentEntities.length > 0) {
       const entity = segmentEntities[0];
       if (currentPos === Math.max(from, entity.from)) {
         nodes.push(
           <span key={`entity-${entity.id}-${currentPos}`} className="cm-block-entity">
             {entity.type === "image" ? (
               <img src={buildApiUrl(entity.attrs?.url || "")} alt={entity.attrs?.displayName || "image"} className="cm-markdown-image" />
             ) : (
               <a href={buildApiUrl(entity.attrs?.url || "")} className="cm-markdown-link" target="_blank" rel="noreferrer">
                 [{entity.type.toUpperCase()}] {entity.attrs?.displayName}
               </a>
             )}
           </span>
         );
       }
       currentPos = nextBoundary;
       continue;
     }

     const segmentMarks = applicableMarks.filter(m => m.from <= currentPos && m.to >= nextBoundary);
     
     let el: React.ReactNode = text.substring(currentPos, nextBoundary);
     for (const mark of segmentMarks) {
        if (mark.type === "bold") el = <span className="cm-bold-text">{el}</span>;
        else if (mark.type === "italic") el = <span className="cm-italic-text">{el}</span>;
        else if (mark.type === "inlineCode") el = <span className="cm-code-text">{el}</span>;
        else if (mark.type === "link") el = <a href={mark.attrs?.href} className="cm-markdown-link" target="_blank" rel="noreferrer">{el}</a>;
     }
     
     nodes.push(<span key={currentPos}>{el}</span>);
     currentPos = nextBoundary;
  }
  return nodes;
}

function renderAssetTokens(value: string, blockEntities: ItemBody["blockEntities"]) {
  const nodes: React.ReactNode[] = [];
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
    return <img alt={entity.attrs?.displayName || "image"} className="cm-markdown-image" key={key} src={buildApiUrl(entity.attrs?.url || "")} />;
  }
  if (isPdfEntity(entity)) {
    return <PdfPreview entity={entity} key={key} />;
  }

  return <a className="cm-markdown-link" href={buildApiUrl(entity.attrs?.url || "")} key={key} rel="noreferrer" target="_blank">[{entity.type.toUpperCase()}] {entity.attrs?.displayName || entity.assetId}</a>;
}

function isPdfEntity(entity: ItemBody["blockEntities"][number]): boolean {
  return entity.attrs?.contentType === "application/pdf" || entity.attrs?.url?.toLowerCase().endsWith(".pdf") === true;
}

function PdfPreview({ entity }: { entity: ItemBody["blockEntities"][number] }) {
  const url = buildApiUrl(entity.attrs?.url || "");
  return (
    <figure className="cm-pdf-preview">
      <object className="cm-pdf-preview__frame" data={`${url}#page=1&toolbar=0&navpanes=0&scrollbar=0`} type="application/pdf">
        <a className="cm-markdown-link" href={url} rel="noreferrer" target="_blank">Open PDF</a>
      </object>
    </figure>
  );
}

function ReadOnlyInboxStuffDetails({ item }: Pick<InboxStuffDetailsProps, "item">) {
  const body = item.body;

  if (!body || !body.text) {
    return (
      <div className="inbox-detail">
        <InboxDetailHeader item={item} />
        <p className="pane-state">No details yet for this stuff.</p>
      </div>
    );
  }

  const lines = getStuffBodyPreviewLines(body);
  const docLength = body.text.length;

  return (
    <div className="inbox-detail">
      <InboxDetailHeader item={item} />
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

  return <ReadOnlyInboxStuffDetails item={props.item} />;
}
