"use client";

import { useCallback, useRef } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { Loader2, FileImage } from "lucide-react";
import type { PreviewPage } from "../lib/preview-renderer";
import { ZoomControl } from "./ZoomControl";
import { PageThumbnailItem } from "./PageThumbnailItem";

interface PreviewPanelProps {
  previews: PreviewPage[];
  isRendering: boolean;
  zoom: number;
  onZoomChange: (zoom: number) => void;
  onReorderPages: (activeId: string, overId: string) => void;
  onRotatePage: (pageId: string) => void;
}

const MIN_ZOOM = 30;
const MAX_ZOOM = 400;
const WHEEL_STEP = 10;

/**
 * Scrollable preview panel with Ctrl+Wheel zoom, page-level DnD reorder,
 * and per-page rotation buttons. Preview images are rendered at high
 * resolution (1200px+) and displayed via CSS scaling for crisp results
 * at any zoom level.
 */
export function PreviewPanel({
  previews,
  isRendering,
  zoom,
  onZoomChange,
  onReorderPages,
  onRotatePage,
}: PreviewPanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      onReorderPages(String(active.id), String(over.id));
    }
  }

  // Ctrl+Wheel (or Cmd+Wheel on Mac) to zoom
  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      const delta = e.deltaY > 0 ? -WHEEL_STEP : WHEEL_STEP;
      const next = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom + delta));
      onZoomChange(next);
    },
    [zoom, onZoomChange]
  );

  // Empty state
  if (previews.length === 0 && !isRendering) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-muted-foreground/25 p-8 text-center">
        <FileImage className="size-10 text-muted-foreground/40" />
        <div>
          <p className="text-sm font-medium text-muted-foreground">
            Preview will appear here
          </p>
          <p className="mt-1 text-xs text-muted-foreground/70">
            Add files to see the merged output
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-3 overflow-hidden">
      {/* Toolbar: zoom control + loading indicator */}
      <div className="flex items-center gap-3">
        <ZoomControl
          zoom={zoom}
          onZoomChange={onZoomChange}
          min={MIN_ZOOM}
          max={MAX_ZOOM}
          step={WHEEL_STEP}
        />
        {isRendering && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="size-3.5 animate-spin" />
            <span>Updating preview…</span>
          </div>
        )}
      </div>

      {/* Scrollable + zoomable preview area with DnD */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={previews.map((p) => p.pageId)}
          strategy={verticalListSortingStrategy}
        >
          <div
            ref={scrollRef}
            onWheel={handleWheel}
            className="flex flex-1 flex-col items-center gap-4 overflow-auto rounded-lg bg-muted/30 p-4"
          >
            {previews.map((preview) => (
              <PageThumbnailItem
                key={preview.pageId}
                preview={preview}
                pageId={preview.pageId}
                zoom={zoom}
                onRotate={onRotatePage}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
}
