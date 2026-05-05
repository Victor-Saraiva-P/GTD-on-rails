import { useState } from "react";
import { TerminalComboDialog } from "../../components/TerminalComboDialog";
import { dispatchInsertMarkdownLink } from "./markdownLinks";
import { readMarkdownAssetClipboardFile } from "./markdownAssetClipboard";
import { uploadStuffAsset } from "./api";

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
    dispatchInsertMarkdownLink(asset.url, asset.fileName, asset.image);
    onClose();
  } catch (error) {
    setStatusMessage(error instanceof Error ? error.message : "Failed to upload asset.");
  }
}
