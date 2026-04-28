"use client";

import { FileStoreProvider } from "../providers/FileStoreProvider";
import { SettingsProvider } from "../providers/SettingsProvider";
import { MergeAppInner } from "./MergeAppInner";

/**
 * Top-level client component for Doc-Merge.
 * Wraps the app in FileStoreProvider and SettingsProvider,
 * then renders the inner layout that consumes those contexts.
 */
export function MergeApp() {
  return (
    <FileStoreProvider>
      <SettingsProvider>
        <MergeAppInner />
      </SettingsProvider>
    </FileStoreProvider>
  );
}
