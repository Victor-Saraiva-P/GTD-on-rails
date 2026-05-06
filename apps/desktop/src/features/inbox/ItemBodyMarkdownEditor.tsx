import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { EditorSelection, RangeSetBuilder, StateEffect, StateField } from "@codemirror/state";
import { EditorState } from "@codemirror/state";
import { Decoration, drawSelection, EditorView, highlightActiveLine, keymap, lineNumbers, ViewPlugin, WidgetType, type ViewUpdate, type DecorationSet } from "@codemirror/view";
import { getCM, Vim, vim, type CodeMirrorV } from "@replit/codemirror-vim";
import { useEffect, useRef, useState, type MutableRefObject, type RefObject } from "react";
import { normalizeBodyForClient, mapBodyRangesThroughChanges, toggleInlineMark, setLineBlock, toggleChecklist, insertBlockEntity, clearLineBlock, applyInlineMark } from "./itemBodyUtils";
import { type ItemBody, type BlockEntity } from "./types";
import { buildApiUrl } from "../../config/env";
import { INSERT_MARKDOWN_LINK_EVENT, type InsertMarkdownLinkEventDetail } from "./markdownLinks";
import { INSERT_BLOCK_ENTITY_EVENT, type InsertBlockEntityEventDetail } from "./MarkdownAssetComboDialog";

export type MarkdownBodySaveState = "saved" | "unsaved" | "saving" | "error";

export type ItemBodyMarkdownEditorProps = {
  itemId: string;
  initialBody?: ItemBody | null;
  readOnly?: boolean;
  onAutosave?: (body: ItemBody) => Promise<void>;
  onSave?: (body: ItemBody) => Promise<void>;
  onExitNormalMode?: (body: ItemBody) => Promise<void>;
  onVimModeChange?: (mode: "NORMAL" | "INSERT" | "VISUAL") => void;
};

export const FORMAT_BULLET_EVENT = "gtd:format-bullet";
export const FORMAT_HEADING_EVENT = "gtd:format-heading";
export const FORMAT_NUMBERED_LIST_EVENT = "gtd:format-numbered-list";
export const FORMAT_NORMAL_TEXT_EVENT = "gtd:format-normal-text";
export const FORMAT_LETTERED_LIST_EVENT = "gtd:format-lettered-list";
export const FORMAT_CHECKLIST_EVENT = "gtd:format-checklist";
export const FORMAT_CHECKLIST_CHECKED_EVENT = "gtd:format-checklist-checked";
export const FORMAT_CHECKLIST_UNCHECKED_EVENT = "gtd:format-checklist-unchecked";
export const FORMAT_DIVIDER_EVENT = "gtd:format-divider";
export const FORMAT_QUOTE_EVENT = "gtd:format-quote";
export const FORMAT_BOLD_EVENT = "gtd:format-bold";
export const FORMAT_ITALIC_EVENT = "gtd:format-italic";
export const FORMAT_CODE_EVENT = "gtd:format-code";
export const FORMAT_CLEAR_INLINE_EVENT = "gtd:format-clear-inline";

type AutosaveTracker = {
  hasUnsavedChanges: boolean;
  isSaving: boolean;
  lastInsertExitAt: number | null;
  lastInsertMode: boolean | null;
  changeId: number;
};

const cursorCache = new Map<string, any>();

export const itemBodyStateEffect = StateEffect.define<ItemBody>();

export const itemBodyStateField = StateField.define<ItemBody>({
  create() {
    return { text: "", inlineMarks: [], lineBlocks: [], blockEntities: [] };
  },
  update(value, tr) {
    let nextValue = mapBodyRangesThroughChanges(value, tr.changes);
    for (const e of tr.effects) {
      if (e.is(itemBodyStateEffect)) {
        nextValue = { ...nextValue, ...e.value };
      }
    }
    nextValue.text = tr.state.doc.toString();
    return nextValue;
  }
});

class BlockEntityWidget extends WidgetType {
  constructor(private entity: BlockEntity) {
    super();
  }

  eq(other: BlockEntityWidget): boolean {
    return this.entity.id === other.entity.id;
  }

