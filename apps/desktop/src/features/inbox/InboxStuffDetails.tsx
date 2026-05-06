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

function renderInlineBody(text: string, inlineMarks: ItemBody["inlineMarks"], from: number, to: number) {
  if (from >= to) return null;
  const applicableMarks = inlineMarks.filter(m => Math.max(m.from, from) < Math.min(m.to, to));
  
  if (applicableMarks.length === 0) {
    return text.substring(from, to);
  }

  // Simplified renderer: split into segments and render. This assumes marks don't partially overlap in a way that breaks React. 
  // It's better to just render characters individually to handle overlaps gracefully.
  const nodes = [];
  let currentPos = from;
  while (currentPos < to) {
     const nextBoundary = Math.min(to, ...applicableMarks.flatMap(m => [Math.max(from, m.from), Math.min(to, m.to)]).filter(x => x > currentPos));
     
     if (nextBoundary === Infinity || nextBoundary <= currentPos) break; // Should not happen
     
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
                   {renderInlineBody(body.text, body.inlineMarks, from, to)}
                 </span>
               </div>
             );
           }
           if (block?.type === "heading2") {
             return (
               <div className="inbox-detail__body-line" key={index}>
                 <span className="inbox-detail__line-number">{index + 1}</span>
                 <span className="inbox-detail__line-content cm-md-heading-2">
                   {renderInlineBody(body.text, body.inlineMarks, from, to)}
                 </span>
               </div>
             );
           }
           if (block?.type === "heading3") {
             return (
               <div className="inbox-detail__body-line" key={index}>
                 <span className="inbox-detail__line-number">{index + 1}</span>
                 <span className="inbox-detail__line-content cm-md-heading-3">
                   {renderInlineBody(body.text, body.inlineMarks, from, to)}
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
                   {renderInlineBody(body.text, body.inlineMarks, from + indentStr.length, to)}
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
                     {renderInlineBody(body.text, body.inlineMarks, from + indentStr.length, to)}
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
                   {renderInlineBody(body.text, body.inlineMarks, from + indentStr.length, to)}
                 </span>
               </div>
             );
           }

           // Check for entity block rendering on this line
           if (lineEntities.length > 0 && lineText.trim().startsWith("⟦asset:")) {
              const entity = lineEntities[0];
              return (
               <div className="inbox-detail__body-line" key={index}>
                 <span className="inbox-detail__line-number">{index + 1}</span>
                 <span className="inbox-detail__line-content cm-block-entity">
                   {entity.type === "image" ? (
                     <img src={buildApiUrl(entity.attrs?.url || "")} alt={entity.attrs?.displayName || "image"} className="cm-markdown-image" />
                   ) : (
                     <a href={buildApiUrl(entity.attrs?.url || "")} className="cm-markdown-link" target="_blank" rel="noreferrer">
                       [{entity.type.toUpperCase()}] {entity.attrs?.displayName}
                     </a>
                   )}
                 </span>
               </div>
             );
           }

           return (
             <div className="inbox-detail__body-line" key={index}>
               <span className="inbox-detail__line-number">{index + 1}</span>
               <span className="inbox-detail__line-content">
                 {lineText ? renderInlineBody(body.text, body.inlineMarks, from, to) : "\u00A0"}
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
