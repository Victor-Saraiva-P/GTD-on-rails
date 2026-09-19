import { EditorSelection } from "@codemirror/state";
import { type EditorView, WidgetType } from "@codemirror/view";
import { getCachedAssetObjectUrl, getCachedPdfFirstPagePreviewUrl } from "./assetFiles.ts";
import type { BlockEntity } from "./types.ts";

/**
 * Interactive checkbox widget replacing `[ ]` / `[x]` on inactive lines.
 */
export class TaskCheckboxWidget extends WidgetType {
  readonly from: number;
  readonly checked: boolean;

  constructor(from: number, checked: boolean) {
    super();
    this.from = from;
    this.checked = checked;
  }

  eq(other: TaskCheckboxWidget): boolean {
    return other.from === this.from && other.checked === this.checked;
  }

  toDOM(view: EditorView): HTMLElement {
    const wrap = document.createElement("span");
    wrap.className = "cm-task-checkbox";
    wrap.setAttribute("contenteditable", "false");

    const input = document.createElement("input");
    input.type = "checkbox";
    input.checked = this.checked;
    input.className = this.checked
      ? "cm-task-checkbox-input cm-checklist-box cm-checklist-box--checked"
      : "cm-task-checkbox-input cm-checklist-box";
    input.setAttribute("aria-label", this.checked ? "Uncheck task" : "Check task");

    input.addEventListener("mousedown", (e) => {
      e.preventDefault();
      e.stopPropagation();
    });

    input.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      view.dispatch({
        changes: { from: this.from + 1, to: this.from + 2, insert: this.checked ? " " : "x" }
      });
    });

    wrap.append(input);
    return wrap;
  }

  ignoreEvent(): boolean {
    return false;
  }
}

/**
 * Bullet point dot widget replacing list markers `- ` or `* `.
 */
export class BulletMarkWidget extends WidgetType {
  readonly level: number;

  constructor(level = 0) {
    super();
    this.level = level;
  }

  eq(other: BulletMarkWidget): boolean {
    return other.level === this.level;
  }

  toDOM(): HTMLElement {
    const span = document.createElement("span");
    span.className = `cm-bullet-mark cm-bullet-level-${this.level}`;
    span.textContent = "• ";
    return span;
  }

  ignoreEvent(): boolean {
    return false;
  }
}

/**
 * Image figure widget displayed on inactive lines for `![alt](url)` and asset tokens.
 */
export class LiveImageWidget extends WidgetType {
  readonly alt: string;
  readonly src: string;
  readonly lineFrom: number;
  readonly entity?: BlockEntity;

  constructor(alt: string, src: string, lineFrom: number, entity?: BlockEntity) {
    super();
    this.alt = alt;
    this.src = src;
    this.lineFrom = lineFrom;
    this.entity = entity;
  }

  eq(other: LiveImageWidget): boolean {
    return (
      other.alt === this.alt &&
      other.src === this.src &&
      other.lineFrom === this.lineFrom &&
      other.entity?.id === this.entity?.id
    );
  }

  toDOM(view: EditorView): HTMLElement {
    const figure = document.createElement("figure");
    figure.className = "local-image-embed cm-local-image-embed";
    figure.setAttribute("contenteditable", "false");

    const frame = document.createElement("div");
    frame.className = "local-image-embed-frame";

    const image = document.createElement("img");
    image.className = "local-image-embed-image cm-markdown-image";
    image.alt = this.alt;
    image.loading = "lazy";
    image.draggable = false;
    image.src = this.src;

    if (this.entity) {
      void resolveEntityImageSrc(figure, image, this.entity);
    }

    const controls = createTopControls(view, this.lineFrom);
    frame.append(image, controls);

    const caption = document.createElement("figcaption");
    caption.className = "local-image-embed-caption";
    caption.textContent = this.alt || this.entity?.attrs?.displayName || "Image";

    figure.append(frame, caption);
    return figure;
  }

  ignoreEvent(): boolean {
    return false;
  }
}

function createTopControls(view: EditorView, lineFrom: number): HTMLElement {
  const topControls = document.createElement("div");
  topControls.className = "local-image-embed-controls local-image-embed-controls-top";

  const editButton = document.createElement("button");
  editButton.type = "button";
  editButton.className = "local-image-embed-action local-image-embed-action-edit";
  editButton.textContent = "</>";
  editButton.title = "Edit this block";
  editButton.setAttribute("aria-label", "Edit this block");
  editButton.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    view.dispatch({ selection: EditorSelection.cursor(lineFrom), scrollIntoView: true });
    view.focus();
  });

  topControls.append(editButton);
  return topControls;
}

