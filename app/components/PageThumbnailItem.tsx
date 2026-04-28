"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { PreviewPage } from "../lib/preview-renderer";

interface PageThumbnailItemProps {
  preview: PreviewPage;
  pageId: string;
  zoom: number;
  layout: "list" | "grid";
  onRotate: (pageId: string) => void;
}

/**
 * A single sortable page thumbnail in the preview panel.
 * Supports both list and grid layouts. In grid mode, shows a prominent
 * sequence number badge. High-res bitmap is CSS-scaled for crisp display.
 */
export function PageThumbnailItem({
  preview,
  pageId,
  zoom,
  layout,
  onRotate,
}: PageThumbnailItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: pageId });

  const sortableStyle = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const isGrid = layout === "grid";

  // Base display width depends on layout mode
  const BASE_WIDTH = isGrid ? 150 : 300;
  const aspectRatio = preview.height / preview.width;
  const displayWidth = BASE_WIDTH * (zoom / 100);
  const displayHeight = BASE_WIDTH * aspectRatio * (zoom / 100);

  return (
    <div
      ref={setNodeRef}
      style={sortableStyle}
      className={`flex flex-col items-center gap-1.5 ${
        isDragging ? "z-10 opacity-50" : ""
      }`}
    >
      {/* Thumbnail wrapper with controls overlay */}
      <div className="group relative">
        {/* Sequence number badge — always visible in grid, hover in list */}
        <span
          className={`absolute top-1 left-1/2 z-10 -translate-x-1/2 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-bold tabular-nums text-white backdrop-blur-sm ${
            isGrid ? "opacity-100" : "opacity-0 group-hover:opacity-100"
          } transition-opacity`}
        >
          {preview.pageNumber}
        </span>

        {/* Drag handle — top-left */}
        <button
          className="absolute top-1 left-1 z-10 flex cursor-grab items-center rounded bg-black/40 p-0.5 text-white opacity-0 backdrop-blur-sm transition-opacity group-hover:opacity-100 active:cursor-grabbing"
          aria-label="Drag to reorder page"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="size-3.5" />
        </button>

        {/* Rotate button — top-right */}
        <Button
          variant="ghost"
          size="icon-xs"
          className="absolute top-1 right-1 z-10 bg-black/40 text-white opacity-0 backdrop-blur-sm transition-opacity hover:bg-black/60 group-hover:opacity-100"
          onClick={() => onRotate(pageId)}
          aria-label={`Rotate page ${preview.pageNumber}`}
        >
          <RotateCw className="size-3" />
        </Button>

        {/* Thumbnail image */}
        <div
          className="overflow-hidden rounded-md shadow-sm ring-1 ring-foreground/5"
          style={{ width: displayWidth, height: displayHeight }}
        >
          <img
            src={preview.previewUrl}
            alt={`Page ${preview.pageNumber}`}
            width={preview.width}
            height={preview.height}
            className="block"
            style={{ width: "100%", height: "100%" }}
          />
        </div>
      </div>

      {/* Page number label — list mode only (grid uses the badge) */}
      {!isGrid && (
        <span className="text-xs text-muted-foreground tabular-nums">
          {preview.pageNumber}
        </span>
      )}
    </div>
  );
}
