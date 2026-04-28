"use client";

import React, { createContext, useState, useCallback } from "react";
import type { MergeSettings } from "../lib/types";
import { DEFAULT_SETTINGS } from "../lib/constants";

// ── Context ───────────────────────────────────────────────────────────

export interface SettingsContextValue {
  settings: MergeSettings;
  updateSettings: (partial: Partial<MergeSettings>) => void;
}

export const SettingsContext = createContext<SettingsContextValue | null>(null);

// ── Provider ──────────────────────────────────────────────────────────

interface SettingsProviderProps {
  children: React.ReactNode;
}

export function SettingsProvider({ children }: SettingsProviderProps) {
  const [settings, setSettings] = useState<MergeSettings>(DEFAULT_SETTINGS);

  const updateSettings = useCallback((partial: Partial<MergeSettings>) => {
    setSettings((prev) => ({ ...prev, ...partial }));
  }, []);

  return (
    <SettingsContext.Provider value={{ settings, updateSettings }}>
      {children}
    </SettingsContext.Provider>
  );
}
