import type { FileEntry, NormalizedPage, RotationAngle } from "../lib/types";
import { FREE_TIER_MAX_FILES } from "../lib/constants";

// ── State & Action types ──────────────────────────────────────────────

export interface FileStoreState {
  files: FileEntry[];
  pages: NormalizedPage[];
  isProcessing: boolean;
  error: string | null;
}

export type FileStoreAction =
  | { type: "ADD_FILES"; payload: FileEntry[] }
  | { type: "REMOVE_FILE"; payload: string }
  | { type: "REORDER"; payload: { activeId: string; overId: string } }
  | { type: "SET_PAGES"; payload: { fileId: string; pages: NormalizedPage[] } }
  | { type: "SET_PROCESSING"; payload: boolean }
  | { type: "SET_ERROR"; payload: string | null }
  | { type: "UPDATE_FILE"; payload: { id: string; updates: Partial<Pick<FileEntry, "thumbnailUrl" | "pageCount">> } }
  | { type: "REORDER_PAGES"; payload: { activeId: string; overId: string } }
  | { type: "SET_PAGE_ROTATION"; payload: { pageId: string; rotation: RotationAngle } };

// ── Initial state ─────────────────────────────────────────────────────

export const initialFileStoreState: FileStoreState = {
  files: [],
  pages: [],
  isProcessing: false,
  error: null,
};

// ── Reducer (pure, exported for testing) ──────────────────────────────

export function fileStoreReducer(
  state: FileStoreState,
  action: FileStoreAction
): FileStoreState {
  switch (action.type) {
    case "ADD_FILES": {
      const currentCount = state.files.length;
      const remaining = FREE_TIER_MAX_FILES - currentCount;

      if (remaining <= 0) {
        return {
          ...state,
          error: `Free tier allows up to ${FREE_TIER_MAX_FILES} files. Upgrade to Pro for unlimited merging.`,
        };
      }

      const filesToAdd = action.payload.slice(0, remaining);
      const rejected = action.payload.length - filesToAdd.length;

      return {
        ...state,
        files: [...state.files, ...filesToAdd],
        error:
          rejected > 0
            ? `Free tier allows up to ${FREE_TIER_MAX_FILES} files. ${rejected} file(s) were not added. Upgrade to Pro for unlimited merging.`
            : null,
      };
    }

    case "REMOVE_FILE": {
      return {
        ...state,
        files: state.files.filter((f) => f.id !== action.payload),
        pages: state.pages.filter((p) => p.sourceFileId !== action.payload),
      };
    }

    case "REORDER": {
      const { activeId, overId } = action.payload;
      if (activeId === overId) return state;

      const files = [...state.files];
      const activeIndex = files.findIndex((f) => f.id === activeId);
      const overIndex = files.findIndex((f) => f.id === overId);

      if (activeIndex === -1 || overIndex === -1) return state;

      // Remove active item, then insert at over position
      const [movedItem] = files.splice(activeIndex, 1);
      const newOverIndex = files.findIndex((f) => f.id === overId);
      files.splice(newOverIndex, 0, movedItem);

      return { ...state, files };
    }

    case "SET_PAGES": {
      const { fileId, pages: newPages } = action.payload;
      // Remove existing pages for this file, then append new ones
      const filtered = state.pages.filter((p) => p.sourceFileId !== fileId);
      return { ...state, pages: [...filtered, ...newPages] };
    }

    case "SET_PROCESSING": {
      return { ...state, isProcessing: action.payload };
    }

    case "SET_ERROR": {
      return { ...state, error: action.payload };
    }

    case "UPDATE_FILE": {
      const { id, updates } = action.payload;
      return {
        ...state,
        files: state.files.map((f) =>
          f.id === id ? { ...f, ...updates } : f
        ),
      };
    }

    case "REORDER_PAGES": {
      const { activeId, overId } = action.payload;
      if (activeId === overId) return state;

      const pages = [...state.pages];
      const activeIndex = pages.findIndex((p) => p.id === activeId);
      const overIndex = pages.findIndex((p) => p.id === overId);

      if (activeIndex === -1 || overIndex === -1) return state;

      const [movedItem] = pages.splice(activeIndex, 1);
      const newOverIndex = pages.findIndex((p) => p.id === overId);
      pages.splice(newOverIndex, 0, movedItem);

      return { ...state, pages };
    }

    case "SET_PAGE_ROTATION": {
      const { pageId, rotation } = action.payload;
      return {
        ...state,
        pages: state.pages.map((p) =>
          p.id === pageId ? { ...p, rotation } : p
        ),
      };
    }

    default:
      return state;
  }
}
