import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent as ReactDragEvent,
  type RefObject
} from "react";
import { buildApiUrlWithVersion } from "../../config/env";
import { hasPotentialClipboardImage, readClipboardImage } from "./contextIconClipboard";
import type { ContextItem } from "./types";

type ContextIconEditorProps = {
  context: ContextItem;
  isBusy: boolean;
  onClose: () => void;
  onUpload: (file: File) => Promise<void>;
  onDelete: () => Promise<void>;
};

const ACCEPTED_IMAGE_TYPES = new Set(["image/png", "image/svg+xml", "image/webp"]);
const ACCEPTED_IMAGE_EXTENSIONS = new Set(["png", "svg", "webp"]);

type IconFileHandler = (file: File | null) => Promise<void>;

function extensionOf(filename: string): string {
  const dotIndex = filename.lastIndexOf(".");

  if (dotIndex < 0 || dotIndex === filename.length - 1) {
    return "";
  }

  return filename.slice(dotIndex + 1).toLowerCase();
}

function isAcceptedImage(file: File): boolean {
  if (ACCEPTED_IMAGE_TYPES.has(file.type)) {
    return true;
  }

  if (file.type.startsWith("image/")) {
    return ACCEPTED_IMAGE_EXTENSIONS.has(extensionOf(file.name));
  }

  return ACCEPTED_IMAGE_EXTENSIONS.has(extensionOf(file.name));
}

function hasClipboardFile(source: DataTransfer | null): boolean {
  if (!source) {
    return false;
  }

  return Array.from(source.items ?? []).some((item) => item.kind === "file") || source.files.length > 0;
}

function isPasteShortcut(event: KeyboardEvent): boolean {
  return event.ctrlKey && !event.altKey && !event.metaKey && event.key.toLowerCase() === "v";
}

function extractFile(source: DataTransfer | null): File | null {
  if (!source) {
    return null;
  }

  const itemFile = Array.from(source.items ?? []).find((item) => item.kind === "file")?.getAsFile();

  return itemFile ?? source.files?.item(0) ?? null;
}

async function uploadIconFile(
  file: File | null,
  onUpload: (file: File) => Promise<void>,
  setErrorMessage: (message: string | null) => void
) {
  if (!file) {
    setErrorMessage("No image was detected.");
    return;
  }

  if (!isAcceptedImage(file)) {
    setErrorMessage("Icon must be PNG, SVG or WebP.");
    return;
  }

  await uploadAcceptedIconFile(file, onUpload, setErrorMessage);
}

async function uploadAcceptedIconFile(
  file: File,
  onUpload: (file: File) => Promise<void>,
  setErrorMessage: (message: string | null) => void
) {
  setErrorMessage(null);

  try {
    await onUpload(file);
  } catch (error) {
    setErrorMessage(error instanceof Error ? error.message : "Failed to update context icon.");
  }
}

function useIconFileHandler(onUpload: (file: File) => Promise<void>) {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const handleFile = (file: File | null) => uploadIconFile(file, onUpload, setErrorMessage);

  return { errorMessage, handleFile, setErrorMessage };
}

async function handlePasteData(clipboardData: DataTransfer | null, handleFile: IconFileHandler) {
  const file = extractFile(clipboardData);

  if (file) {
    await handleFile(file);
    return;
  }

  if (hasPotentialClipboardImage(clipboardData)) {
    await handleFile(await readClipboardImage());
  }
}

async function handleClipboardPaste(handleFile: IconFileHandler) {
  await handleFile(await readClipboardImage());
}

function isDialogActive(dialogRef: RefObject<HTMLElement | null>): boolean {
  return dialogRef.current === document.activeElement || dialogRef.current?.contains(document.activeElement) === true;
}

function shouldHandleWindowPaste(event: ClipboardEvent, dialogRef: RefObject<HTMLElement | null>): boolean {
  return isDialogActive(dialogRef) || hasClipboardFile(event.clipboardData);
}

function preventPasteIfImage(event: ClipboardEvent) {
  if (hasClipboardFile(event.clipboardData) || hasPotentialClipboardImage(event.clipboardData)) {
    event.preventDefault();
    event.stopPropagation();
  }
}

function handleWindowPaste(
  event: ClipboardEvent,
  dialogRef: RefObject<HTMLElement | null>,
  handleFile: IconFileHandler
) {
  if (!shouldHandleWindowPaste(event, dialogRef)) {
    return;
  }

  preventPasteIfImage(event);
  void handlePasteData(event.clipboardData, handleFile);
}

