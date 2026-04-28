"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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
  rectSortingStrategy,
} from "@dnd-kit/sortable";
import { Loader2, FileImage, LayoutList, LayoutGrid } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { PreviewPage } from "../lib/preview-renderer";
import { ZoomControl } from "./ZoomControl";
import { PageThumbnailItem } from "./PageThumbnailItem";

type LayoutMode = "list" | "grid";

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

export function PreviewPanel({
  previews,
  isRendering,
  zoom,
  onZoomChange,
  onReorderPages,
  onRotatePage,
}: PreviewPanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [layout, setLayout] = useState<LayoutMode>("list");

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      onReorderPages(String(active.id), String(over.id));
    }
  }

  // Use a native listener so we can call preventDefault() on the
  // non-passive wheel event (React's onWheel is passive by default
  // in modern browsers and cannot preventDefault).
  const zoomRef = useRef(zoom);
  zoomRef.current = zoom;
  const onZoomRef = useRef(onZoomChange);
  onZoomRef.current = onZoomChange;

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    function onWheel(e: WheelEvent) {
      if (!e.ctrlKey && !e.metaKey) return;
      // Prevent both the default browser zoom AND vertical scroll
      e.preventDefault();
      e.stopPropagation();
      const delta = e.deltaY > 0 ? -WHEEL_STEP : WHEEL_STEP;
      const next = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoomRef.current + delta));
      onZoomRef.current(next);
    }

    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

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

  const isGrid = layout === "grid";

  return (
    <div className="flex flex-1 flex-col gap-3 overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center gap-3">
        <ZoomControl zoom={zoom} onZoomChange={onZoomChange} min={MIN_ZOOM} max={MAX_ZOOM} step={WHEEL_STEP} />

        {/* Layout toggle */}
        <div className="flex items-center rounded-md border border-input">
          <Button
            variant={isGrid ? "ghost" : "secondary"}
            size="icon-xs"
            className="rounded-r-none"
            onClick={() => setLayout("list")}
            aria-label="List layout"
          >
            <LayoutList className="size-3.5" />
          </Button>
          <Button
            variant={isGrid ? "secondary" : "ghost"}
            size="icon-xs"
            className="rounded-l-none"
            onClick={() => setLayout("grid")}
            aria-label="Grid layout"
          >
            <LayoutGrid className="size-3.5" />
          </Button>
        </div>

        {isRendering && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="size-3.5 animate-spin" />
            <span>Updating…</span>
          </div>
        )}
      </div>

      {/* Scrollable + zoomable preview area */}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext
          items={previews.map((p) => p.pageId)}
          strategy={isGrid ? rectSortingStrategy : verticalListSortingStrategy}
        >
          <div
            ref={scrollRef}
            className={`flex-1 overflow-auto rounded-lg bg-muted/30 p-4 ${
              isGrid
                ? "grid auto-rows-max justify-center gap-4"
                : "flex flex-col items-center gap-4"
            }`}
            style={
              isGrid
                ? { gridTemplateColumns: `repeat(auto-fill, minmax(${Math.round(160 * (zoom / 100))}px, max-content))` }
                : undefined
            }
          >
            {previews.map((preview) => (
              <PageThumbnailItem
                key={preview.pageId}
                preview={preview}
                pageId={preview.pageId}
                zoom={zoom}
                layout={layout}
                onRotate={onRotatePage}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
}