  toDOM(): HTMLElement {
    const el = document.createElement("span");
    el.className = "cm-block-entity";
    
    if (this.entity.type === "image") {
      const img = document.createElement("img");
      img.src = buildApiUrl(this.entity.attrs?.url || "");
      img.alt = this.entity.attrs?.displayName || "image";
      img.className = "cm-markdown-image";
      el.appendChild(img);
    } else {
      const link = document.createElement("a");
      link.href = buildApiUrl(this.entity.attrs?.url || "");
      link.textContent = `[${this.entity.type.toUpperCase()}] ${this.entity.attrs?.displayName}`;
      link.className = "cm-markdown-link";
      link.target = "_blank";
      el.appendChild(link);
    }
    return el;
  }
}

class MarkdownLinkWidget extends WidgetType {
  constructor(private text: string, private url: string) {
    super();
  }

  eq(other: MarkdownLinkWidget): boolean {
    return this.text === other.text && this.url === other.url;
  }

  toDOM(): HTMLElement {
    const link = document.createElement("a");
    link.className = "cm-markdown-link";
    link.href = this.url;
    link.rel = "noreferrer";
    link.target = "_blank";
    link.textContent = this.text;
    return link;
  }
}

class ChecklistBoxWidget extends WidgetType {
  constructor(private checked: boolean) {
    super();
  }

  eq(other: ChecklistBoxWidget): boolean {
    return this.checked === other.checked;
  }

  toDOM(): HTMLElement {
    const box = document.createElement("span");
    box.className = this.checked ? "cm-checklist-box cm-checklist-box--checked" : "cm-checklist-box";
    return box;
  }
}

class DividerWidget extends WidgetType {
  toDOM(): HTMLElement {
    const divider = document.createElement("span");
    divider.className = "cm-divider";
    return divider;
  }
}

