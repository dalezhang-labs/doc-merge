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
 * A single file entry in the sortable file list.
 * Shows thumbnail, filename, file size, page count, and a remove button.
 * Integrates with @dnd-kit/sortable for drag-to-reorder.
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
        flex-row items-center gap-3 px-3 py-2
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
        <GripVertical className="size-4" />
      </button>

      {/* Thumbnail */}
      <div className="size-10 shrink-0 overflow-hidden rounded-md bg-muted">
        {file.thumbnailUrl ? (
          <img
            src={file.thumbnailUrl}
            alt={`Thumbnail of ${file.name}`}
            className="size-full object-cover"
          />
        ) : (
          <div className="flex size-full items-center justify-center text-xs text-muted-foreground">
            {file.type.toUpperCase()}
          </div>
        )}
      </div>

      {/* File info */}
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-sm font-medium">{file.name}</span>
        <span className="text-xs text-muted-foreground">
          {formatFileSize(file.size)}
          {file.pageCount > 1 && ` · ${file.pageCount} pages`}
        </span>
      </div>

      {/* Remove button */}
      <Button
        variant="ghost"
        size="icon-xs"
        onClick={() => onRemove(file.id)}
        aria-label={`Remove ${file.name}`}
      >
        <X className="size-3.5" />
      </Button>
    </Card>
  );
}
