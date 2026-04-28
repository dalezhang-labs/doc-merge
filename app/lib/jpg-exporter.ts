import { getDocument, GlobalWorkerOptions } from "pdfjs-dist";
import type { PageLayout } from "./types";
import { JPG_UNIFORM_WIDTH, JPG_QUALITY, PDF_RASTER_SCALE } from "./constants";

/**
 * Maximum safe canvas dimension in pixels.
 * Browsers typically cap at ~16384px in either dimension.
 */
const MAX_CANVAS_DIMENSION = 16384;

/**
 * Compute the scaled dimensions for each page when rendered at a uniform width.
 * This is a pure function useful for testing Property 10 without rendering.
 *
 * Each page's height is scaled proportionally to maintain the original aspect ratio:
 *   scaledHeight = page.targetHeight * (uniformWidth / page.targetWidth)
 */
export function computeJpgPageDimensions(
  layouts: PageLayout[],
  uniformWidth: number
): { scaledWidth: number; scaledHeight: number }[] {
  return layouts.map((layout) => {
    const scale = uniformWidth / layout.targetWidth;
    return {
      scaledWidth: uniformWidth,
      scaledHeight: layout.targetHeight * scale,
    };
  });
}

/**
 * Render a single PDF page to an ImageBitmap using pdfjs-dist.
 * Creates a temporary canvas, renders the PDF page at the desired scale,
 * then returns the canvas for drawing onto the output canvas.
 */
async function renderPdfPageToCanvas(
  sourceBytes: Uint8Array,
  pageIndex: number,
  renderWidth: number,
  renderHeight: number
): Promise<HTMLCanvasElement | OffscreenCanvas> {
  // Ensure worker is configured
  if (typeof window !== "undefined" && !GlobalWorkerOptions.workerSrc) {
    GlobalWorkerOptions.workerSrc = new URL(
      "pdfjs-dist/build/pdf.worker.min.mjs",
      import.meta.url
    ).toString();
  }

  const pdf = await getDocument({ data: sourceBytes.slice() }).promise;
  const page = await pdf.getPage(pageIndex + 1); // pdfjs uses 1-based indexing
  const viewport = page.getViewport({ scale: 1.0 });

  // Compute the scale to render at the desired width, boosted by
  // PDF_RASTER_SCALE for sharper text when the result is drawn onto the
  // output canvas at the original dimensions.
  const scale = (renderWidth / viewport.width) * PDF_RASTER_SCALE;
  const scaledViewport = page.getViewport({ scale });

  // pdfjs-dist requires HTMLCanvasElement for rendering
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(scaledViewport.width);
  canvas.height = Math.ceil(scaledViewport.height);

  await page.render({ canvas, viewport: scaledViewport }).promise;
  pdf.destroy();

  return canvas;
}

/**
 * Export an array of PageLayout objects to a single long JPG image.
 *
 * All pages are rendered at a uniform width, with heights scaled proportionally
 * to maintain aspect ratios. Pages are vertically concatenated onto a single
 * tall canvas, which is then exported as a JPEG blob.
 *
 * @param layouts - Array of page layouts to render
 * @param uniformWidth - Width in pixels for all pages (default: 1200)
 * @param quality - JPEG quality from 0 to 1 (default: 0.92)
 * @param onProgress - Optional callback reporting (current, total) after each page
 * @returns A Blob containing the JPEG image data
 *
 * @throws Error if the total canvas height exceeds browser limits
 */
