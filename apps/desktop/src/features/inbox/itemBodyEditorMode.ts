import {
  Compartment,
  EditorState,
  type EditorSelection,
  type Extension
} from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import {
  itemBodyStateEffect,
  itemBodyStateField
} from "./itemBodyUtils.ts";
import type { ItemBody } from "./types.ts";

const readOnlyCompartment = new Compartment();
const editableCompartment = new Compartment();
const contentAttributesCompartment = new Compartment();
const interactionCompartment = new Compartment();

export function editorModeExtensions(
  readOnly: boolean,
  interactionExtensions: Extension[]
): Extension[] {
  return [
    readOnlyCompartment.of(EditorState.readOnly.of(readOnly)),
    editableCompartment.of(EditorView.editable.of(!readOnly)),
    contentAttributesCompartment.of(
      EditorView.contentAttributes.of(contentAttributes(readOnly))
    ),
    interactionCompartment.of(interactionExtensions)
  ];
}

export function reconfigureEditorCompartments(
  view: EditorView,
  readOnly: boolean,
  interactionExtensions: Extension[],
  selection?: EditorSelection
): void {
  view.dispatch({
    effects: [
      readOnlyCompartment.reconfigure(EditorState.readOnly.of(readOnly)),
      editableCompartment.reconfigure(EditorView.editable.of(!readOnly)),
      contentAttributesCompartment.reconfigure(
        EditorView.contentAttributes.of(contentAttributes(readOnly))
      ),
      interactionCompartment.reconfigure(interactionExtensions)
    ],
    selection
  });
}

export function syncReadOnlyBody(view: EditorView, body: ItemBody): void {
  const currentBody = view.state.field(itemBodyStateField);
  if (JSON.stringify(currentBody) === JSON.stringify(body)) return;
  view.dispatch({
    changes: { from: 0, to: view.state.doc.length, insert: body.text },
    effects: itemBodyStateEffect.of(body)
  });
}

function contentAttributes(readOnly: boolean): Record<string, string> {
  return readOnly ? { tabindex: "-1", "aria-readonly": "true" } : {};
}
