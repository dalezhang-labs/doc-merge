"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useFileStore } from "../hooks/useFileStore";
import { useSettings } from "../hooks/useSettings";
import { useMergePreview } from "../hooks/useMergePreview";
import { FREE_TIER_MAX_FILES } from "../lib/constants";
import { isPlaceholderThumbnail } from "../lib/thumbnail-renderer";
import { UploadZone } from "./UploadZone";
import { FileList } from "./FileList";
import { SettingsBar } from "./SettingsBar";
import { PreviewPanel } from "./PreviewPanel";
import { ExportButton } from "./ExportButton";
import { PrivacyNotice } from "./PrivacyNotice";

/**
 * Inner layout component that consumes FileStore and Settings contexts.
 * Separated from MergeApp so hooks can access the providers.
 *
 * Layout: two-column on desktop (left = files, right = preview),
 * settings bar at top, export + privacy at bottom.
 */
export function MergeAppInner() {
  const { state, addFiles, removeFile, reorderFiles, reorderPages, rotatePage } = useFileStore();
  const { settings, updateSettings } = useSettings();
  const { previews, layouts, isRendering } = useMergePreview();
  const [zoom, setZoom] = useState(100);

  // Keep refs to latest state for unmount cleanup
  const stateRef = useRef(state);
  stateRef.current = state;

  // Stable ref for addFiles so the paste handler doesn't re-register on every render
  const addFilesRef = useRef(addFiles);
  addFilesRef.current = addFiles;

  // Listen for Ctrl+V / Cmd+V paste events to capture screenshots from clipboard
  const handlePaste = useCallback((e: ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    const imageFiles: File[] = [];
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.type.startsWith("image/")) {
        const blob = item.getAsFile();
        if (blob) {
          // Create a File with a descriptive name and correct extension
          const ext = item.type === "image/png" ? "png" : "jpg";
          const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
          const file = new File([blob], `screenshot-${timestamp}.${ext}`, {
            type: item.type,
          });
          imageFiles.push(file);
        }
      }
    }

    if (imageFiles.length > 0) {
      e.preventDefault();
      addFilesRef.current(imageFiles);
    }
  }, []);

  useEffect(() => {
    document.addEventListener("paste", handlePaste);
    return () => document.removeEventListener("paste", handlePaste);
  }, [handlePaste]);

  // Resource cleanup on unmount: close ImageBitmaps and revoke thumbnail URLs
  useEffect(() => {
    return () => {
      const { pages, files } = stateRef.current;
      // Close all ImageBitmaps from normalized pages
      for (const page of pages) {
        if (page.imageBitmap) {
          page.imageBitmap.close();
        }
      }
      // Revoke all thumbnail object URLs
      for (const file of files) {
        if (file.thumbnailUrl && !isPlaceholderThumbnail(file.thumbnailUrl)) {
          URL.revokeObjectURL(file.thumbnailUrl);
        }
      }
    };
  }, []);

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 md:p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold tracking-tight">Doc-Merge</h1>
        <PrivacyNotice />
      </div>

      {/* Settings bar */}
      <SettingsBar settings={settings} onSettingsChange={updateSettings} />

      {/* Error banner */}
      {state.error && (
        <div
          className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive"
          role="alert"
        >
          {state.error}
        </div>
      )}

      {/* Main content: two-column layout */}
      <div className="flex flex-1 flex-col gap-4 md:flex-row md:gap-6">
        {/* Left column: file list + upload */}
        <div className="flex w-full flex-col gap-3 md:w-80 md:shrink-0">
          <FileList
            files={state.files}
            onReorder={reorderFiles}
            onRemove={removeFile}
          />
          <UploadZone
            onFilesAdded={addFiles}
            fileCount={state.files.length}
            maxFiles={FREE_TIER_MAX_FILES}
            disabled={state.isProcessing}
          />
        </div>

        {/* Right column: preview */}
        <div className="flex flex-1 flex-col">
          <PreviewPanel
            previews={previews}
            isRendering={isRendering}
            zoom={zoom}
            onZoomChange={setZoom}
            onReorderPages={reorderPages}
            onRotatePage={rotatePage}
          />
        </div>
      </div>

      {/* Bottom: export button */}
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div className="w-full md:w-64">
          <ExportButton
            layouts={layouts}
            settings={settings}
            disabled={state.isProcessing}
          />
        </div>
      </div>
    </div>
  );
}
