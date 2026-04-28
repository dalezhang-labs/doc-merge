import { getDocument, GlobalWorkerOptions } from "pdfjs-dist";
import type { PageLayout } from "./types";
import { PREVIEW_SCALE } from "./constants";

// Configure pdfjs-dist worker for browser usage (guard for SSR).
if (typeof window !== "undefined") {
  GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.min.mjs",
    import.meta.url
  ).toString();
}

/** A single preview page with its rendered thumbnail URL and dimensions. */
export interface PreviewPage {
  pageNumber: number;
  pageId: string;
  previewUrl: string;
  width: number;
  height: number;
}

/** Default preview width in pixels.
 * Rendered at high resolution so Ctrl+Wheel zoom up to 400% stays sharp.
 * For a typical A4 page (595pt), this gives ~2× pixel density at 100% display,
 * and still looks crisp at 300%+ zoom. The UI layer controls display size via CSS. */
const DEFAULT_PREVIEW_WIDTH = 1200;

/**
 * Render preview thumbnails for each page in the merged output.
 *
 * For each PageLayout, renders a small preview image showing how the page
 * will look in the final output:
 * - Image pages: draws ImageBitmap onto a canvas at preview scale with contentRect positioning
 * - PDF pages: renders via pdfjs-dist at preview scale
 *
 * Returns an array of PreviewPage objects with blob object URLs.
 * Callers are responsible for calling URL.revokeObjectURL on each previewUrl
 * when the previews are no longer needed.
 */
export async function renderPreviews(
  layouts: PageLayout[],
  previewWidth: number = DEFAULT_PREVIEW_WIDTH
): Promise<PreviewPage[]> {
  const results: PreviewPage[] = [];

  for (let i = 0; i < layouts.length; i++) {
    const layout = layouts[i];
    const preview = await renderSinglePreview(layout, previewWidth, i + 1, layout.page.id);
    results.push(preview);
  }

  return results;
}

/**
 * Render a single page layout into a preview image.
 */
