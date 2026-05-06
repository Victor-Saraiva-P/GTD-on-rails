import { invoke } from "@tauri-apps/api/core";
import { getCurrentWebview, type DragDropEvent } from "@tauri-apps/api/webview";
import { useEffect, useRef, useState, type ChangeEvent, type DragEvent as ReactDragEvent, type MutableRefObject, type RefObject } from "react";
import { readMarkdownAssetClipboardFile } from "./markdownAssetClipboard";
import { uploadStuffAsset } from "./api";

const ACCEPTED_ASSET_EXTENSIONS = new Set(["pdf", "doc", "docx", "xls", "xlsx", "png", "jpg", "jpeg", "gif", "webp", "svg"]);
const ACCEPTED_ASSET_MIME_PREFIXES = ["image/"];
const ACCEPTED_ASSET_MIME_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
]);

export const INSERT_BLOCK_ENTITY_EVENT = "gtd:insert-block-entity";

export type InsertBlockEntityEventDetail = {
  assetId: string;
  displayName: string;
  contentType: string;
  url: string;
  image: boolean;
};

type MarkdownAssetComboDialogProps = {
  itemId: string;
  onClose: () => void;
};

type AssetFilePayload = {
  bytesBase64: string;
  mimeType: string;
  fileName: string;
};

type AssetFileHandler = (file: File | null) => Promise<void>;

export function dispatchInsertBlockEntity(assetId: string, displayName: string, contentType: string, url: string, image: boolean) {
  const detail: InsertBlockEntityEventDetail = { assetId, displayName, contentType, url, image };
  window.dispatchEvent(new CustomEvent(INSERT_BLOCK_ENTITY_EVENT, { detail }));
}

/**
 * Uploads an asset from paste, picker, or drag-drop and inserts it into the item body.
 *
 * @example <MarkdownAssetComboDialog itemId={item.id} onClose={close} />
 */
export function MarkdownAssetComboDialog({ itemId, onClose }: MarkdownAssetComboDialogProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const dialogRef = useRef<HTMLElement | null>(null);
  const previousFocusRef = useRef<HTMLElement | null>(activeElement());
  const isUploadingRef = useRef(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isDragActive, setIsDragActive] = useState(false);
  const handleFile = (file: File | null) => uploadMarkdownAssetFile(itemId, file, isUploadingRef, onClose, setStatusMessage);

  useAssetDialogKeys(onClose, handleFile);
  useTauriAssetDrop(handleFile, setIsDragActive, setStatusMessage, itemId);
  usePreventWindowDrop(itemId);
  useEffect(() => dialogRef.current?.focus(), [itemId]);
  useEffect(() => () => previousFocusRef.current?.focus(), []);

  return <AssetDialog dialogRef={dialogRef} handleFile={handleFile} inputRef={inputRef} isDragActive={isDragActive} onClose={onClose} setIsDragActive={setIsDragActive} statusMessage={statusMessage} />;
}

function activeElement(): HTMLElement | null {
  return document.activeElement instanceof HTMLElement ? document.activeElement : null;
}

function AssetDialog(props: AssetDialogProps) {
  return (
    <div className="asset-dialog__backdrop" role="presentation">
      <section ref={props.dialogRef} className="asset-dialog" role="dialog" aria-modal="true" aria-label="Asset" tabIndex={-1}>
        <AssetHeader onClose={props.onClose} />
        <AssetDropzone {...props} />
      </section>
    </div>
  );
}

function AssetHeader({ onClose }: { onClose: () => void }) {
  return <header className="asset-dialog__header"><h2>Asset</h2><button type="button" onClick={onClose}>Esc</button></header>;
}

