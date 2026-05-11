import { useEffect, useState } from "react";
import { getCachedAssetObjectUrl, getCachedPdfFirstPagePreviewUrl } from "./assetFiles";

type FilePreviewProps = {
  contentType?: string;
  displayName?: string;
  fallbackUrl?: string;
  relativePath: string;
};

type PreviewState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; objectUrl: string };

/**
 * Renders an asset preview from a Documents-relative Tauri fs path.
 *
 * @example <FilePreview relativePath="items/id/file.pdf" contentType="application/pdf" />
 */
export function FilePreview(props: FilePreviewProps) {
  const [state, setState] = useState<PreviewState>({ status: "loading" });
  useAssetObjectUrl(props, setState);
  if (state.status === "loading") return <span className="pane-state">Loading asset...</span>;
  if (state.status === "error") return <span className="pane-state">{state.message}</span>;
  if (isImagePreview(props)) return <img alt={props.displayName || "image"} className="cm-markdown-image" src={state.objectUrl} />;
  if (isPdfPreview(props)) return <PdfFilePreview displayName={props.displayName} previewUrl={state.objectUrl} />;
  return <a className="cm-markdown-link" href={state.objectUrl} rel="noreferrer" target="_blank">Open {props.displayName || "asset"}</a>;
}

function useAssetObjectUrl(props: FilePreviewProps, setState: (state: PreviewState) => void): void {
  useEffect(() => {
    let disposed = false;
    cachedPreviewUrl(props).then((assetUrl) => {
      if (disposed) return;
      setState({ status: "ready", objectUrl: assetUrl.url });
    }).catch((error) => { if (!disposed) setState({ status: "error", message: assetErrorMessage(error) }); });
    return () => { disposed = true; };
  }, [props.contentType, props.fallbackUrl, props.relativePath, setState]);
}

async function cachedPreviewUrl(props: FilePreviewProps) {
  if (!isPdfPreview(props)) return getCachedAssetObjectUrl(props.relativePath, props.contentType, props.fallbackUrl);
  return (await getCachedPdfFirstPagePreviewUrl(props.relativePath)) ?? { url: "", revoke: false };
}

function PdfFilePreview({ displayName, previewUrl }: { displayName?: string; previewUrl: string }) {
  return (
    <figure className="cm-pdf-preview">
      {previewUrl ? <img alt={displayName || "PDF first page"} className="cm-pdf-preview__image" src={previewUrl} /> : null}
    </figure>
  );
}

function isImagePreview(props: FilePreviewProps): boolean {
  return props.contentType?.startsWith("image/") === true || imagePath(props.relativePath);
}

function isPdfPreview(props: FilePreviewProps): boolean {
  return props.contentType === "application/pdf" || props.relativePath.toLowerCase().endsWith(".pdf");
}

function imagePath(relativePath: string): boolean {
  return /\.(png|jpe?g|gif|webp|svg)$/i.test(relativePath);
}

function assetErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Failed to load asset preview.";
}