const itemBodyDecorationsPlugin = ViewPlugin.fromClass(class {
  decorations: DecorationSet;
  constructor(view: EditorView) {
    this.decorations = this.build(view);
  }
  update(update: ViewUpdate) {
    if (update.docChanged || update.viewportChanged || update.selectionSet) {
      this.decorations = this.build(update.view);
    }
  }
  build(view: EditorView) {
    const body = view.state.field(itemBodyStateField);
    const builder = new RangeSetBuilder<Decoration>();
    const docLength = view.state.doc.length;
    const decos: {from: number, to: number, deco: Decoration}[] = [];

    for (const block of body.lineBlocks) {
      if (block.from > docLength) continue;
      const validFrom = Math.max(0, block.from);
      
      const line = view.state.doc.lineAt(validFrom);

      if (block.type === "heading1") {
        decos.push({from: line.from, to: line.from, deco: Decoration.line({class: "cm-md-heading-1"})});
      } else if (block.type === "heading2") {
        decos.push({from: line.from, to: line.from, deco: Decoration.line({class: "cm-md-heading-2"})});
      } else if (block.type === "heading3") {
        decos.push({from: line.from, to: line.from, deco: Decoration.line({class: "cm-md-heading-3"})});
      } else if (block.type === "bullet") {
        decos.push({from: line.from, to: line.from, deco: Decoration.line({class: "cm-bullet-line"})});
        const textIndent = line.text.match(/^\s*/)?.[0].length || 0;
        const level = Math.floor(textIndent / 2) % 3;
        decos.push({
          from: line.from + textIndent,
          to: line.from + textIndent,
          deco: Decoration.widget({
            widget: new class extends WidgetType {
              toDOM() {
                const el = document.createElement("span");
                el.className = `cm-bullet-mark cm-bullet-level-${level}`;
                el.textContent = "• ";
                return el;
              }
            }()
          })
        });
      } else if (block.type === "checklist") {
        const textIndent = line.text.match(/^\s*/)?.[0].length || 0;
        decos.push({
          from: line.from + textIndent,
          to: line.from + textIndent,
          deco: Decoration.widget({
            widget: new ChecklistBoxWidget(block.attrs?.checked ?? false)
          })
        });
        const textDeco = block.attrs?.checked ? "cm-checklist-text cm-checklist-text--checked" : "cm-checklist-text";
        decos.push({from: line.from, to: line.from, deco: Decoration.line({class: textDeco})});
      } else if (block.type === "divider") {
        decos.push({
          from: line.from,
          to: line.to,
          deco: Decoration.replace({widget: new DividerWidget()})
        });
      } else if (block.type === "quote") {
        decos.push({from: line.from, to: line.from, deco: Decoration.line({class: "cm-quote-line"})});
        const textIndent = line.text.match(/^\s*/)?.[0].length || 0;
        decos.push({
          from: line.from + textIndent,
          to: line.from + textIndent,
          deco: Decoration.widget({
            widget: new class extends WidgetType {
              toDOM() {
                const el = document.createElement("span");
                el.className = "cm-quote-mark";
                el.textContent = "▌ ";
                return el;
              }
            }()
          })
        });
      } else if (block.type === "numbered") {
        const textIndent = line.text.match(/^\s*/)?.[0].length || 0;
        decos.push({
          from: line.from + textIndent,
          to: line.from + textIndent,
          deco: Decoration.widget({
            widget: new class extends WidgetType {
              toDOM() {
                const el = document.createElement("span");
                el.className = "cm-numbered-mark";
                el.textContent = "1. ";
                return el;
              }
            }()
          })
        });
      } else if (block.type === "lettered") {
        const textIndent = line.text.match(/^\s*/)?.[0].length || 0;
        decos.push({
          from: line.from + textIndent,
          to: line.from + textIndent,
          deco: Decoration.widget({
            widget: new class extends WidgetType {
              toDOM() {
                const el = document.createElement("span");
                el.className = "cm-lettered-mark";
                el.textContent = "a. ";
                return el;
              }
            }()
          })
        });
      }
    }

    for (const mark of body.inlineMarks) {
      if (mark.from >= docLength) continue;
      const validFrom = Math.max(0, mark.from);
      const validTo = Math.min(docLength, mark.to);
      if (validFrom >= validTo) continue;

      if (mark.type === "bold") {
        decos.push({from: validFrom, to: validTo, deco: Decoration.mark({class: "cm-bold-text"})});
      } else if (mark.type === "italic") {
        decos.push({from: validFrom, to: validTo, deco: Decoration.mark({class: "cm-italic-text"})});
      } else if (mark.type === "inlineCode") {
        decos.push({from: validFrom, to: validTo, deco: Decoration.mark({class: "cm-code-text"})});
      } else if (mark.type === "link") {
        decos.push({from: validFrom, to: validTo, deco: Decoration.replace({widget: new MarkdownLinkWidget(view.state.sliceDoc(validFrom, validTo), mark.attrs?.href || "")})});
      }
    }

    for (const entity of body.blockEntities) {
      if (entity.from > docLength) continue;
      const validFrom = Math.max(0, entity.from);
      const validTo = Math.min(docLength, entity.to);
      if (validFrom >= validTo) continue;
      decos.push({from: validFrom, to: validTo, deco: Decoration.replace({widget: new BlockEntityWidget(entity)})});
    }

    decos.sort((a,b) => {
      if (a.from !== b.from) return a.from - b.from;
      const isLineA = a.deco.spec.line ? 1 : 0;
      const isLineB = b.deco.spec.line ? 1 : 0;
      if (isLineA !== isLineB) return isLineB - isLineA;
      return a.to - b.to;
    });
    
    for (const {from, to, deco} of decos) {
      if (from <= to) {
         try {
           builder.add(from, to, deco);
         } catch (e) {
           // ignore overlapping replace/widget errors for safety
         }
      }
    }
    return builder.finish();
  }
}, {decorations: v => v.decorations});


export function ItemBodyMarkdownEditor(props: ItemBodyMarkdownEditorProps) {
  const editorParentRef = useRef<HTMLDivElement | null>(null);
  const [, setSaveState] = useState<MarkdownBodySaveState>("saved");
  const onAutosaveRef = useLatestCallbackRef(props.onAutosave);
  const onSaveRef = useLatestCallbackRef(props.onSave);
  const onExitNormalModeRef = useLatestCallbackRef(props.onExitNormalMode);
  const onVimModeChangeRef = useLatestCallbackRef(props.onVimModeChange);
  const autosaveTrackerRef = useRef<AutosaveTracker>({
    hasUnsavedChanges: false,
    isSaving: false,
    lastInsertExitAt: null,
    lastInsertMode: null,
    changeId: 0
  });

  useCodeMirrorEditorView(
    editorParentRef,
    props,
    autosaveTrackerRef,
    onAutosaveRef,
    onSaveRef,
    onExitNormalModeRef,
    onVimModeChangeRef,
    setSaveState
  );

  return (
    <div className="inbox-detail__markdown-editor">
      <div ref={editorParentRef} className="inbox-detail__codemirror" />
    </div>
  );
}

