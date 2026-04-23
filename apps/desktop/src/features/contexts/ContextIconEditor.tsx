import { invoke } from "@tauri-apps/api/core";
import { useEffect, useMemo, useRef, useState } from "react";
import { buildApiUrlWithVersion } from "../../config/env";
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

type ClipboardImagePayload = {
  bytesBase64: string;
  mimeType: string;
  fileName: string;
};

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

function hasPotentialClipboardImage(source: DataTransfer | null): boolean {
  if (!source) {
    return false;
  }

  const types = Array.from(source.types ?? []);

  if (types.includes("Files")) {
    return true;
  }

  return Array.from(source.items ?? []).some(
    (item) => item.kind === "file" || ACCEPTED_IMAGE_TYPES.has(item.type)
  );
}

async function readClipboardImage(): Promise<File | null> {
  try {
    const clipboardImage = await invoke<ClipboardImagePayload | null>("read_clipboard_image");

    if (clipboardImage) {
      const bytes = Uint8Array.from(atob(clipboardImage.bytesBase64), (char) => char.charCodeAt(0));
      const extension =
        clipboardImage.mimeType === "image/svg+xml"
          ? "svg"
          : clipboardImage.mimeType.split("/")[1] ?? "png";

      return new File([bytes], clipboardImage.fileName || `clipboard-icon.${extension}`, {
        type: clipboardImage.mimeType
      });
    }
  } catch {
    if (!("clipboard" in navigator) || typeof navigator.clipboard.read !== "function") {
      return null;
    }

    try {
      const clipboardItems = await navigator.clipboard.read();

      for (const clipboardItem of clipboardItems) {
        const imageType = clipboardItem.types.find((type) => ACCEPTED_IMAGE_TYPES.has(type));

        if (!imageType) {
          continue;
        }

        const blob = await clipboardItem.getType(imageType);
        const extension = imageType === "image/svg+xml" ? "svg" : imageType.split("/")[1] ?? "png";

        return new File([blob], `clipboard-icon.${extension}`, { type: imageType });
      }
    } catch {
      return null;
    }
  }

  return null;
}

function isPasteShortcut(event: KeyboardEvent): boolean {
  return event.ctrlKey && !event.altKey && !event.metaKey && event.key.toLowerCase() === "v";
}

