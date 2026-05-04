import { applyStuffBodyVimCommand, type StuffBodyVimCommand, type StuffBodyVimUpdate } from "./stuffBodyVim";

type RenderedCursorKey = "j" | "k";

/**
 * Applies Vim keys using the textarea's rendered rows for vertical movement.
 *
 * @example applyStuffBodyTextareaCommand(command, textarea)
 */
export function applyStuffBodyTextareaCommand(command: StuffBodyVimCommand, textarea: HTMLTextAreaElement): StuffBodyVimUpdate {
  if (!isRenderedCursorCommand(command)) {
    return applyStuffBodyVimCommand(command);
  }

  return measuredCursorUpdate(command, renderedTextareaCursor(textarea, command));
}

function isRenderedCursorCommand(command: StuffBodyVimCommand): command is StuffBodyVimCommand & { key: RenderedCursorKey } {
  return command.mode === "normal" && (command.key === "j" || command.key === "k");
}

function measuredCursorUpdate(command: StuffBodyVimCommand, cursor: number | null): StuffBodyVimUpdate {
  if (cursor === null) {
    return applyStuffBodyVimCommand(command);
  }

  return { ...command, activeCursor: cursor, copiedText: null, handled: true, pendingKey: null, selectionEnd: cursor, selectionStart: cursor };
}

function renderedTextareaCursor(textarea: HTMLTextAreaElement, command: StuffBodyVimCommand & { key: RenderedCursorKey }): number | null {
  const spans = createTextareaMirrorSpans(textarea, command.value);
  const cursorRect = spans[command.activeCursor]?.getBoundingClientRect();
  const targetTop = targetRenderedLineTop(spans, cursorRect, command.key);
  const cursor = closestRenderedCursor(spans, cursorRect, targetTop);

  removeTextareaMirror(spans);
  return cursor;
}

function createTextareaMirrorSpans(textarea: HTMLTextAreaElement, value: string): HTMLSpanElement[] {
  const mirror = createTextareaMirror(textarea);
  const spans = Array.from({ length: cursorCellCount(value) }, (_item, index) => createTextareaMirrorSpan(value, index));

  spans.forEach((span, index) => appendCursorCell(mirror, span, value[index]));
  document.body.append(mirror);
  return spans;
}

function cursorCellCount(value: string): number {
  return value.length === 0 || value.endsWith("\n") ? value.length + 1 : value.length;
}

function appendCursorCell(mirror: HTMLDivElement, span: HTMLSpanElement, character: string | undefined): void {
  mirror.append(span);

  if (character === "\n") {
    mirror.append(document.createTextNode("\n"));
  }
}

function createTextareaMirror(textarea: HTMLTextAreaElement): HTMLDivElement {
  const style = window.getComputedStyle(textarea);
  const mirror = document.createElement("div");

  mirror.className = "inbox-detail__cursor-measure";
  mirror.style.font = style.font;
  mirror.style.letterSpacing = style.letterSpacing;
  mirror.style.width = `${textarea.clientWidth}px`;
  return mirror;
}

function createTextareaMirrorSpan(value: string, index: number): HTMLSpanElement {
  const span = document.createElement("span");
  span.dataset.index = String(index);
  span.textContent = value[index] && value[index] !== "\n" ? value[index] : " ";
  return span;
}

function targetRenderedLineTop(spans: HTMLSpanElement[], cursorRect: DOMRect | undefined, key: RenderedCursorKey): number | null {
  if (!cursorRect) {
    return null;
  }

  const tops = renderedLineTops(spans);
  return key === "j" ? nextRenderedLineTop(tops, cursorRect.top) : previousRenderedLineTop(tops, cursorRect.top);
}

function renderedLineTops(spans: HTMLSpanElement[]): number[] {
  return Array.from(new Set(spans.map((span) => Math.round(span.getBoundingClientRect().top)))).sort((left, right) => left - right);
}

function nextRenderedLineTop(tops: number[], currentTop: number): number | null {
  return tops.find((top) => top > currentTop + 1) ?? null;
}

function previousRenderedLineTop(tops: number[], currentTop: number): number | null {
  const previousTops = tops.filter((top) => top < currentTop - 1);
  return previousTops.length > 0 ? previousTops[previousTops.length - 1] : null;
}

function closestRenderedCursor(spans: HTMLSpanElement[], cursorRect: DOMRect | undefined, targetTop: number | null): number | null {
  if (!cursorRect || targetTop === null) {
    return null;
  }

  const candidates = spans.filter((span) => Math.round(span.getBoundingClientRect().top) === targetTop);
  const closest = closestRenderedCursorSpan(candidates, cursorRect);
  return closest?.dataset.index ? Number.parseInt(closest.dataset.index, 10) : null;
}

function closestRenderedCursorSpan(candidates: HTMLSpanElement[], cursorRect: DOMRect): HTMLSpanElement | undefined {
  return candidates.reduce<HTMLSpanElement | undefined>((closest, candidate) => {
    return !closest || cursorDistance(candidate, cursorRect) < cursorDistance(closest, cursorRect) ? candidate : closest;
  }, undefined);
}

function cursorDistance(span: HTMLSpanElement, cursorRect: DOMRect): number {
  return Math.abs(span.getBoundingClientRect().left - cursorRect.left);
}

function removeTextareaMirror(spans: HTMLSpanElement[]): void {
  spans[0]?.parentElement?.remove();
}
