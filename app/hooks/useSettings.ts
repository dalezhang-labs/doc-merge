"use client";

import { useContext, useCallback } from "react";
import type { MergeSettings } from "../lib/types";
import { DEFAULT_SETTINGS } from "../lib/constants";
import { SettingsContext } from "../providers/SettingsProvider";

// ── Re-export defaults for convenience ────────────────────────────────

export { DEFAULT_SETTINGS };

// ── Hook ──────────────────────────────────────────────────────────────

export function useSettings(): {
  settings: MergeSettings;
  updateSettings: (partial: Partial<MergeSettings>) => void;
} {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error("useSettings must be used within a SettingsProvider");
  }

  return context;
}
