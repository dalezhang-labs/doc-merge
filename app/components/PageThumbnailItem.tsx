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
  onRotate: (pageId: string) => void;
}

/**
 * A single sortable page thumbnail in the preview panel.
 * Provides a drag handle (top-left), rotation button (top-right),
 * zoom-scaled thumbnail image, and page number label.
 */
export function PageThumbnailItem({
  preview,
  pageId,
  zoom,
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

  // Base display width in CSS pixels at 100% zoom.
  // The preview bitmap is rendered at 1200px for sharpness — we display
  // it at this base size and let zoom scale from here.  At 100% zoom the
  // image is downscaled 4× from the bitmap → super crisp.  At 400% zoom
  // it's displayed at ~1200px which matches the bitmap 1:1.
  const BASE_DISPLAY_WIDTH = 300;
  const aspectRatio = preview.height / preview.width;
  const displayWidth = BASE_DISPLAY_WIDTH * (zoom / 100);
  const displayHeight = BASE_DISPLAY_WIDTH * aspectRatio * (zoom / 100);

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

        {/* Thumbnail image — high-res bitmap scaled down for crisp display */}
        <div
          className="overflow-hidden rounded-md shadow-sm ring-1 ring-foreground/5"
          style={{
            width: displayWidth,
            height: displayHeight,
          }}
        >
          <img
            src={preview.previewUrl}
            alt={`Page ${preview.pageNumber}`}
            width={preview.width}
            height={preview.height}
            className="block"
            style={{
              width: "100%",
              height: "100%",
            }}
          />
        </div>
      </div>

      {/* Page number */}
      <span className="text-xs text-muted-foreground tabular-nums">
        {preview.pageNumber}
      </span>
    </div>
  );
}