function handleWindowKeyDown(
  event: KeyboardEvent,
  dialogRef: RefObject<HTMLElement | null>,
  handleFile: IconFileHandler
) {
  if (!isDialogActive(dialogRef) || !isPasteShortcut(event)) {
    return;
  }

  event.preventDefault();
  event.stopPropagation();
  void handleClipboardPaste(handleFile);
}

function useDialogFocus(dialogRef: RefObject<HTMLElement | null>, contextId: string) {
  useEffect(() => {
    dialogRef.current?.focus();
  }, [contextId, dialogRef]);
}

function useWindowPaste(dialogRef: RefObject<HTMLElement | null>, handleFile: IconFileHandler, contextId: string) {
  useEffect(() => {
    const onPaste = (event: ClipboardEvent) => handleWindowPaste(event, dialogRef, handleFile);

    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [contextId, dialogRef, handleFile]);
}

function useWindowPasteShortcut(dialogRef: RefObject<HTMLElement | null>, handleFile: IconFileHandler, contextId: string) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => handleWindowKeyDown(event, dialogRef, handleFile);

    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [contextId, dialogRef, handleFile]);
}

function preventWindowDrop(event: DragEvent) {
  event.preventDefault();
}

function usePreventWindowDrop(contextId: string) {
  useEffect(() => {
    window.addEventListener("dragover", preventWindowDrop);
    window.addEventListener("drop", preventWindowDrop);

    return removeWindowDropPrevention;
  }, [contextId]);
}

function removeWindowDropPrevention() {
  window.removeEventListener("dragover", preventWindowDrop);
  window.removeEventListener("drop", preventWindowDrop);
}

function previewUrlForContext(context: ContextItem): string | null {
  return context.iconUrl ? buildApiUrlWithVersion(context.iconUrl, context.iconRevision) : null;
}

function dragActivate(event: ReactDragEvent<HTMLElement>, setIsDragActive: (active: boolean) => void) {
  event.preventDefault();
  setIsDragActive(true);
}

function dragLeave(event: ReactDragEvent<HTMLElement>, setIsDragActive: (active: boolean) => void) {
  event.preventDefault();

  if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
    setIsDragActive(false);
  }
}

function dropIconFile(
  event: ReactDragEvent<HTMLElement>,
  setIsDragActive: (active: boolean) => void,
  handleFile: IconFileHandler
) {
  event.preventDefault();
  setIsDragActive(false);
  void handleFile(extractFile(event.dataTransfer));
}

function deleteIcon(onDelete: () => Promise<void>, setErrorMessage: (message: string | null) => void) {
  setErrorMessage(null);
  void onDelete().catch((error: unknown) => {
    setErrorMessage(error instanceof Error ? error.message : "Failed to delete context icon.");
  });
}

function ContextIconHeader({ context, isBusy, onClose }: Pick<ContextIconEditorProps, "context" | "isBusy" | "onClose">) {
  return (
    <header className="context-icon-dialog__header">
      <div>
        <p className="context-icon-dialog__eyebrow">Edit context</p>
        <h2 className="context-icon-dialog__title">{context.name}</h2>
      </div>
      <button type="button" className="context-icon-dialog__close" onClick={onClose} disabled={isBusy}>
        Esc
      </button>
    </header>
  );
}

function ContextIconPreview({ previewUrl }: { previewUrl: string | null }) {
  return (
    <div className="context-icon-preview" aria-hidden="true">
      {previewUrl ? <img src={previewUrl} alt="" className="context-icon-preview__image" /> : <span className="context-icon-preview__glyph">C</span>}
    </div>
  );
}

function ContextIconFileInput(
  props: { inputRef: RefObject<HTMLInputElement | null>; handleFile: IconFileHandler }
) {
  return (
    <input
      ref={props.inputRef}
      type="file"
      accept=".png,.svg,.webp,image/png,image/svg+xml,image/webp"
      className="context-icon-dropzone__input"
      onChange={(event) => handleFileInputChange(event, props.handleFile)}
    />
  );
}

function handleFileInputChange(event: ChangeEvent<HTMLInputElement>, handleFile: IconFileHandler) {
  void handleFile(event.target.files?.item(0) ?? null);
  event.target.value = "";
}

