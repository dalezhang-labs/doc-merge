"use client";

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

/**
 * Scrollable preview panel showing page thumbnails of the merged output.
 * Includes zoom control, page-level drag reorder via @dnd-kit, and
 * per-page rotation buttons.
 */
export function PreviewPanel({
  previews,
  isRendering,
  zoom,
  onZoomChange,
  onReorderPages,
  onRotatePage,
}: PreviewPanelProps) {
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
        <ZoomControl zoom={zoom} onZoomChange={onZoomChange} />
        {isRendering && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="size-3.5 animate-spin" />
            <span>Updating preview…</span>
          </div>
        )}
      </div>

      {/* Scrollable preview area with DnD */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={previews.map((p) => p.pageId)}
          strategy={verticalListSortingStrategy}
        >
          <div className="flex flex-1 flex-col items-center gap-4 overflow-y-auto rounded-lg bg-muted/30 p-4">
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