function useLatestCallbackRef<T>(callback: T) {
  const callbackRef = useRef(callback);
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);
  return callbackRef;
}

function dispatchFormatToEditor(view: EditorView, updater: (body: ItemBody, from: number, to: number) => ItemBody) {
  let body = view.state.field(itemBodyStateField);
  for (const range of view.state.selection.ranges) {
    const startLine = view.state.doc.lineAt(range.from);
    const endLine = view.state.doc.lineAt(range.to);
    for (let i = startLine.number; i <= endLine.number; i++) {
       const line = view.state.doc.line(i);
       body = updater(body, line.from, line.to);
    }
  }
  view.dispatch({
    effects: itemBodyStateEffect.of(body)
  });
  exitVisualModeAfterFormatting(view);
}

function dispatchInlineFormatToEditor(view: EditorView, updater: (body: ItemBody, from: number, to: number) => ItemBody) {
  let body = view.state.field(itemBodyStateField);
  for (const range of view.state.selection.ranges) {
    if (!range.empty) {
      body = updater(body, range.from, range.to);
    }
  }
  view.dispatch({
    effects: itemBodyStateEffect.of(body)
  });
  exitVisualModeAfterFormatting(view);
}

function exitVisualModeAfterFormatting(view: EditorView) {
  const cm = getCM(view);
  if (cm?.state?.vim?.visualMode) {
    Vim.exitVisualMode(cm as CodeMirrorV);
  }
}

