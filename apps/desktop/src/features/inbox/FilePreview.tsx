import { useEffect, useState } from "react";
import { getCachedAssetObjectUrl, getCachedPdfFirstPagePreviewUrl } from "./assetFiles";

type FilePreviewProps = Readonly<{
  contentType?: string;
  displayName?: string;
  fallbackUrl?: string;
  relativePath: string;
}>;

type PreviewState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; assetUrl: string; pdfPreviewUrl: string | null };

type CachedPreviewUrl = {
  assetUrl: string;
  pdfPreviewUrl: string | null;
};

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
  if (isImagePreview(props)) return <img alt={props.displayName || "image"} className="cm-markdown-image" src={state.assetUrl} />;
  if (isPdfPreview(props)) return <PdfFilePreview assetUrl={state.assetUrl} displayName={props.displayName} previewUrl={state.pdfPreviewUrl} />;
  return <AssetLink assetUrl={state.assetUrl} displayName={props.displayName} />;
}

function useAssetObjectUrl(props: FilePreviewProps, setState: (state: PreviewState) => void): void {
  useEffect(() => {
    let disposed = false;
    cachedPreviewUrl(props).then((assetUrl) => {
      if (disposed) return;
      setState({ status: "ready", assetUrl: assetUrl.assetUrl, pdfPreviewUrl: assetUrl.pdfPreviewUrl });
    }).catch((error) => { if (!disposed) setState({ status: "error", message: assetErrorMessage(error) }); });
    return () => { disposed = true; };
  }, [props.contentType, props.fallbackUrl, props.relativePath, setState]);
}

async function cachedPreviewUrl(props: FilePreviewProps): Promise<CachedPreviewUrl> {
  const assetUrl = await getCachedAssetObjectUrl(props.relativePath, props.contentType, props.fallbackUrl);
  if (!isPdfPreview(props)) return { assetUrl: assetUrl.url, pdfPreviewUrl: null };

  const previewUrl = await getCachedPdfFirstPagePreviewUrl(props.relativePath).catch(() => null);
  return { assetUrl: assetUrl.url, pdfPreviewUrl: previewUrl?.url ?? null };
}

function PdfFilePreview({ assetUrl, displayName, previewUrl }: Readonly<{ assetUrl: string; displayName?: string; previewUrl: string | null }>) {
  return (
    <figure className="cm-pdf-preview">
      {previewUrl ? <img alt={displayName || "PDF first page"} className="cm-pdf-preview__image" src={previewUrl} /> : null}
      {!previewUrl ? <AssetLink assetUrl={assetUrl} displayName={displayName || "PDF"} /> : null}
    </figure>
  );
}

function AssetLink({ assetUrl, displayName }: Readonly<{ assetUrl: string; displayName?: string }>) {
  return <a className="cm-markdown-link" href={assetUrl} rel="noreferrer" target="_blank">Open {displayName || "asset"}</a>;
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
  if (typeof error === "string") return error;
  return error instanceof Error ? error.message : "Failed to load asset preview.";
}
