import type {
  NormalizedPage,
  MergeSettings,
  PageLayout,
  ContentRect,
  PageSize,
  FillMode,
} from "./types";
import { PAGE_DIMENSIONS } from "./constants";

/**
 * Compute the target page dimensions and content placement for a single page.
 *
 * - "original" mode: target = source dimensions, content fills entire page.
 * - A4/Letter + fit: scale = min(pageW/srcW, pageH/srcH), centered with whitespace.
 * - A4/Letter + fill: scale = max(pageW/srcW, pageH/srcH), content covers page.
 * - Orientation auto-detection: landscape sources (width > height) swap A4/Letter dims.
 */
export function computePageDimensions(
  sourceWidth: number,
  sourceHeight: number,
  pageSize: PageSize,
  fillMode: FillMode
): { targetWidth: number; targetHeight: number; contentRect: ContentRect } {
  // Original mode: target = source, no scaling
  if (pageSize === "original") {
    return {
      targetWidth: sourceWidth,
      targetHeight: sourceHeight,
      contentRect: {
        x: 0,
        y: 0,
        width: sourceWidth,
        height: sourceHeight,
      },
    };
  }

  // Get base page dimensions for A4 or Letter
  const baseDims = PAGE_DIMENSIONS[pageSize];

  // Auto-detect orientation: swap page dims for landscape sources
  const isLandscape = sourceWidth > sourceHeight;
  const pageWidth = isLandscape ? baseDims.height : baseDims.width;
  const pageHeight = isLandscape ? baseDims.width : baseDims.height;

  // Compute scale based on fill mode
  const scale =
    fillMode === "fit"
      ? Math.min(pageWidth / sourceWidth, pageHeight / sourceHeight)
      : Math.max(pageWidth / sourceWidth, pageHeight / sourceHeight);

  const contentWidth = sourceWidth * scale;
  const contentHeight = sourceHeight * scale;

  // Center content within the page
  const x = (pageWidth - contentWidth) / 2;
  const y = (pageHeight - contentHeight) / 2;

  return {
    targetWidth: pageWidth,
    targetHeight: pageHeight,
    contentRect: { x, y, width: contentWidth, height: contentHeight },
  };
}

/**
 * Compute layout for all pages given the current merge settings.
 * Maps each NormalizedPage through computePageDimensions.
 */
export function computeLayout(
  pages: NormalizedPage[],
  settings: MergeSettings
): PageLayout[] {
  return pages.map((page) => {
    const rotation = page.rotation ?? 0;
    const isSwapped = rotation === 90 || rotation === 270;
    const sourceWidth = isSwapped ? page.height : page.width;
    const sourceHeight = isSwapped ? page.width : page.height;

    const { targetWidth, targetHeight, contentRect } = computePageDimensions(
      sourceWidth,
      sourceHeight,
      settings.pageSize,
      settings.fillMode
    );

    const orientation: "portrait" | "landscape" =
      targetWidth > targetHeight ? "landscape" : "portrait";

    return {
      page,
      targetWidth,
      targetHeight,
      contentRect,
      orientation,
    };
  });
}
