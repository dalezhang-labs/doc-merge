import { getDocument, GlobalWorkerOptions } from "pdfjs-dist";
import type { FileEntry } from "./types";

/** Default thumbnail width in pixels. Callers can override. */
export const THUMBNAIL_WIDTH = 120;

/**
 * Placeholder SVG returned when thumbnail generation fails.
 * Renders a simple document icon on a neutral background.
 */
const PLACEHOLDER_SVG = `data:image/svg+xml,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="160" viewBox="0 0 120 160">
    <rect width="120" height="160" rx="8" fill="#f3f4f6"/>
    <path d="M40 50h25l15 15v45H40V50z" fill="none" stroke="#9ca3af" stroke-width="2"/>
    <path d="M65 50v15h15" fill="none" stroke="#9ca3af" stroke-width="2"/>
    <line x1="48" y1="80" x2="72" y2="80" stroke="#d1d5db" stroke-width="2"/>
    <line x1="48" y1="88" x2="72" y2="88" stroke="#d1d5db" stroke-width="2"/>
    <line x1="48" y1="96" x2="64" y2="96" stroke="#d1d5db" stroke-width="2"/>
  </svg>`
)}`;

// Configure pdfjs-dist worker for browser usage (guard for SSR).
if (typeof window !== "undefined") {
  GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.min.mjs",
    import.meta.url
  ).toString();
}

/**
 * Generate a thumbnail object URL for a FileEntry.
 *
 * - Images: scales down using Canvas API via createImageBitmap.
 * - PDFs: renders the first page at thumbnail resolution using pdfjs-dist.
 *
 * Returns an object URL (blob:...) on success, or a placeholder data URL on failure.
 *
 * **Important**: Callers should call `URL.revokeObjectURL(url)` on the returned
 * value when the thumbnail is no longer needed (e.g., on file removal or unmount)
 * to free memory. Placeholder data URLs do not need revocation.
 */
export async function generateThumbnail(
  entry: FileEntry,
  width: number = THUMBNAIL_WIDTH
): Promise<string> {
  try {
    if (entry.type === "pdf") {
      return await generatePdfThumbnail(entry, width);
    }
    return await generateImageThumbnail(entry, width);
  } catch {
    // Graceful degradation: return placeholder on any failure
    return PLACEHOLDER_SVG;
  }
}

/**
 * Scale an image file down to thumbnail size using Canvas API.
 */
async function generateImageThumbnail(
  entry: FileEntry,
  width: number
): Promise<string> {
  const bitmap = await createImageBitmap(entry.file);

  try {
    // Compute height maintaining aspect ratio
    const scale = width / bitmap.width;
    const height = Math.round(bitmap.height * scale);

    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("Failed to get 2d context from OffscreenCanvas");
    }

    ctx.drawImage(bitmap, 0, 0, width, height);

    const blob = await canvas.convertToBlob({ type: "image/png" });
    return URL.createObjectURL(blob);
  } finally {
    bitmap.close();
  }
}

/**
 * Render the first page of a PDF at thumbnail resolution using pdfjs-dist.
 */
async function generatePdfThumbnail(
  entry: FileEntry,
  width: number
): Promise<string> {
  const arrayBuffer = await entry.file.arrayBuffer();
  const pdf = await getDocument({ data: new Uint8Array(arrayBuffer) }).promise;

  try {
    const page = await pdf.getPage(1);

    // Compute scale so the rendered width matches the target thumbnail width
    const unscaledViewport = page.getViewport({ scale: 1.0 });
    const scale = width / unscaledViewport.width;
    const viewport = page.getViewport({ scale });

    const canvas = new OffscreenCanvas(
      Math.round(viewport.width),
      Math.round(viewport.height)
    );
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("Failed to get 2d context from OffscreenCanvas");
    }

    await page.render({
      canvas: null,
      canvasContext: ctx as unknown as CanvasRenderingContext2D,
      viewport,
    }).promise;

    const blob = await canvas.convertToBlob({ type: "image/png" });
    return URL.createObjectURL(blob);
  } finally {
    pdf.destroy();
  }
}

/**
 * Check whether a thumbnail URL is a placeholder (data URL) vs a real blob URL.
 * Useful for determining whether URL.revokeObjectURL is needed.
 */
export function isPlaceholderThumbnail(url: string): boolean {
  return url.startsWith("data:");
}