export function ContextIconEditor({
  context,
  isBusy,
  onClose,
  onUpload,
  onDelete
}: ContextIconEditorProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const dialogRef = useRef<HTMLElement | null>(null);
  const [isDragActive, setIsDragActive] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const previewUrl = useMemo(
    () => (context.iconUrl ? buildApiUrlWithVersion(context.iconUrl, context.iconRevision) : null),
    [context.iconRevision, context.iconUrl]
  );

  const extractFile = (source: DataTransfer | null): File | null => {
    if (!source) {
      return null;
    }

    const itemFile = Array.from(source.items ?? []).filter(
      (item): item is DataTransferItem => item !== null
    )
      .find((item) => item.kind === "file")
      ?.getAsFile();

    if (itemFile) {
      return itemFile;
    }

    return source.files?.item(0) ?? null;
  };

  const handleFile = async (file: File | null) => {
    if (!file) {
      setErrorMessage("No image was detected.");
      return;
    }

    if (!isAcceptedImage(file)) {
      setErrorMessage("Icon must be PNG, SVG or WebP.");
      return;
    }

    setErrorMessage(null);

    try {
      await onUpload(file);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to update context icon.");
    }
  };

  const handlePasteData = async (clipboardData: DataTransfer | null) => {
    const file = extractFile(clipboardData);

    if (file) {
      await handleFile(file);
      return;
    }

    if (!hasPotentialClipboardImage(clipboardData)) {
      return;
    }

    const clipboardImage = await readClipboardImage();

    if (!clipboardImage) {
      return;
    }

    await handleFile(clipboardImage);
  };

  const handleClipboardPaste = async () => {
    const clipboardImage = await readClipboardImage();

    if (!clipboardImage) {
      return;
    }

    await handleFile(clipboardImage);
  };

  useEffect(() => {
    dialogRef.current?.focus();
  }, [context.id]);

  useEffect(() => {
    function handleWindowPaste(event: ClipboardEvent) {
      const isDialogActive =
        dialogRef.current === document.activeElement ||
        dialogRef.current?.contains(document.activeElement) === true;

      if (!isDialogActive && !hasClipboardFile(event.clipboardData)) {
        return;
      }

      if (hasClipboardFile(event.clipboardData) || hasPotentialClipboardImage(event.clipboardData)) {
        event.preventDefault();
        event.stopPropagation();
      }

      void handlePasteData(event.clipboardData);
    }

    window.addEventListener("paste", handleWindowPaste);

    return () => {
      window.removeEventListener("paste", handleWindowPaste);
    };
  }, [context.id]);

  useEffect(() => {
    function handleWindowKeyDown(event: KeyboardEvent) {
      const isDialogActive =
        dialogRef.current === document.activeElement ||
        dialogRef.current?.contains(document.activeElement) === true;

      if (!isDialogActive || !isPasteShortcut(event)) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      void handleClipboardPaste();
    }

    window.addEventListener("keydown", handleWindowKeyDown, true);

    return () => {
      window.removeEventListener("keydown", handleWindowKeyDown, true);
    };
  }, [context.id]);

  useEffect(() => {
    function preventWindowDrop(event: DragEvent) {
      event.preventDefault();
    }

    window.addEventListener("dragover", preventWindowDrop);
    window.addEventListener("drop", preventWindowDrop);

    return () => {
      window.removeEventListener("dragover", preventWindowDrop);
      window.removeEventListener("drop", preventWindowDrop);
    };
  }, [context.id]);

  return (
    <div className="context-icon-dialog__backdrop" role="presentation" onClick={onClose}>
      <section
        ref={dialogRef}
        className="context-icon-dialog"
        role="dialog"
        aria-modal="true"
        aria-label={`Edit icon for ${context.name}`}
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
      >
        <header className="context-icon-dialog__header">
          <div>
            <p className="context-icon-dialog__eyebrow">Edit context</p>
            <h2 className="context-icon-dialog__title">{context.name}</h2>
          </div>
          <button
            type="button"
            className="context-icon-dialog__close"
            onClick={onClose}
            disabled={isBusy}
          >
            Esc
          </button>
        </header>

        <div className="context-icon-dialog__content">
          <div className="context-icon-preview" aria-hidden="true">
            {previewUrl ? (
              <img src={previewUrl} alt="" className="context-icon-preview__image" />
            ) : (
              <span className="context-icon-preview__glyph">C</span>
            )}
          </div>

          <div
            className={`context-icon-dropzone${isDragActive ? " context-icon-dropzone--active" : ""}`}
            tabIndex={0}
            onDragEnter={(event) => {
              event.preventDefault();
              setIsDragActive(true);
            }}
            onDragOver={(event) => {
              event.preventDefault();
              setIsDragActive(true);
            }}
            onDragLeave={(event) => {
              event.preventDefault();
              if (event.currentTarget.contains(event.relatedTarget as Node | null)) {
                return;
              }

              setIsDragActive(false);
            }}
            onDrop={(event) => {
              event.preventDefault();
              setIsDragActive(false);
              void handleFile(extractFile(event.dataTransfer));
            }}
          >
            <input
              ref={inputRef}
              type="file"
              accept=".png,.svg,.webp,image/png,image/svg+xml,image/webp"
              className="context-icon-dropzone__input"
              onChange={(event) => {
                void handleFile(event.target.files?.item(0) ?? null);
                event.target.value = "";
              }}
            />

            <p className="context-icon-dropzone__title">Drop an icon here</p>
            <p className="context-icon-dropzone__hint">Or press Ctrl+V to paste an image.</p>

            <div className="context-icon-dialog__actions">
              <button
                type="button"
                className="context-icon-dialog__action"
                onClick={() => inputRef.current?.click()}
                disabled={isBusy}
              >
                Choose file
              </button>
              <button
                type="button"
                className="context-icon-dialog__action"
                onClick={() => {
                  setErrorMessage(null);
                  void onDelete().catch((error: unknown) => {
                    setErrorMessage(
                      error instanceof Error ? error.message : "Failed to delete context icon."
                    );
                  });
                }}
                disabled={isBusy || !context.iconUrl}
              >
                Remove icon
              </button>
            </div>

            {errorMessage ? <p className="context-icon-dialog__error">{errorMessage}</p> : null}
          </div>
        </div>
      </section>
    </div>
  );
}
