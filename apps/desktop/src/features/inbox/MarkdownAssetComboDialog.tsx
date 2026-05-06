import { useState } from "react";
import { TerminalComboDialog } from "../../components/TerminalComboDialog";
import { readMarkdownAssetClipboardFile } from "./markdownAssetClipboard";
import { uploadStuffAsset } from "./api";

export const INSERT_BLOCK_ENTITY_EVENT = "gtd:insert-block-entity";

export type InsertBlockEntityEventDetail = {
  assetId: string;
  displayName: string;
  contentType: string;
  url: string;
  image: boolean;
};

export function dispatchInsertBlockEntity(assetId: string, displayName: string, contentType: string, url: string, image: boolean) {
  const detail: InsertBlockEntityEventDetail = { assetId, displayName, contentType, url, image };
  window.dispatchEvent(new CustomEvent(INSERT_BLOCK_ENTITY_EVENT, { detail }));
}

type MarkdownAssetComboDialogProps = {
  itemId: string;
  onClose: () => void;
};

/**
 * Uploads a clipboard asset and inserts it as a markdown link.
 *
 * @example <MarkdownAssetComboDialog itemId={item.id} onClose={close} />
 */
export function MarkdownAssetComboDialog({ itemId, onClose }: MarkdownAssetComboDialogProps) {
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  return (
    <TerminalComboDialog
      title="Asset"
      label="Clipboard Asset"
      value=""
      placeholder="PDF, Word, Excel or image"
      confirmKey="p"
      confirmLabel="Paste Asset"
      statusMessage={statusMessage}
      onChange={() => undefined}
      onCancel={onClose}
      onConfirm={() => confirmMarkdownAssetFromClipboard(itemId, onClose, setStatusMessage)}
    />
  );
}

async function confirmMarkdownAssetFromClipboard(
  itemId: string,
  onClose: () => void,
  setStatusMessage: (message: string | null) => void
) {
  const file = await readMarkdownAssetClipboardFile();
  if (!file) {
    setStatusMessage("No supported asset was detected in the clipboard.");
    return;
  }

  await uploadMarkdownAsset(itemId, file, onClose, setStatusMessage);
}

async function uploadMarkdownAsset(
  itemId: string,
  file: File,
  onClose: () => void,
  setStatusMessage: (message: string | null) => void
) {
  try {
    const asset = await uploadStuffAsset(itemId, file);
    dispatchInsertBlockEntity(asset.id, asset.fileName, asset.contentType, asset.url, asset.image);
    onClose();
  } catch (error) {
    setStatusMessage(error instanceof Error ? error.message : "Failed to upload asset.");
  }
}
