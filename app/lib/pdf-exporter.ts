import { PDFDocument, degrees } from "pdf-lib";
import type { PageLayout } from "./types";

/**
 * Convert an ImageBitmap to PNG bytes by rendering it onto an OffscreenCanvas.
 * Falls back to a regular canvas if OffscreenCanvas is not available.
 */
async function imageBitmapToPngBytes(
  bitmap: ImageBitmap
): Promise<Uint8Array> {
  // Prefer OffscreenCanvas for worker-friendly rendering
  if (typeof OffscreenCanvas !== "undefined") {
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("Failed to get 2d context from OffscreenCanvas");
    }
    ctx.drawImage(bitmap, 0, 0);
    const blob = await canvas.convertToBlob({ type: "image/png" });
    return new Uint8Array(await blob.arrayBuffer());
  }

  // Fallback to regular canvas
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Failed to get 2d context from canvas");
  }
  ctx.drawImage(bitmap, 0, 0);

  return new Promise<Uint8Array>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("Failed to convert canvas to PNG blob"));
          return;
        }
        blob.arrayBuffer().then(
          (buf) => resolve(new Uint8Array(buf)),
          reject
        );
      },
      "image/png"
    );
  });
}

/**
 * Export an array of PageLayout objects to a single PDF.
 *
 * - Image pages: rendered from ImageBitmap → PNG bytes → embedded in pdf-lib
 * - PDF pages: copied from source bytes using PDFDocument.load + copyPages
 *
 * Progress is reported via the optional onProgress callback after each page.
 * All processing is client-side only (Requirement 8.4).
 */
export async function exportToPDF(
  layouts: PageLayout[],
  onProgress?: (current: number, total: number) => void
): Promise<Blob> {
  const outputDoc = await PDFDocument.create();
  const total = layouts.length;

  for (let i = 0; i < total; i++) {
    const layout = layouts[i];
    const { page: normalizedPage, targetWidth, targetHeight, contentRect } =
      layout;

    if (normalizedPage.type === "image") {
      await embedImagePage(outputDoc, normalizedPage, targetWidth, targetHeight, contentRect);
    } else if (normalizedPage.type === "pdf-page") {
      await embedPdfPage(outputDoc, normalizedPage, targetWidth, targetHeight, contentRect);
    }

    onProgress?.(i + 1, total);
  }

  const pdfBytes = await outputDoc.save();
  return new Blob([pdfBytes.buffer as ArrayBuffer], { type: "application/pdf" });
}

/**
 * Embed an image page into the output PDF document.
 * Converts the ImageBitmap to PNG bytes, embeds it, and draws it at the
 * computed contentRect position within a page of targetWidth × targetHeight.
 * For rotated images, a temporary canvas applies the rotation before embedding.
 */
async function embedImagePage(
  outputDoc: PDFDocument,
  normalizedPage: PageLayout["page"],
  targetWidth: number,
  targetHeight: number,
  contentRect: PageLayout["contentRect"]
): Promise<void> {
  if (!normalizedPage.imageBitmap) {
    throw new Error(
      `Image page '${normalizedPage.id}' is missing its ImageBitmap data.`
    );
  }

  const rotation = normalizedPage.rotation ?? 0;
  let pngBytes: Uint8Array;

  if (rotation !== 0) {
    // Create a temporary canvas at post-rotation dimensions and apply rotation
    const isSwapped = rotation === 90 || rotation === 270;
    const rotatedW = isSwapped ? normalizedPage.imageBitmap.height : normalizedPage.imageBitmap.width;
    const rotatedH = isSwapped ? normalizedPage.imageBitmap.width : normalizedPage.imageBitmap.height;

    const tempCanvas = new OffscreenCanvas(rotatedW, rotatedH);
    const tempCtx = tempCanvas.getContext("2d");
    if (!tempCtx) {
      throw new Error("Failed to get 2d context for rotation canvas");
    }

    const rotationRad = (rotation * Math.PI) / 180;
    tempCtx.translate(rotatedW / 2, rotatedH / 2);
    tempCtx.rotate(rotationRad);
    tempCtx.drawImage(
      normalizedPage.imageBitmap,
      -normalizedPage.imageBitmap.width / 2,
      -normalizedPage.imageBitmap.height / 2
    );

    const blob = await tempCanvas.convertToBlob({ type: "image/png" });
    pngBytes = new Uint8Array(await blob.arrayBuffer());
  } else {
    pngBytes = await imageBitmapToPngBytes(normalizedPage.imageBitmap);
  }

  const embeddedImage = await outputDoc.embedPng(pngBytes);

  const page = outputDoc.addPage([targetWidth, targetHeight]);

  // pdf-lib uses a bottom-left coordinate system, so we need to flip the y-axis.
  // contentRect.y is from the top, so convert: pdfY = targetHeight - contentRect.y - contentRect.height
  const pdfY = targetHeight - contentRect.y - contentRect.height;

  page.drawImage(embeddedImage, {
    x: contentRect.x,
    y: pdfY,
    width: contentRect.width,
    height: contentRect.height,
  });
}

