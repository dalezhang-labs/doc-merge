import { describe, it, expect } from "vitest";
import { computePageDimensions, computeLayout } from "./layout-engine";
import { PAGE_DIMENSIONS } from "./constants";
import type { NormalizedPage, MergeSettings } from "./types";

// Helper to create a minimal NormalizedPage for testing
function makePage(
  width: number,
  height: number,
  overrides?: Partial<NormalizedPage>
): NormalizedPage {
  return {
    id: overrides?.id ?? "page-1",
    sourceFileId: "file-1",
    sourcePageIndex: 0,
    type: "image",
    width,
    height,
    rotation: 0,
    ...overrides,
  };
}

describe("computePageDimensions", () => {
  describe("original mode", () => {
    it("returns source dimensions as target dimensions", () => {
      const result = computePageDimensions(800, 600, "original", "fit");
      expect(result.targetWidth).toBe(800);
      expect(result.targetHeight).toBe(600);
    });

    it("content rect fills entire page with no offset", () => {
      const result = computePageDimensions(1024, 768, "original", "fill");
      expect(result.contentRect).toEqual({
        x: 0,
        y: 0,
        width: 1024,
        height: 768,
      });
    });

    it("ignores fill mode setting", () => {
      const fit = computePageDimensions(500, 300, "original", "fit");
      const fill = computePageDimensions(500, 300, "original", "fill");
      expect(fit).toEqual(fill);
    });
  });

  describe("orientation auto-detection", () => {
    it("uses portrait page for portrait image on A4", () => {
      const result = computePageDimensions(400, 600, "a4", "fit");
      expect(result.targetWidth).toBe(PAGE_DIMENSIONS.a4.width); // 595
      expect(result.targetHeight).toBe(PAGE_DIMENSIONS.a4.height); // 842
    });

    it("swaps page dimensions for landscape image on A4", () => {
      const result = computePageDimensions(600, 400, "a4", "fit");
      expect(result.targetWidth).toBe(PAGE_DIMENSIONS.a4.height); // 842
      expect(result.targetHeight).toBe(PAGE_DIMENSIONS.a4.width); // 595
    });

    it("uses portrait page for portrait image on Letter", () => {
      const result = computePageDimensions(400, 600, "letter", "fit");
      expect(result.targetWidth).toBe(PAGE_DIMENSIONS.letter.width); // 612
      expect(result.targetHeight).toBe(PAGE_DIMENSIONS.letter.height); // 792
    });

    it("swaps page dimensions for landscape image on Letter", () => {
      const result = computePageDimensions(600, 400, "letter", "fit");
      expect(result.targetWidth).toBe(PAGE_DIMENSIONS.letter.height); // 792
      expect(result.targetHeight).toBe(PAGE_DIMENSIONS.letter.width); // 612
    });

    it("uses portrait for square image (width === height)", () => {
      const result = computePageDimensions(500, 500, "a4", "fit");
      // Square is not landscape (width > height is false), so portrait
      expect(result.targetWidth).toBe(PAGE_DIMENSIONS.a4.width);
      expect(result.targetHeight).toBe(PAGE_DIMENSIONS.a4.height);
    });
  });

  describe("fit mode", () => {
    it("content fits within page bounds", () => {
      const result = computePageDimensions(800, 600, "a4", "fit");
      const { contentRect } = result;
      expect(contentRect.x).toBeGreaterThanOrEqual(0);
      expect(contentRect.y).toBeGreaterThanOrEqual(0);
      expect(contentRect.x + contentRect.width).toBeLessThanOrEqual(
        result.targetWidth + 1e-9
      );
      expect(contentRect.y + contentRect.height).toBeLessThanOrEqual(
        result.targetHeight + 1e-9
      );
    });

    it("content is centered horizontally and vertically", () => {
      const result = computePageDimensions(400, 600, "a4", "fit");
      const { contentRect, targetWidth, targetHeight } = result;
      const expectedX = (targetWidth - contentRect.width) / 2;
      const expectedY = (targetHeight - contentRect.height) / 2;
      expect(contentRect.x).toBeCloseTo(expectedX, 9);
      expect(contentRect.y).toBeCloseTo(expectedY, 9);
    });

    it("preserves aspect ratio", () => {
      const srcW = 800;
      const srcH = 600;
      const result = computePageDimensions(srcW, srcH, "a4", "fit");
      const srcRatio = srcW / srcH;
      const contentRatio =
        result.contentRect.width / result.contentRect.height;
      expect(contentRatio).toBeCloseTo(srcRatio, 6);
    });

    it("uses min scale so content fits entirely", () => {
      // Very wide image on portrait A4
      const result = computePageDimensions(2000, 100, "a4", "fit");
      // Landscape auto-detection: page becomes 842 x 595
      const pageW = PAGE_DIMENSIONS.a4.height; // 842
      const pageH = PAGE_DIMENSIONS.a4.width; // 595
      const expectedScale = Math.min(pageW / 2000, pageH / 100);
      expect(result.contentRect.width).toBeCloseTo(2000 * expectedScale, 6);
      expect(result.contentRect.height).toBeCloseTo(100 * expectedScale, 6);
    });
  });

  describe("fill mode", () => {
    it("content covers entire page", () => {
      const result = computePageDimensions(800, 600, "a4", "fill");
      expect(result.contentRect.width).toBeGreaterThanOrEqual(
        result.targetWidth - 1e-9
      );
      expect(result.contentRect.height).toBeGreaterThanOrEqual(
        result.targetHeight - 1e-9
      );
    });

    it("content is centered (may have negative offsets for cropping)", () => {
      const result = computePageDimensions(400, 600, "a4", "fill");
      const { contentRect, targetWidth, targetHeight } = result;
      const expectedX = (targetWidth - contentRect.width) / 2;
      const expectedY = (targetHeight - contentRect.height) / 2;
      expect(contentRect.x).toBeCloseTo(expectedX, 9);
      expect(contentRect.y).toBeCloseTo(expectedY, 9);
    });

    it("preserves aspect ratio", () => {
      const srcW = 400;
      const srcH = 600;
      const result = computePageDimensions(srcW, srcH, "a4", "fill");
      const srcRatio = srcW / srcH;
      const contentRatio =
        result.contentRect.width / result.contentRect.height;
      expect(contentRatio).toBeCloseTo(srcRatio, 6);
    });

    it("uses max scale so content covers page", () => {
      const result = computePageDimensions(400, 600, "letter", "fill");
      // Portrait: page is 612 x 792
      const pageW = PAGE_DIMENSIONS.letter.width;
      const pageH = PAGE_DIMENSIONS.letter.height;
      const expectedScale = Math.max(pageW / 400, pageH / 600);
      expect(result.contentRect.width).toBeCloseTo(400 * expectedScale, 6);
      expect(result.contentRect.height).toBeCloseTo(600 * expectedScale, 6);
    });
  });
});

