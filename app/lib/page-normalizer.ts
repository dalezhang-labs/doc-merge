import { getDocument, GlobalWorkerOptions } from "pdfjs-dist";
import type { FileEntry, NormalizedPage } from "./types";

// Configure pdfjs-dist worker for browser usage.
// Using URL constructor with import.meta.url ensures the worker file is resolved
// correctly by the bundler (webpack/turbopack).
if (typeof window !== "undefined") {
  GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.min.mjs",
    import.meta.url
  ).toString();
}

/**
 * Normalize a FileEntry into one or more NormalizedPage objects.
 *
 * - Images (png/jpg): loaded as ImageBitmap, producing a single page.
 * - PDFs: parsed with pdfjs-dist, producing one page per PDF page with
 *   source bytes stored for later embedding via pdf-lib.
 *
 * All processing is client-side only.
 */
export async function normalizeFile(
  entry: FileEntry
): Promise<NormalizedPage[]> {
  if (entry.type === "pdf") {
    return normalizePdf(entry);
  }
  return normalizeImage(entry);
}

/**
 * Load an image file as an ImageBitmap and return a single NormalizedPage.
 */
async function normalizeImage(entry: FileEntry): Promise<NormalizedPage[]> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(entry.file);
  } catch {
    throw new Error(
      `Failed to load image '${entry.name}'. The file may be corrupted or not a valid image.`
    );
  }

  return [
    {
      id: crypto.randomUUID(),
      sourceFileId: entry.id,
      sourcePageIndex: 0,
      type: "image",
      width: bitmap.width,
      height: bitmap.height,
      rotation: 0,
      imageBitmap: bitmap,
    },
  ];
}

/**
 * Parse a PDF file with pdfjs-dist and return one NormalizedPage per page.
 * Each page stores the full source bytes + page index so pdf-lib can later
 * copy pages from the original PDF without re-encoding.
 */
async function normalizePdf(entry: FileEntry): Promise<NormalizedPage[]> {
  let arrayBuffer: ArrayBuffer;
  try {
    arrayBuffer = await entry.file.arrayBuffer();
  } catch {
    throw new Error(
      `Failed to read PDF '${entry.name}'. The file may be corrupted.`
    );
  }

  const sourceBytes = new Uint8Array(arrayBuffer);

  let pdf;
  try {
    pdf = await getDocument({ data: sourceBytes.slice() }).promise;
  } catch {
    throw new Error(
      `Failed to parse PDF '${entry.name}'. The PDF may be encrypted or corrupted.`
    );
  }

  const pages: NormalizedPage[] = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    // Get viewport at scale 1.0 to obtain original page dimensions in PDF points
    const viewport = page.getViewport({ scale: 1.0 });

    pages.push({
      id: crypto.randomUUID(),
      sourceFileId: entry.id,
      sourcePageIndex: i - 1,
      type: "pdf-page",
      width: viewport.width,
      height: viewport.height,
      rotation: 0,
      pdfPageData: {
        sourceBytes,
        pageIndex: i - 1,
      },
    });
  }

  pdf.destroy();

  return pages;
}