function useCodeMirrorEditorView(
  editorParentRef: RefObject<HTMLDivElement | null>,
  props: ItemBodyMarkdownEditorProps,
  autosaveTrackerRef: MutableRefObject<AutosaveTracker>,
  onAutosaveRef: MutableRefObject<ItemBodyMarkdownEditorProps["onAutosave"]>,
  onSaveRef: MutableRefObject<ItemBodyMarkdownEditorProps["onSave"]>,
  onExitNormalModeRef: MutableRefObject<ItemBodyMarkdownEditorProps["onExitNormalMode"]>,
  onVimModeChangeRef: MutableRefObject<ItemBodyMarkdownEditorProps["onVimModeChange"]>,
  setSaveState: (state: MarkdownBodySaveState) => void
) {
  const editorViewRef = useRef<EditorView | null>(null);
  
  useEffect(() => {
    autosaveTrackerRef.current = {
      hasUnsavedChanges: false,
      isSaving: false,
      lastInsertExitAt: null,
      lastInsertMode: null,
      changeId: 0
    };
    if (!editorParentRef.current) return;
    
    const body = normalizeBodyForClient(props.initialBody);
    let selection;
    if (cursorCache.has(props.itemId)) {
      try {
        selection = EditorSelection.fromJSON(cursorCache.get(props.itemId));
        for (const range of selection.ranges) {
          if (range.from > body.text.length || range.to > body.text.length) {
            selection = undefined;
            break;
          }
        }
      } catch {
        selection = undefined;
      }
    }

    const view = new EditorView({
      parent: editorParentRef.current,
      state: EditorState.create({
        doc: body.text,
        selection,
        extensions: [
          itemBodyStateField.init(() => body),
          vim(),
          lineNumbers(),
          history(),
          drawSelection(),
          highlightActiveLine(),
          EditorState.readOnly.of(props.readOnly === true),
          EditorView.editable.of(!props.readOnly),
          EditorView.lineWrapping,
          itemBodyDecorationsPlugin,
          EditorView.updateListener.of((update) => {
            if (update.selectionSet || update.docChanged) {
              cursorCache.set(props.itemId, update.state.selection.toJSON());
            }
            autosaveAfterFinishedEdit(update.view, update.docChanged || update.transactions.some(tr => tr.effects.some(e => e.is(itemBodyStateEffect))), props.readOnly === true, autosaveTrackerRef, onAutosaveRef, onVimModeChangeRef, setSaveState);
          }),
          EditorView.domEventHandlers({
            keydown: (event, v) => {
              const isEscape = event.key === "Escape";
              const isCtrlH = event.key === "h" && event.ctrlKey;
              if (props.readOnly || (!isEscape && !isCtrlH) || getCM(v)?.state?.vim?.insertMode !== false) {
                return false;
              }
              event.preventDefault();
              void saveAndExitOnNormalMode(v, onSaveRef.current, onExitNormalModeRef.current, setSaveState);
              return true;
            }
          }),
          keymap.of([{ key: "Mod-s", run: () => {
             saveMarkdownBody(onAutosaveRef.current ?? onSaveRef.current, editorViewRef.current?.state.field(itemBodyStateField) as ItemBody, setSaveState);
             return true;
          } }]),
          keymap.of([...historyKeymap, ...defaultKeymap])
        ]
      })
    });
    
    editorViewRef.current = view;
    if (!props.readOnly) view.focus();
    const initialMode = getCM(view)?.state?.vim?.insertMode ? "INSERT" : "NORMAL";
    view.contentDOM.dataset.vimMode = initialMode === "INSERT" ? "insert" : "normal";
    onVimModeChangeRef.current?.(initialMode);

    return () => {
      view.destroy();
      editorViewRef.current = null;
    };
  }, [props.itemId, props.readOnly]);

  useEffect(() => {
    const handlers: Record<string, EventListener> = {
      [FORMAT_BULLET_EVENT]: () => {
        if (editorViewRef.current) dispatchFormatToEditor(editorViewRef.current, (b, from, to) => setLineBlock(b, "bullet", from, to));
      },
      [FORMAT_NUMBERED_LIST_EVENT]: () => {
        if (editorViewRef.current) dispatchFormatToEditor(editorViewRef.current, (b, from, to) => setLineBlock(b, "numbered", from, to));
      },
      [FORMAT_LETTERED_LIST_EVENT]: () => {
        if (editorViewRef.current) dispatchFormatToEditor(editorViewRef.current, (b, from, to) => setLineBlock(b, "lettered", from, to));
      },
      [FORMAT_CHECKLIST_EVENT]: () => {
        if (editorViewRef.current) dispatchFormatToEditor(editorViewRef.current, (b, from, to) => toggleChecklist(b, from, to, false));
      },
      [FORMAT_CHECKLIST_CHECKED_EVENT]: () => {
        if (editorViewRef.current) dispatchFormatToEditor(editorViewRef.current, (b, from, to) => toggleChecklist(b, from, to, true));
      },
      [FORMAT_CHECKLIST_UNCHECKED_EVENT]: () => {
        if (editorViewRef.current) dispatchFormatToEditor(editorViewRef.current, (b, from, to) => toggleChecklist(b, from, to, false));
      },
      [FORMAT_DIVIDER_EVENT]: () => {
        if (editorViewRef.current) dispatchFormatToEditor(editorViewRef.current, (b, from, to) => setLineBlock(b, "divider", from, to));
      },
      [FORMAT_QUOTE_EVENT]: () => {
        if (editorViewRef.current) dispatchFormatToEditor(editorViewRef.current, (b, from, to) => setLineBlock(b, "quote", from, to));
      },
      [FORMAT_NORMAL_TEXT_EVENT]: () => {
        if (editorViewRef.current) dispatchFormatToEditor(editorViewRef.current, (b, from, to) => clearLineBlock(b, from, to));
      },
      [FORMAT_BOLD_EVENT]: () => {
        if (editorViewRef.current) dispatchInlineFormatToEditor(editorViewRef.current, (b, from, to) => toggleInlineMark(b, "bold", from, to));
      },
      [FORMAT_ITALIC_EVENT]: () => {
        if (editorViewRef.current) dispatchInlineFormatToEditor(editorViewRef.current, (b, from, to) => toggleInlineMark(b, "italic", from, to));
      },
      [FORMAT_CODE_EVENT]: () => {
        if (editorViewRef.current) dispatchInlineFormatToEditor(editorViewRef.current, (b, from, to) => toggleInlineMark(b, "inlineCode", from, to));
      },
      [FORMAT_HEADING_EVENT]: ((e: CustomEvent<{level: 1|2|3}>) => {
        if (editorViewRef.current) dispatchFormatToEditor(editorViewRef.current, (b, from, to) => setLineBlock(b, `heading${e.detail?.level}` as any, from, to));
      }) as EventListener,
      [INSERT_MARKDOWN_LINK_EVENT]: ((e: CustomEvent<InsertMarkdownLinkEventDetail>) => {
        if (editorViewRef.current) {
           const view = editorViewRef.current;
           const range = view.state.selection.main;
           view.dispatch({
             changes: {from: range.from, to: range.to, insert: e.detail.text},
             effects: itemBodyStateEffect.of(applyInlineMark(view.state.field(itemBodyStateField), "link", range.from, range.from + (e.detail.text || "").length, {href: e.detail.url}))
           });
        }
      }) as EventListener,
      [INSERT_BLOCK_ENTITY_EVENT]: ((e: CustomEvent<InsertBlockEntityEventDetail>) => {
        if (editorViewRef.current) {
           const view = editorViewRef.current;
           const range = view.state.selection.main;
           const token = `⟦asset:${e.detail.assetId}⟧`;
           const body = insertBlockEntity(view.state.field(itemBodyStateField), {
              type: e.detail.image ? "image" : "file",
              from: range.from,
              to: range.from + token.length,
              assetId: e.detail.assetId,
              attrs: {
                displayName: e.detail.displayName,
                contentType: e.detail.contentType,
                url: e.detail.url
              }
           });
           view.dispatch({
             changes: {from: range.from, to: range.to, insert: token},
             effects: itemBodyStateEffect.of(body)
           });
        }
      }) as EventListener,
    };

    for (const [evt, handler] of Object.entries(handlers)) {
      window.addEventListener(evt, handler);
    }
    return () => {
      for (const [evt, handler] of Object.entries(handlers)) {
        window.removeEventListener(evt, handler);
      }
    };
  }, []);
}

