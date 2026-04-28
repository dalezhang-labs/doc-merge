/** Rotation angle in degrees (clockwise, multiples of 90) */
export type RotationAngle = 0 | 90 | 180 | 270;

/** Supported page sizes */
export type PageSize = "a4" | "letter" | "original";

/** Image fill modes */
export type FillMode = "fit" | "fill";

/** Export format options */
export type ExportFormat = "pdf" | "jpg";

/** Classified file type */
export type FileType = "pdf" | "png" | "jpg";

/** A file entry in the file list */
export interface FileEntry {
  id: string;
  file: File;
  name: string;
  size: number;
  type: FileType;
  thumbnailUrl: string;
  pageCount: number;
}

/** Merge settings with defaults */
export interface MergeSettings {
  pageSize: PageSize;
  fillMode: FillMode;
  exportFormat: ExportFormat;
}

/** A normalized page extracted from a source file */
export interface NormalizedPage {
  id: string;
  sourceFileId: string;
  sourcePageIndex: number;
  type: "pdf-page" | "image";
  width: number;
  height: number;
  rotation: RotationAngle;
  imageBitmap?: ImageBitmap;
  pdfPageData?: {
    sourceBytes: Uint8Array;
    pageIndex: number;
  };
}

/** Content placement rectangle within a page */
export interface ContentRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Computed layout for a single page in the merged output */
export interface PageLayout {
  page: NormalizedPage;
  targetWidth: number;
  targetHeight: number;
  contentRect: ContentRect;
  orientation: "portrait" | "landscape";
}