function ContextIconActions(props: ContextIconActionsProps) {
  return (
    <div className="context-icon-dialog__actions">
      <button type="button" className="context-icon-dialog__action" onClick={() => props.inputRef.current?.click()} disabled={props.isBusy}>
        Choose file
      </button>
      <button type="button" className="context-icon-dialog__action" onClick={() => deleteIcon(props.onDelete, props.setErrorMessage)} disabled={props.isBusy || !props.hasIcon}>
        Remove icon
      </button>
    </div>
  );
}

type ContextIconActionsProps = {
  hasIcon: boolean;
  inputRef: RefObject<HTMLInputElement | null>;
  isBusy: boolean;
  onDelete: () => Promise<void>;
  setErrorMessage: (message: string | null) => void;
};

function ContextIconDropzone(props: ContextIconDropzoneProps) {
  return (
    <div className={`context-icon-dropzone${props.isDragActive ? " context-icon-dropzone--active" : ""}`} tabIndex={0} onDragEnter={(event) => dragActivate(event, props.setIsDragActive)} onDragOver={(event) => dragActivate(event, props.setIsDragActive)} onDragLeave={(event) => dragLeave(event, props.setIsDragActive)} onDrop={(event) => dropIconFile(event, props.setIsDragActive, props.handleFile)}>
      <ContextIconFileInput inputRef={props.inputRef} handleFile={props.handleFile} />
      <p className="context-icon-dropzone__title">Drop an icon here</p>
      <p className="context-icon-dropzone__hint">Or press Ctrl+V to paste an image.</p>
      <ContextIconActions {...props} />
      {props.errorMessage ? <p className="context-icon-dialog__error">{props.errorMessage}</p> : null}
    </div>
  );
}

type ContextIconDropzoneProps = ContextIconActionsProps & {
  errorMessage: string | null;
  handleFile: IconFileHandler;
  inputRef: RefObject<HTMLInputElement | null>;
  isDragActive: boolean;
  setIsDragActive: (active: boolean) => void;
};

function ContextIconContent(props: ContextIconContentProps) {
  return (
    <div className="context-icon-dialog__content">
      <ContextIconPreview previewUrl={props.previewUrl} />
      <ContextIconDropzone {...props} />
    </div>
  );
}

type ContextIconContentProps = ContextIconDropzoneProps & {
  previewUrl: string | null;
};

function ContextIconDialog(props: ContextIconDialogProps) {
  return (
    <div className="context-icon-dialog__backdrop" role="presentation" onClick={props.onClose}>
      <ContextIconDialogPanel {...props} />
    </div>
  );
}

function ContextIconDialogPanel(props: ContextIconDialogProps) {
  return (
    <section ref={props.dialogRef} className="context-icon-dialog" role="dialog" aria-modal="true" aria-label={`Edit icon for ${props.context.name}`} tabIndex={-1} onClick={(event) => event.stopPropagation()}>
      <ContextIconHeader context={props.context} isBusy={props.isBusy} onClose={props.onClose} />
      <ContextIconContent {...props} />
    </section>
  );
}

type ContextIconDialogProps = ContextIconContentProps & {
  context: ContextItem;
  dialogRef: RefObject<HTMLElement | null>;
  onClose: () => void;
};

export function ContextIconEditor({ context, isBusy, onClose, onUpload, onDelete }: ContextIconEditorProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const dialogRef = useRef<HTMLElement | null>(null);
  const [isDragActive, setIsDragActive] = useState(false);
  const previewUrl = useMemo(() => previewUrlForContext(context), [context]);
  const { errorMessage, handleFile, setErrorMessage } = useIconFileHandler(onUpload);

  useDialogFocus(dialogRef, context.id);
  useWindowPaste(dialogRef, handleFile, context.id);
  useWindowPasteShortcut(dialogRef, handleFile, context.id);
  usePreventWindowDrop(context.id);

  return (
    <ContextIconDialog context={context} dialogRef={dialogRef} errorMessage={errorMessage} handleFile={handleFile} hasIcon={Boolean(context.iconUrl)} inputRef={inputRef} isBusy={isBusy} isDragActive={isDragActive} onClose={onClose} onDelete={onDelete} previewUrl={previewUrl} setErrorMessage={setErrorMessage} setIsDragActive={setIsDragActive} />
  );
}
