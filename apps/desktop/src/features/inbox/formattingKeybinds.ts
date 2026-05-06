import {
  FORMAT_BOLD_EVENT,
  FORMAT_ITALIC_EVENT,
  FORMAT_CLEAR_INLINE_EVENT,
  FORMAT_CODE_EVENT,
  FORMAT_BULLET_EVENT,
  FORMAT_CHECKLIST_CHECKED_EVENT,
  FORMAT_CHECKLIST_EVENT,
  FORMAT_CHECKLIST_UNCHECKED_EVENT,
  FORMAT_DIVIDER_EVENT,
  FORMAT_HEADING_EVENT,
  FORMAT_LETTERED_LIST_EVENT,
  FORMAT_NUMBERED_LIST_EVENT,
  FORMAT_NORMAL_TEXT_EVENT,
  FORMAT_QUOTE_EVENT
} from "./ItemBodyMarkdownEditor";
import type { KeybindDefinition, ScreenId } from "../keybinds/types";

function dispatchFormat(eventName: string, detail?: unknown) {
  window.dispatchEvent(new CustomEvent(eventName, { detail }));
}

/**
 * Builds a set of markdown formatting keybindings for a specific screen.
 * These bindings are intended to be used when the 'stuff-detail' zone is active.
 *
 * @example buildFormattingBindings("inbox")
 */
export function buildFormattingBindings(screen: ScreenId, openLinkComboCb?: () => void, openAssetComboCb?: () => void): KeybindDefinition[] {
  const b = (id: string, key: string, description: string, run: () => void, sequence: string[]): KeybindDefinition => ({
    description,
    id: `${screen}.${id}`,
    key,
    leader: true,
    runKeybind: run,
    screen,
    sequence,
    zone: "stuff-detail"
  });

  return [
    b("format-bullet", "b", "Format as Bullet Point", () => dispatchFormat(FORMAT_BULLET_EVENT), ["m", "b"]),
    b("format-numbered-list", "n", "Format as Numbered List", () => dispatchFormat(FORMAT_NUMBERED_LIST_EVENT), ["m", "n"]),
    b("format-lettered-list", "l", "Format as Lettered List", () => dispatchFormat(FORMAT_LETTERED_LIST_EVENT), ["m", "l"]),
    b("format-checklist", "c", "Format as Checklist", () => dispatchFormat(FORMAT_CHECKLIST_EVENT), ["m", "c"]),
    b("format-checklist-checked", "c", "Format as Checked Checklist", () => dispatchFormat(FORMAT_CHECKLIST_CHECKED_EVENT), ["m", "c", "c"]),
    b("format-checklist-unchecked", "u", "Format as Unchecked Checklist", () => dispatchFormat(FORMAT_CHECKLIST_UNCHECKED_EVENT), ["m", "c", "u"]),
    b("format-divider", "d", "Insert Divider", () => dispatchFormat(FORMAT_DIVIDER_EVENT), ["m", "d"]),
    b("format-quote", "q", "Format as Quote", () => dispatchFormat(FORMAT_QUOTE_EVENT), ["m", "q"]),
    b("format-normal-text", "t", "Format as Text", () => dispatchFormat(FORMAT_NORMAL_TEXT_EVENT), ["m", "t"]),
    b("format-h1", "1", "Format as Heading 1", () => dispatchFormat(FORMAT_HEADING_EVENT, { level: 1 }), ["m", "1"]),
    b("format-h2", "2", "Format as Heading 2", () => dispatchFormat(FORMAT_HEADING_EVENT, { level: 2 }), ["m", "2"]),
    b("format-h3", "3", "Format as Heading 3", () => dispatchFormat(FORMAT_HEADING_EVENT, { level: 3 }), ["m", "3"]),
    b("format-asset", "a", "Insert Asset", () => openAssetComboCb?.(), ["m", "a"]),
    b("format-bold", "b", "Format as Bold", () => dispatchFormat(FORMAT_BOLD_EVENT), ["t", "b"]),
    b("format-italic", "i", "Format as Italic", () => dispatchFormat(FORMAT_ITALIC_EVENT), ["t", "i"]),
    b("format-link", "l", "Insert Link", () => openLinkComboCb?.(), ["t", "l"]),
    b("format-code", "c", "Format as Code", () => dispatchFormat(FORMAT_CODE_EVENT), ["t", "c"]),
    b("format-clear-inline", "t", "Clear Inline Formatting", () => dispatchFormat(FORMAT_CLEAR_INLINE_EVENT), ["t", "t"])
  ];
}
