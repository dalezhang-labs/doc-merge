"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { FileEntry } from "../lib/types";

interface FileListItemProps {
  file: FileEntry;
  onRemove: (id: string) => void;
}

/**
 * Format bytes into a human-readable string (KB / MB).
 */
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Compact file entry in the sortable file list.
 * Shows a small thumbnail that enlarges on hover. File name is hidden
 * to save space — visible as a tooltip on hover. Drag handle + remove button.
 */
export function FileListItem({ file, onRemove }: FileListItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: file.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <Card
      ref={setNodeRef}
      style={style}
      size="sm"
      className={`
        flex-row items-center gap-2 px-2 py-1.5
        ${isDragging ? "opacity-50 shadow-lg ring-2 ring-primary/30" : ""}
      `}
    >
      {/* Drag handle */}
      <button
        className="flex shrink-0 cursor-grab touch-none items-center text-muted-foreground hover:text-foreground active:cursor-grabbing"
        aria-label="Drag to reorder"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="size-3.5" />
      </button>

      {/* Thumbnail — enlarges on hover via group/peer */}
      <div className="group/thumb relative shrink-0" title={file.name}>
        <div className="size-8 overflow-hidden rounded bg-muted transition-all duration-200 group-hover/thumb:size-32 group-hover/thumb:absolute group-hover/thumb:-top-12 group-hover/thumb:-left-2 group-hover/thumb:z-50 group-hover/thumb:rounded-lg group-hover/thumb:shadow-xl group-hover/thumb:ring-2 group-hover/thumb:ring-primary/20">
          {file.thumbnailUrl ? (
            <img
              src={file.thumbnailUrl}
              alt={file.name}
              className="size-full object-cover"
            />
          ) : (
            <div className="flex size-full items-center justify-center text-[10px] text-muted-foreground">
              {file.type.toUpperCase()}
            </div>
          )}
        </div>
      </div>

      {/* Compact info: type badge + size */}
      <div className="flex min-w-0 flex-1 items-center gap-1.5">
        <span className="rounded bg-muted px-1 py-0.5 text-[10px] font-medium uppercase text-muted-foreground">
          {file.type}
        </span>
        <span className="text-[11px] tabular-nums text-muted-foreground">
          {formatFileSize(file.size)}
        </span>
        {file.pageCount > 1 && (
          <span className="text-[11px] text-muted-foreground">
            · {file.pageCount}p
          </span>
        )}
      </div>

      {/* Remove button */}
      <Button
        variant="ghost"
        size="icon-xs"
        onClick={() => onRemove(file.id)}
        aria-label={`Remove ${file.name}`}
      >
        <X className="size-3" />
      </Button>
    </Card>
  );
}
