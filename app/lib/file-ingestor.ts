import { ACCEPTED_EXTENSIONS } from "./constants";
import type { FileEntry, FileType } from "./types";

/** Result of ingesting a batch of files */
export interface IngestResult {
  accepted: FileEntry[];
  rejected: RejectedFile[];
}

/** A file that was rejected during ingestion */
export interface RejectedFile {
  name: string;
  reason: string;
}

/**
 * Extract the file extension from a filename, lowercased.
 * Returns empty string if no extension found.
 */
function getExtension(filename: string): string {
  const dotIndex = filename.lastIndexOf(".");
  if (dotIndex === -1 || dotIndex === filename.length - 1) return "";
  return filename.slice(dotIndex).toLowerCase();
}

/**
 * Classify a file extension to a FileType.
 * .pdf → "pdf", .png → "png", .jpg/.jpeg → "jpg"
 */
function classifyFileType(extension: string): FileType {
  switch (extension) {
    case ".pdf":
      return "pdf";
    case ".png":
      return "png";
    case ".jpg":
    case ".jpeg":
      return "jpg";
    default:
      throw new Error(`Unsupported extension: ${extension}`);
  }
}

/**
 * Check whether a File has an accepted format based on its extension.
 * Case-insensitive matching against ACCEPTED_EXTENSIONS.
 */
export function isAcceptedFormat(file: File): boolean {
  const ext = getExtension(file.name);
  return (ACCEPTED_EXTENSIONS as readonly string[]).includes(ext);
}

/**
 * Ingest a batch of files: validate formats, classify types, and generate FileEntry objects.
 * Returns accepted entries and rejected files with reasons.
 * All processing is client-side — no server calls.
 */
export async function ingestFiles(files: File[]): Promise<IngestResult> {
  const accepted: FileEntry[] = [];
  const rejected: RejectedFile[] = [];

  for (const file of files) {
    if (!isAcceptedFormat(file)) {
      const ext = getExtension(file.name);
      rejected.push({
        name: file.name,
        reason: ext
          ? `Unsupported file format: ${ext}. Accepted formats: PDF, PNG, JPG.`
          : `File has no extension. Accepted formats: PDF, PNG, JPG.`,
      });
      continue;
    }

    const ext = getExtension(file.name);
    const fileType = classifyFileType(ext);

    accepted.push({
      id: crypto.randomUUID(),
      file,
      name: file.name,
      size: file.size,
      type: fileType,
      thumbnailUrl: "", // generated later by thumbnail-renderer
      pageCount: fileType === "pdf" ? 0 : 1, // PDF page count updated later by page-normalizer
    });
  }

  return { accepted, rejected };
}