/**
 * Embed a PDF page into the output PDF document.
 * Loads the source PDF, copies the specific page, and adds it to the output.
 * If the source page dimensions differ from the target, the page is scaled
 * to fit within the contentRect. For rotated pages, applies the rotation
 * via pdf-lib's setRotation.
 */
async function embedPdfPage(
  outputDoc: PDFDocument,
  normalizedPage: PageLayout["page"],
  targetWidth: number,
  targetHeight: number,
  contentRect: PageLayout["contentRect"]
): Promise<void> {
  if (!normalizedPage.pdfPageData) {
    throw new Error(
      `PDF page '${normalizedPage.id}' is missing its source data.`
    );
  }

  const { sourceBytes, pageIndex } = normalizedPage.pdfPageData;
  const rotation = normalizedPage.rotation ?? 0;

  const sourceDoc = await PDFDocument.load(sourceBytes, {
    ignoreEncryption: true,
  });

  const [copiedPage] = await outputDoc.copyPages(sourceDoc, [pageIndex]);

  // Get the original page dimensions from the source
  const { width: srcWidth, height: srcHeight } = copiedPage.getSize();

  // Apply rotation if non-zero
  if (rotation !== 0) {
    copiedPage.setRotation(degrees(rotation));
  }

  // Check if the source page dimensions match the target
  const dimensionsMatch =
    Math.abs(srcWidth - targetWidth) < 0.5 &&
    Math.abs(srcHeight - targetHeight) < 0.5;

  if (dimensionsMatch && rotation === 0) {
    // Dimensions match and no rotation — add the copied page directly
    outputDoc.addPage(copiedPage);
  } else if (rotation !== 0) {
    // For rotated pages, the layout engine has already swapped dimensions.
    // We set the rotation on the copied page and adjust the media box
    // to match the target dimensions.
    const isSwapped = rotation === 90 || rotation === 270;

    // The media box should be set to the original (pre-rotation) dimensions
    // because pdf-lib's setRotation handles the visual rotation.
    // The target dimensions from the layout engine are post-rotation.
    const mediaW = isSwapped ? targetHeight : targetWidth;
    const mediaH = isSwapped ? targetWidth : targetHeight;

    copiedPage.setMediaBox(0, 0, mediaW, mediaH);
    copiedPage.setSize(mediaW, mediaH);

    // Scale factors to map source content into the media box
    const sx = mediaW / srcWidth;
    const sy = mediaH / srcHeight;

    if (Math.abs(sx - 1) > 0.001 || Math.abs(sy - 1) > 0.001) {
      copiedPage.scaleContent(sx, sy);
    }

    outputDoc.addPage(copiedPage);
  } else {
    // Dimensions differ — adjust the copied page's MediaBox and apply a
    // content-stream transformation to scale/translate the original vector
    // content into the target contentRect.

    // Scale factors to map source content into the contentRect
    const sx = contentRect.width / srcWidth;
    const sy = contentRect.height / srcHeight;

    // Translation in PDF bottom-left coordinate system
    const tx = contentRect.x;
    const ty = targetHeight - contentRect.y - contentRect.height;

    // Resize the page boundary to the target dimensions
    copiedPage.setMediaBox(0, 0, targetWidth, targetHeight);
    copiedPage.setSize(targetWidth, targetHeight);

    // Scale the existing content stream (wraps with q … Q)
    copiedPage.scaleContent(sx, sy);

    // Translate the scaled content to the correct position
    copiedPage.translateContent(tx, ty);

    outputDoc.addPage(copiedPage);
  }
}
