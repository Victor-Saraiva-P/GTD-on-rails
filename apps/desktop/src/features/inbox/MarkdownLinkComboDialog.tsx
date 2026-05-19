import { useState } from "react";
import { TerminalComboDialog } from "../../components/TerminalComboDialog";
import { readMarkdownLinkClipboardText } from "./markdownLinkClipboard";
import { dispatchInsertMarkdownLink } from "./markdownLinks";

type MarkdownLinkComboDialogProps = {
  onClose: () => void;
};

/**
 * Prompts for a URL and inserts it as a markdown link.
 *
 * @example <MarkdownLinkComboDialog onClose={close} />
 */
export function MarkdownLinkComboDialog({ onClose }: MarkdownLinkComboDialogProps) {
  const [url, setUrl] = useState("");

  return (
    <TerminalComboDialog
      title="Link"
      label="URL"
      value={url}
      placeholder="https://example.com"
      confirmKey="p"
      confirmLabel="Paste Link"
      onChange={setUrl}
      onCancel={onClose}
      onConfirm={() => confirmMarkdownLinkFromClipboard(url, onClose)}
    />
  );
}

async function confirmMarkdownLinkFromClipboard(fallbackUrl: string, onClose: () => void) {
  const clipboardUrl = await readMarkdownLinkClipboardText();
  const url = clipboardUrl || fallbackUrl;
  if (url.trim()) {
    dispatchInsertMarkdownLink(url);
  }
  onClose();
}