function autosaveAfterFinishedEdit(
  view: EditorView,
  docChanged: boolean,
  readOnly: boolean,
  autosaveTrackerRef: MutableRefObject<AutosaveTracker>,
  onAutosaveRef: MutableRefObject<ItemBodyMarkdownEditorProps["onAutosave"]>,
  onVimModeChangeRef: MutableRefObject<ItemBodyMarkdownEditorProps["onVimModeChange"]>,
  setSaveState: (state: MarkdownBodySaveState) => void
) {
  const insertMode = getCM(view)?.state?.vim?.insertMode ?? null;
  const mode = insertMode ? "INSERT" : (getCM(view)?.state?.vim?.visualMode ? "VISUAL" : "NORMAL");
  view.contentDOM.dataset.vimMode = mode.toLowerCase();
  onVimModeChangeRef.current?.(mode);

  const tracker = autosaveTrackerRef.current;
  const exitedInsert = tracker.lastInsertMode === true && insertMode === false;
  if (exitedInsert) {
    tracker.lastInsertExitAt = Date.now();
  }
  if (docChanged) {
    tracker.hasUnsavedChanges = true;
    tracker.changeId += 1;
    setSaveState("unsaved");
  }
  if (insertMode !== null) {
    tracker.lastInsertMode = insertMode;
  }
  
  if (readOnly || tracker.isSaving || (!tracker.hasUnsavedChanges || !(exitedInsert || (docChanged && insertMode === false)))) {
    return;
  }
  const saveVersion = tracker.changeId;
  tracker.isSaving = true;
  setSaveState("saving");
  onAutosaveRef.current?.(view.state.field(itemBodyStateField)).then(() => {
    if (tracker.changeId === saveVersion) {
      tracker.hasUnsavedChanges = false;
      setSaveState("saved");
    }
  }).catch(() => setSaveState("error")).finally(() => {
    tracker.isSaving = false;
  });
}

async function saveAndExitOnNormalMode(
  view: EditorView,
  onSave: ItemBodyMarkdownEditorProps["onSave"] | undefined,
  onExitNormalMode: ItemBodyMarkdownEditorProps["onExitNormalMode"] | undefined,
  setSaveState: (state: MarkdownBodySaveState) => void
) {
  setSaveState("saving");
  const body = view.state.field(itemBodyStateField);
  if (onSave) await onSave(body);
  setSaveState("saved");
  if (onExitNormalMode) await onExitNormalMode(body);
}

async function saveMarkdownBody(
  onSave: ItemBodyMarkdownEditorProps["onSave"] | undefined,
  body: ItemBody,
  setSaveState: (state: MarkdownBodySaveState) => void
): Promise<void> {
  setSaveState("saving");
  if (onSave) await onSave(body);
  setSaveState("saved");
}