export async function exportToJPG(
  layouts: PageLayout[],
  uniformWidth: number = JPG_UNIFORM_WIDTH,
  quality: number = JPG_QUALITY,
  onProgress?: (current: number, total: number) => void
): Promise<Blob> {
  if (layouts.length === 0) {
    throw new Error("No pages to export.");
  }

  // Compute scaled dimensions for each page
  const dimensions = computeJpgPageDimensions(layouts, uniformWidth);

  // Compute total canvas height
  const totalHeight = Math.ceil(
    dimensions.reduce((sum, d) => sum + d.scaledHeight, 0)
  );

  // Check canvas size limits before creating the canvas
  if (totalHeight > MAX_CANVAS_DIMENSION) {
    throw new Error(
      "The merged output is too large for your browser. Try reducing the number of pages or using PDF format."
    );
  }

  if (uniformWidth > MAX_CANVAS_DIMENSION) {
    throw new Error(
      "The merged output is too large for your browser. Try reducing the number of pages or using PDF format."
    );
  }

  // Create the output canvas
  let outputCanvas: HTMLCanvasElement | OffscreenCanvas;
  let outputCtx:
    | CanvasRenderingContext2D
    | OffscreenCanvasRenderingContext2D
    | null;

  if (typeof OffscreenCanvas !== "undefined") {
    outputCanvas = new OffscreenCanvas(uniformWidth, totalHeight);
    outputCtx = outputCanvas.getContext(
      "2d"
    ) as OffscreenCanvasRenderingContext2D | null;
  } else {
    outputCanvas = document.createElement("canvas");
    outputCanvas.width = uniformWidth;
    outputCanvas.height = totalHeight;
    outputCtx = outputCanvas.getContext("2d");
  }

  if (!outputCtx) {
    throw new Error("Failed to get 2d context for output canvas");
  }

  // Fill background with white (JPEG has no transparency)
  outputCtx.fillStyle = "#FFFFFF";
  outputCtx.fillRect(0, 0, uniformWidth, totalHeight);

  // Render each page sequentially onto the output canvas
  const total = layouts.length;
  let currentY = 0;

  for (let i = 0; i < total; i++) {
    const layout = layouts[i];
    const { scaledHeight } = dimensions[i];
    const roundedHeight = Math.ceil(scaledHeight);

    if (layout.page.type === "image") {
      // Image pages: draw the ImageBitmap scaled to uniformWidth × scaledHeight
      if (!layout.page.imageBitmap) {
        throw new Error(
          `Image page '${layout.page.id}' is missing its ImageBitmap data.`
        );
      }

      const rotation = layout.page.rotation ?? 0;
      if (rotation !== 0) {
        const rotationRad = (rotation * Math.PI) / 180;
        const isSwapped = rotation === 90 || rotation === 270;
        // The slot dimensions (uniformWidth × roundedHeight) are post-rotation.
        // The source content needs to be drawn at pre-rotation dimensions then rotated.
        const drawW = isSwapped ? roundedHeight : uniformWidth;
        const drawH = isSwapped ? uniformWidth : roundedHeight;

        outputCtx.save();
        outputCtx.translate(uniformWidth / 2, currentY + roundedHeight / 2);
        outputCtx.rotate(rotationRad);
        outputCtx.drawImage(
          layout.page.imageBitmap,
          -drawW / 2,
          -drawH / 2,
          drawW,
          drawH
        );
        outputCtx.restore();
      } else {
        outputCtx.drawImage(
          layout.page.imageBitmap,
          0,
          currentY,
          uniformWidth,
          roundedHeight
        );
      }
    } else if (layout.page.type === "pdf-page") {
      // PDF pages: render via pdfjs-dist to an intermediate canvas, then draw
      if (!layout.page.pdfPageData) {
        throw new Error(
          `PDF page '${layout.page.id}' is missing its source data.`
        );
      }

      const rotation = layout.page.rotation ?? 0;

      if (rotation !== 0) {
        const rotationRad = (rotation * Math.PI) / 180;
        const isSwapped = rotation === 90 || rotation === 270;
        // Render the PDF page at pre-rotation dimensions
        const pdfRenderW = isSwapped ? roundedHeight : uniformWidth;
        const pdfRenderH = isSwapped ? uniformWidth : roundedHeight;

        const pdfCanvas = await renderPdfPageToCanvas(
          layout.page.pdfPageData.sourceBytes,
          layout.page.pdfPageData.pageIndex,
          pdfRenderW,
          pdfRenderH
        );

        outputCtx.save();
        outputCtx.translate(uniformWidth / 2, currentY + roundedHeight / 2);
        outputCtx.rotate(rotationRad);
        outputCtx.drawImage(pdfCanvas, -pdfRenderW / 2, -pdfRenderH / 2, pdfRenderW, pdfRenderH);
        outputCtx.restore();
      } else {
        const pdfCanvas = await renderPdfPageToCanvas(
          layout.page.pdfPageData.sourceBytes,
          layout.page.pdfPageData.pageIndex,
          uniformWidth,
          roundedHeight
        );

        outputCtx.drawImage(pdfCanvas, 0, currentY, uniformWidth, roundedHeight);
      }
    }

    currentY += roundedHeight;
    onProgress?.(i + 1, total);
  }

  // Export the canvas as a JPEG blob
  return canvasToJpegBlob(outputCanvas, quality);
}

/**
 * Convert a canvas (regular or OffscreenCanvas) to a JPEG Blob.
 */
async function canvasToJpegBlob(
  canvas: HTMLCanvasElement | OffscreenCanvas,
  quality: number
): Promise<Blob> {
  if (canvas instanceof OffscreenCanvas) {
    return canvas.convertToBlob({ type: "image/jpeg", quality });
  }

  // Fallback for regular HTMLCanvasElement
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("Failed to convert canvas to JPEG blob"));
          return;
        }
        resolve(blob);
      },
      "image/jpeg",
      quality
    );
  });
}