async function renderSinglePreview(
  layout: PageLayout,
  previewWidth: number,
  pageNumber: number,
  pageId: string
): Promise<PreviewPage> {
  // Compute preview scale: scale the target page down to previewWidth
  const scale = previewWidth / layout.targetWidth;
  const canvasWidth = Math.round(layout.targetWidth * scale);
  const canvasHeight = Math.round(layout.targetHeight * scale);

  const canvas = new OffscreenCanvas(canvasWidth, canvasHeight);
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Failed to get 2d context from OffscreenCanvas");
  }

  // Fill with white background (simulates page)
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);

  // Compute scaled content rect
  const scaledRect = {
    x: layout.contentRect.x * scale,
    y: layout.contentRect.y * scale,
    width: layout.contentRect.width * scale,
    height: layout.contentRect.height * scale,
  };

  const page = layout.page;
  const rotation = page.rotation ?? 0;
  const rotationRad = (rotation * Math.PI) / 180;

  if (page.type === "image" && page.imageBitmap) {
    if (rotation !== 0) {
      // Save canvas state, translate to content center, rotate, draw offset, restore
      ctx.save();
      const cx = scaledRect.x + scaledRect.width / 2;
      const cy = scaledRect.y + scaledRect.height / 2;
      ctx.translate(cx, cy);
      ctx.rotate(rotationRad);
      // For 90°/270°, the source image aspect is swapped relative to the content rect
      const isSwapped = rotation === 90 || rotation === 270;
      const drawW = isSwapped ? scaledRect.height : scaledRect.width;
      const drawH = isSwapped ? scaledRect.width : scaledRect.height;
      ctx.drawImage(page.imageBitmap, -drawW / 2, -drawH / 2, drawW, drawH);
      ctx.restore();
    } else {
      ctx.drawImage(
        page.imageBitmap,
        scaledRect.x,
        scaledRect.y,
        scaledRect.width,
        scaledRect.height
      );
    }
  } else if (page.type === "pdf-page" && page.pdfPageData) {
    if (rotation !== 0) {
      // Render PDF page to a temp canvas first, then draw with rotation
      const isSwapped = rotation === 90 || rotation === 270;
      const pdfDrawW = isSwapped ? scaledRect.height : scaledRect.width;
      const pdfDrawH = isSwapped ? scaledRect.width : scaledRect.height;

      // Render the PDF page at the pre-rotation dimensions
      const pdfTempRect = { x: 0, y: 0, width: pdfDrawW, height: pdfDrawH };
      const pdfTempCanvas = new OffscreenCanvas(
        Math.round(pdfDrawW),
        Math.round(pdfDrawH)
      );
      const pdfTempCtx = pdfTempCanvas.getContext("2d");
      if (pdfTempCtx) {
        await renderPdfPageToCanvas(
          pdfTempCtx as unknown as CanvasRenderingContext2D,
          page.pdfPageData.sourceBytes,
          page.pdfPageData.pageIndex,
          pdfTempRect
        );
        ctx.save();
        const cx = scaledRect.x + scaledRect.width / 2;
        const cy = scaledRect.y + scaledRect.height / 2;
        ctx.translate(cx, cy);
        ctx.rotate(rotationRad);
        ctx.drawImage(pdfTempCanvas, -pdfDrawW / 2, -pdfDrawH / 2, pdfDrawW, pdfDrawH);
        ctx.restore();
      }
    } else {
      await renderPdfPageToCanvas(
        ctx as unknown as CanvasRenderingContext2D,
        page.pdfPageData.sourceBytes,
        page.pdfPageData.pageIndex,
        scaledRect
      );
    }
  }

  const blob = await canvas.convertToBlob({ type: "image/png" });
  const previewUrl = URL.createObjectURL(blob);

  return {
    pageNumber,
    pageId,
    previewUrl,
    width: canvasWidth,
    height: canvasHeight,
  };
}

/**
 * Render a PDF page onto a canvas context at the specified rect.
 */
async function renderPdfPageToCanvas(
  ctx: CanvasRenderingContext2D,
  sourceBytes: Uint8Array,
  pageIndex: number,
  rect: { x: number; y: number; width: number; height: number }
): Promise<void> {
  const pdf = await getDocument({ data: sourceBytes.slice() }).promise;

  try {
    const page = await pdf.getPage(pageIndex + 1); // pdfjs uses 1-based indexing
    const unscaledViewport = page.getViewport({ scale: 1.0 });

    // Scale to fit the content rect
    const scaleX = rect.width / unscaledViewport.width;
    const scaleY = rect.height / unscaledViewport.height;
    const pdfScale = Math.min(scaleX, scaleY);

    // Apply resolution multiplier for sharper rendering.
    // The higher-res intermediate canvas is drawn onto the output canvas
    // at the original rect dimensions, producing crisp results on HiDPI.
    const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
    const hiResScale = pdfScale * PREVIEW_SCALE * dpr;

    const viewport = page.getViewport({ scale: hiResScale });

    // Create a temporary canvas for the PDF page render
    const tempCanvas = new OffscreenCanvas(
      Math.round(viewport.width),
      Math.round(viewport.height)
    );
    const tempCtx = tempCanvas.getContext("2d");
    if (!tempCtx) {
      throw new Error("Failed to get 2d context for PDF render");
    }

    await page.render({
      canvas: null,
      canvasContext: tempCtx as unknown as CanvasRenderingContext2D,
      viewport,
    }).promise;

    // Draw the rendered PDF page onto the main canvas at the content rect position
    // (downscaled from the higher-res intermediate canvas)
    ctx.drawImage(
      tempCanvas,
      rect.x,
      rect.y,
      rect.width,
      rect.height
    );
  } finally {
    pdf.destroy();
  }
}
