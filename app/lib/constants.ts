import type { MergeSettings } from "./types";

/** Page dimensions in PDF points (1 point = 1/72 inch) */
export const PAGE_DIMENSIONS = {
  a4: { width: 595, height: 842 },
  letter: { width: 612, height: 792 },
} as const;

/** Accepted file extensions */
export const ACCEPTED_EXTENSIONS = [".pdf", ".png", ".jpg", ".jpeg"] as const;

/** Accepted MIME types */
export const ACCEPTED_MIME_TYPES = [
  "application/pdf",
  "image/png",
  "image/jpeg",
] as const;

/** Free tier limits */
export const FREE_TIER_MAX_FILES = 5;

/** Long JPG defaults */
export const JPG_UNIFORM_WIDTH = 1200;
export const JPG_QUALITY = 0.92;

/** Resolution multiplier for PDF page rasterization in JPG export */
export const PDF_RASTER_SCALE = 2;

/** Resolution multiplier for PDF page rasterization in preview rendering */
export const PREVIEW_SCALE = 2;

/** Default settings */
export const DEFAULT_SETTINGS: MergeSettings = {
  pageSize: "a4",
  fillMode: "fit",
  exportFormat: "pdf",
};
