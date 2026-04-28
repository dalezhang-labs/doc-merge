"use client";

import { useContext, useCallback } from "react";
import type { FileEntry, NormalizedPage, RotationAngle } from "../lib/types";
import { ingestFiles } from "../lib/file-ingestor";
import { normalizeFile } from "../lib/page-normalizer";
import { generateThumbnail, isPlaceholderThumbnail } from "../lib/thumbnail-renderer";
import { FileStoreContext } from "../providers/FileStoreProvider";

// Re-export reducer, types, and initial state for consumers and tests
export {
  fileStoreReducer,
  initialFileStoreState,
  type FileStoreState,
  type FileStoreAction,
} from "./fileStoreReducer";

// ── Hook ──────────────────────────────────────────────────────────────

export function useFileStore() {
  const context = useContext(FileStoreContext);
  if (!context) {
    throw new Error("useFileStore must be used within a FileStoreProvider");
  }

  const { state, dispatch } = context;

  const addFiles = useCallback(
    async (rawFiles: File[]) => {
      dispatch({ type: "SET_PROCESSING", payload: true });
      dispatch({ type: "SET_ERROR", payload: null });

      try {
        const result = await ingestFiles(rawFiles);

        if (result.accepted.length > 0) {
          dispatch({ type: "ADD_FILES", payload: result.accepted });
        }

        if (result.rejected.length > 0) {
          const names = result.rejected.map((r) => r.name).join(", ");
          dispatch({
            type: "SET_ERROR",
            payload: `Some files were rejected: ${names}`,
          });
        }

        // Process each accepted file: normalize pages + generate thumbnails
        // Run in background after ADD_FILES so the UI updates immediately
        for (const entry of result.accepted) {
          // Normalize: extract pages from the file
          try {
            const pages = await normalizeFile(entry);
            dispatch({ type: "SET_PAGES", payload: { fileId: entry.id, pages } });
            // Update page count for PDFs (images already have pageCount = 1)
            if (pages.length !== entry.pageCount) {
              dispatch({
                type: "UPDATE_FILE",
                payload: { id: entry.id, updates: { pageCount: pages.length } },
              });
            }
          } catch (err) {
            const message =
              err instanceof Error
                ? err.message
                : `Failed to process '${entry.name}'.`;
            dispatch({ type: "SET_ERROR", payload: message });
          }

          // Generate thumbnail
          try {
            const thumbnailUrl = await generateThumbnail(entry);
            dispatch({
              type: "UPDATE_FILE",
              payload: { id: entry.id, updates: { thumbnailUrl } },
            });
          } catch {
            // Thumbnail failure is non-critical; file still usable
          }
        }
      } finally {
        dispatch({ type: "SET_PROCESSING", payload: false });
      }
    },
    [dispatch]
  );

  const removeFile = useCallback(
    (id: string) => {
      // Clean up resources before removing from state
      const file = state.files.find((f) => f.id === id);
      if (file) {
        // Revoke thumbnail object URL (skip placeholder data URLs)
        if (file.thumbnailUrl && !isPlaceholderThumbnail(file.thumbnailUrl)) {
          URL.revokeObjectURL(file.thumbnailUrl);
        }
      }

      // Close ImageBitmaps for pages belonging to this file
      const filePages = state.pages.filter((p) => p.sourceFileId === id);
      for (const page of filePages) {
        if (page.imageBitmap) {
          page.imageBitmap.close();
        }
      }

      dispatch({ type: "REMOVE_FILE", payload: id });
    },
    [dispatch, state.files, state.pages]
  );

  const reorderFiles = useCallback(
    (activeId: string, overId: string) => {
      dispatch({ type: "REORDER", payload: { activeId, overId } });
    },
    [dispatch]
  );

  const reorderPages = useCallback(
    (activeId: string, overId: string) => {
      dispatch({ type: "REORDER_PAGES", payload: { activeId, overId } });
    },
    [dispatch]
  );

  const rotatePage = useCallback(
    (pageId: string) => {
      const page = state.pages.find((p) => p.id === pageId);
      const currentRotation = page?.rotation ?? 0;
      const nextRotation = ((currentRotation + 90) % 360) as RotationAngle;
      dispatch({
        type: "SET_PAGE_ROTATION",
        payload: { pageId, rotation: nextRotation },
      });
    },
    [dispatch, state.pages]
  );

  return { state, dispatch, addFiles, removeFile, reorderFiles, reorderPages, rotatePage };
}