function AssetDropzone(props: AssetDialogProps) {
  return (
    <div className={`asset-dropzone${props.isDragActive ? " asset-dropzone--active" : ""}`} tabIndex={0} onDragEnter={(event) => dragActivate(event, props.setIsDragActive)} onDragOver={(event) => dragActivate(event, props.setIsDragActive)} onDragLeave={(event) => dragLeave(event, props.setIsDragActive)} onDrop={(event) => dropAssetFile(event, props.setIsDragActive, props.handleFile)}>
      <AssetFileInput handleFile={props.handleFile} inputRef={props.inputRef} />
      <p className="asset-dropzone__title">Drop an asset here</p>
      <p className="asset-dropzone__hint">PDF, Word, Excel, or image. Press p to try clipboard paste.</p>
      <AssetActions handleFile={props.handleFile} inputRef={props.inputRef} />
      {props.statusMessage ? <p className="asset-dialog__status">{props.statusMessage}</p> : null}
    </div>
  );
}

function AssetFileInput(props: Pick<AssetDialogProps, "handleFile" | "inputRef">) {
  return <input ref={props.inputRef} type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.gif,.webp,.svg,application/pdf,image/*" className="asset-dropzone__input" onChange={(event) => handleFileInputChange(event, props.handleFile)} />;
}

function AssetActions(props: Pick<AssetDialogProps, "handleFile" | "inputRef">) {
  return <div className="asset-dialog__actions"><button type="button" onClick={() => props.inputRef.current?.click()}>Choose file</button><button type="button" onClick={() => pasteClipboardAsset(props.handleFile)}>p Paste Asset</button></div>;
}

type AssetDialogProps = {
  dialogRef: RefObject<HTMLElement | null>;
  handleFile: AssetFileHandler;
  inputRef: RefObject<HTMLInputElement | null>;
  isDragActive: boolean;
  onClose: () => void;
  setIsDragActive: (active: boolean) => void;
  statusMessage: string | null;
};

function handleFileInputChange(event: ChangeEvent<HTMLInputElement>, handleFile: AssetFileHandler) {
  void handleFile(event.target.files?.item(0) ?? null);
  event.target.value = "";
}

function dragActivate(event: ReactDragEvent<HTMLElement>, setIsDragActive: (active: boolean) => void) {
  event.preventDefault();
  setIsDragActive(true);
}

function dragLeave(event: ReactDragEvent<HTMLElement>, setIsDragActive: (active: boolean) => void) {
  event.preventDefault();
  if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setIsDragActive(false);
}

function dropAssetFile(event: ReactDragEvent<HTMLElement>, setIsDragActive: (active: boolean) => void, handleFile: AssetFileHandler) {
  event.preventDefault();
  setIsDragActive(false);
  if (event.dataTransfer.files.length > 0) {
    void handleFile(extractFile(event.dataTransfer));
  }
}

function extractFile(source: DataTransfer | null): File | null {
  return Array.from(source?.items ?? []).find((item) => item.kind === "file")?.getAsFile() ?? source?.files?.item(0) ?? null;
}

function fileFromAssetPayload(payload: AssetFilePayload): File {
  const bytes = Uint8Array.from(atob(payload.bytesBase64), (char) => char.charCodeAt(0));
  return new File([bytes], payload.fileName, { type: payload.mimeType });
}

async function readDroppedAssetPath(filePath: string): Promise<File | null> {
  const payload = await invoke<AssetFilePayload | null>("read_asset_file_path", { filePath });
  return payload ? fileFromAssetPayload(payload) : null;
}

function useTauriAssetDrop(
  handleFile: AssetFileHandler,
  setIsDragActive: (active: boolean) => void,
  setStatusMessage: (message: string | null) => void,
  itemId: string
) {
  useEffect(() => {
    let unlisten: (() => void) | null = null;
    void getCurrentWebview().onDragDropEvent((event) => handleTauriAssetDrop(event.payload, handleFile, setIsDragActive, setStatusMessage)).then((nextUnlisten) => {
      unlisten = nextUnlisten;
    });

    return () => unlisten?.();
  }, [handleFile, itemId, setIsDragActive, setStatusMessage]);
}

function handleTauriAssetDrop(
  event: DragDropEvent,
  handleFile: AssetFileHandler,
  setIsDragActive: (active: boolean) => void,
  setStatusMessage: (message: string | null) => void
) {
  if (event.type === "enter" || event.type === "over") {
    setIsDragActive(true);
    return;
  }
  if (event.type === "leave") {
    setIsDragActive(false);
    return;
  }

  setIsDragActive(false);
  void handleDroppedAssetPath(event.paths[0], handleFile, setStatusMessage);
}

async function handleDroppedAssetPath(filePath: string | undefined, handleFile: AssetFileHandler, setStatusMessage: (message: string | null) => void) {
  if (!filePath) {
    setStatusMessage("No file was detected.");
    return;
  }

  try {
    await handleFile(await readDroppedAssetPath(filePath));
  } catch (error) {
    setStatusMessage(error instanceof Error ? error.message : "Failed to read dropped file.");
  }
}

async function pasteClipboardAsset(handleFile: AssetFileHandler) {
  await handleFile(await readMarkdownAssetClipboardFile());
}

function useAssetDialogKeys(onClose: () => void, handleFile: AssetFileHandler) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => handleAssetDialogKeyDown(event, onClose, handleFile);
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [onClose, handleFile]);
}

function handleAssetDialogKeyDown(event: KeyboardEvent, onClose: () => void, handleFile: AssetFileHandler) {
  if (event.key === "Escape") return closeAssetDialog(event, onClose);
  if (event.key.toLowerCase() === "p") return pasteAssetFromKey(event, handleFile);
}

function closeAssetDialog(event: KeyboardEvent, onClose: () => void) {
  event.preventDefault();
  event.stopPropagation();
  onClose();
}

function pasteAssetFromKey(event: KeyboardEvent, handleFile: AssetFileHandler) {
  event.preventDefault();
  event.stopPropagation();
  void pasteClipboardAsset(handleFile);
}

function preventWindowDrop(event: DragEvent) {
  event.preventDefault();
}

function usePreventWindowDrop(itemId: string) {
  useEffect(() => {
    window.addEventListener("dragover", preventWindowDrop);
    window.addEventListener("drop", preventWindowDrop);
    return () => removeWindowDropPrevention();
  }, [itemId]);
}

function removeWindowDropPrevention() {
  window.removeEventListener("dragover", preventWindowDrop);
  window.removeEventListener("drop", preventWindowDrop);
}

async function uploadMarkdownAssetFile(itemId: string, file: File | null, isUploadingRef: MutableRefObject<boolean>, onClose: () => void, setStatusMessage: (message: string | null) => void) {
  if (isUploadingRef.current) return;
  if (!file || !isSupportedAssetFile(file)) return setStatusMessage("Choose a supported PDF, Word, Excel, or image file.");
  isUploadingRef.current = true;
  await uploadMarkdownAsset(itemId, file, onClose, setStatusMessage, () => { isUploadingRef.current = false; });
}

function isSupportedAssetFile(file: File): boolean {
  return isSupportedAssetMime(file.type) || ACCEPTED_ASSET_EXTENSIONS.has(fileExtension(file.name));
}

function isSupportedAssetMime(mimeType: string): boolean {
  return ACCEPTED_ASSET_MIME_TYPES.has(mimeType) || ACCEPTED_ASSET_MIME_PREFIXES.some((prefix) => mimeType.startsWith(prefix));
}

function fileExtension(fileName: string): string {
  return fileName.split(".").pop()?.toLowerCase() ?? "";
}

async function uploadMarkdownAsset(itemId: string, file: File, onClose: () => void, setStatusMessage: (message: string | null) => void, onFailure: () => void) {
  try {
    const asset = await uploadStuffAsset(itemId, file);
    dispatchInsertBlockEntity(asset.id, asset.fileName, asset.contentType, asset.url, asset.image);
    onClose();
  } catch (error) {
    onFailure();
    setStatusMessage(error instanceof Error ? error.message : "Failed to upload asset.");
  }
}