describe("computeLayout", () => {
  const defaultSettings: MergeSettings = {
    pageSize: "a4",
    fillMode: "fit",
    exportFormat: "pdf",
  };

  it("returns empty array for empty pages", () => {
    const result = computeLayout([], defaultSettings);
    expect(result).toEqual([]);
  });

  it("returns one layout per page", () => {
    const pages = [makePage(800, 600), makePage(400, 600, { id: "page-2" })];
    const result = computeLayout(pages, defaultSettings);
    expect(result).toHaveLength(2);
  });

  it("preserves page reference in layout", () => {
    const page = makePage(800, 600);
    const result = computeLayout([page], defaultSettings);
    expect(result[0].page).toBe(page);
  });

  it("sets orientation to landscape for landscape source on A4", () => {
    const page = makePage(800, 600); // landscape
    const result = computeLayout([page], defaultSettings);
    expect(result[0].orientation).toBe("landscape");
  });

  it("sets orientation to portrait for portrait source on A4", () => {
    const page = makePage(400, 600); // portrait
    const result = computeLayout([page], defaultSettings);
    expect(result[0].orientation).toBe("portrait");
  });

  it("uses original mode when pageSize is original", () => {
    const page = makePage(1024, 768);
    const settings: MergeSettings = {
      ...defaultSettings,
      pageSize: "original",
    };
    const result = computeLayout([page], settings);
    expect(result[0].targetWidth).toBe(1024);
    expect(result[0].targetHeight).toBe(768);
    expect(result[0].contentRect).toEqual({
      x: 0,
      y: 0,
      width: 1024,
      height: 768,
    });
  });

  it("applies fill mode correctly", () => {
    const page = makePage(400, 600);
    const settings: MergeSettings = {
      ...defaultSettings,
      fillMode: "fill",
    };
    const result = computeLayout([page], settings);
    expect(result[0].contentRect.width).toBeGreaterThanOrEqual(
      result[0].targetWidth - 1e-9
    );
    expect(result[0].contentRect.height).toBeGreaterThanOrEqual(
      result[0].targetHeight - 1e-9
    );
  });
});
