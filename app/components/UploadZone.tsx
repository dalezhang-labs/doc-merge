"use client";

import { useCallback, useRef, useState } from "react";
import { Upload, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ACCEPTED_EXTENSIONS } from "../lib/constants";

interface UploadZoneProps {
  onFilesAdded: (files: File[]) => void;
  fileCount: number;
  maxFiles: number;
  disabled?: boolean;
}

const ACCEPT_STRING = ACCEPTED_EXTENSIONS.join(",");

/**
 * Drag-and-drop upload zone with click-to-upload fallback.
 * Shows a large drop zone when empty, a compact "add more" button when files exist,
 * and a disabled state when the file limit is reached.
 */
export function UploadZone({
  onFilesAdded,
  fileCount,
  maxFiles,
  disabled = false,
}: UploadZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const atLimit = fileCount >= maxFiles;
  const isEmpty = fileCount === 0;

  const handleFiles = useCallback(
    (fileList: FileList | null) => {
      if (!fileList || atLimit || disabled) return;
      onFilesAdded(Array.from(fileList));
    },
    [onFilesAdded, atLimit, disabled]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      handleFiles(e.dataTransfer.files);
    },
    [handleFiles]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleClick = useCallback(() => {
    if (!atLimit && !disabled) {
      inputRef.current?.click();
    }
  }, [atLimit, disabled]);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      handleFiles(e.target.files);
      // Reset so the same file can be re-selected
      if (inputRef.current) inputRef.current.value = "";
    },
    [handleFiles]
  );

  // Hidden file input shared by both modes
  const fileInput = (
    <input
      ref={inputRef}
      type="file"
      multiple
      accept={ACCEPT_STRING}
      onChange={handleInputChange}
      className="hidden"
      aria-label="Upload files"
    />
  );

  // Compact "add more" button when files already exist
  if (!isEmpty) {
    return (
      <div>
        {fileInput}
        <Button
          variant="outline"
          size="sm"
          onClick={handleClick}
          disabled={atLimit || disabled}
          className="gap-1.5"
        >
          <Plus className="size-3.5" />
          {atLimit ? `Limit reached (${maxFiles})` : "Add more files"}
        </Button>
      </div>
    );
  }

  // Large drop zone when empty
  return (
    <div
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onClick={handleClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          handleClick();
        }
      }}
      className={`
        flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed
        p-10 text-center cursor-pointer transition-colors select-none
        ${
          isDragOver
            ? "border-primary bg-primary/5"
            : "border-muted-foreground/25 hover:border-muted-foreground/40 hover:bg-muted/50"
        }
        ${disabled ? "pointer-events-none opacity-50" : ""}
      `}
    >
      {fileInput}
      <Upload className="size-8 text-muted-foreground" />
      <div>
        <p className="text-sm font-medium text-foreground">
          Drop files here or click to upload
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          PDF, PNG, JPG — up to {maxFiles} files
        </p>
      </div>
    </div>
  );
}
