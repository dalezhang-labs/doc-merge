"use client";

import React, { createContext, useReducer } from "react";
import {
  fileStoreReducer,
  initialFileStoreState,
  type FileStoreState,
  type FileStoreAction,
} from "../hooks/fileStoreReducer";

// ── Context ───────────────────────────────────────────────────────────

export interface FileStoreContextValue {
  state: FileStoreState;
  dispatch: React.Dispatch<FileStoreAction>;
}

export const FileStoreContext = createContext<FileStoreContextValue | null>(
  null
);

// ── Provider ──────────────────────────────────────────────────────────

interface FileStoreProviderProps {
  children: React.ReactNode;
}

export function FileStoreProvider({ children }: FileStoreProviderProps) {
  const [state, dispatch] = useReducer(fileStoreReducer, initialFileStoreState);

  return (
    <FileStoreContext.Provider value={{ state, dispatch }}>
      {children}
    </FileStoreContext.Provider>
  );
}