async function resolveEntityImageSrc(
  figure: HTMLElement,
  img: HTMLImageElement,
  entity: BlockEntity
): Promise<void> {
  const relPath = entity.attrs?.relativePath ?? entity.attrs?.localPath;
  const assetUrl = await getCachedAssetObjectUrl(relPath, entity.attrs?.contentType, entity.attrs?.url);
  figure.dataset.objectUrl = assetUrl.url;
  img.src = assetUrl.url;
}

/**
 * PDF preview widget displayed on inactive lines for PDF assets.
 */
export class LivePdfWidget extends WidgetType {
  readonly displayName: string;
  readonly entity?: BlockEntity;
  readonly fallbackUrl?: string;

  constructor(displayName: string, entity?: BlockEntity, fallbackUrl?: string) {
    super();
    this.displayName = displayName;
    this.entity = entity;
    this.fallbackUrl = fallbackUrl;
  }

  eq(other: LivePdfWidget): boolean {
    return other.displayName === this.displayName && other.entity?.id === this.entity?.id;
  }

  toDOM(): HTMLElement {
    const figure = document.createElement("figure");
    figure.className = "cm-pdf-preview local-file-attachment";
    figure.setAttribute("contenteditable", "false");

    const image = document.createElement("img");
    image.alt = this.displayName || "PDF first page";
    image.className = "cm-pdf-preview__image";
    figure.appendChild(image);

    if (this.entity) {
      void resolvePdfSource(figure, image, this.entity, this.fallbackUrl);
    }
    return figure;
  }

  ignoreEvent(): boolean {
    return false;
  }
}

async function resolvePdfSource(
  figure: HTMLElement,
  image: HTMLImageElement,
  entity: BlockEntity,
  fallbackUrl?: string
): Promise<void> {
  const relPath = entity.attrs?.relativePath ?? entity.attrs?.localPath;
  const assetUrl = await getCachedAssetObjectUrl(relPath, entity.attrs?.contentType, entity.attrs?.url ?? fallbackUrl);
  const previewUrl = await getCachedPdfFirstPagePreviewUrl(relPath).catch(() => null);
  figure.dataset.objectUrl = previewUrl?.url ?? assetUrl.url;
  if (previewUrl) {
    image.src = previewUrl.url;
    return;
  }
  image.remove();
  figure.appendChild(createPdfFallbackLink(entity, assetUrl.url));
}

function createPdfFallbackLink(entity: BlockEntity, assetUrl: string): HTMLAnchorElement {
  const link = document.createElement("a");
  link.textContent = `Open ${entity.attrs?.displayName || "PDF"}`;
  link.className = "cm-markdown-link";
  link.href = assetUrl;
  link.target = "_blank";
  link.rel = "noreferrer";
  return link;
}

/**
 * File attachment chip widget displayed on inactive lines for generic files.
 */
export class LiveAttachmentWidget extends WidgetType {
  readonly name: string;
  readonly url: string;
  readonly entity?: BlockEntity;

  constructor(name: string, url: string, entity?: BlockEntity) {
    super();
    this.name = name;
    this.url = url;
    this.entity = entity;
  }

  eq(other: LiveAttachmentWidget): boolean {
    return other.name === this.name && other.url === this.url && other.entity?.id === this.entity?.id;
  }

  toDOM(): HTMLElement {
    const figure = document.createElement("figure");
    figure.className = "local-file-attachment not-prose";
    figure.setAttribute("contenteditable", "false");

    const link = document.createElement("a");
    link.className = "local-file-attachment-button";
    link.href = this.url;
    link.target = "_blank";
    link.rel = "noreferrer";

    const icon = document.createElement("span");
    icon.className = "local-file-attachment-icon";
    icon.textContent = "📎";

    const nameEl = document.createElement("span");
    nameEl.className = "local-file-attachment-name";
    nameEl.textContent = this.name;

    link.append(icon, nameEl);
    figure.append(link);
    return figure;
  }

  ignoreEvent(): boolean {
    return false;
  }
}

/**
 * Horizontal rule divider widget.
 */
export class DividerWidget extends WidgetType {
  eq(): boolean {
    return true;
  }

  toDOM(): HTMLElement {
    const divider = document.createElement("span");
    divider.className = "cm-divider";
    divider.setAttribute("contenteditable", "false");
    return divider;
  }
}
