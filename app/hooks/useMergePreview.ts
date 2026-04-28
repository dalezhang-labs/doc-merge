"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useFileStore } from "./useFileStore";
import { useSettings } from "./useSettings";
import { computeLayout } from "../lib/layout-engine";
import {
  renderPreviews,
  type PreviewPage,
} from "../lib/preview-renderer";
import type { PageLayout } from "../lib/types";

/** Default debounce delay in milliseconds. */
const DEBOUNCE_MS = 300;

/**
 * Hook that combines FileStore pages + Settings to compute layouts and render previews.
 *
 * - Uses computeLayout from layout-engine.ts to get PageLayout[]
 * - Calls renderPreviews to generate preview images
 * - Debounces re-rendering (300ms) to avoid excessive updates on rapid changes
 * - Cleans up old preview URLs (URL.revokeObjectURL) when previews are regenerated
 *
 * Returns the current previews, layouts, and a rendering status flag.
 */
export function useMergePreview(): {
  previews: PreviewPage[];
  layouts: PageLayout[];
  isRendering: boolean;
} {
  const { state } = useFileStore();
  const { settings } = useSettings();

  const [previews, setPreviews] = useState<PreviewPage[]>([]);
  const [layouts, setLayouts] = useState<PageLayout[]>([]);
  const [isRendering, setIsRendering] = useState(false);

  // Ref to track the latest preview URLs for cleanup
  const prevPreviewUrlsRef = useRef<string[]>([]);
  // Ref for debounce timer
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Ref to track if the component is still mounted
  const mountedRef = useRef(true);
  // Ref to track the current render generation (for stale render detection)
  const renderGenerationRef = useRef(0);

  // Revoke old preview URLs to free memory
  const revokeOldPreviews = useCallback(() => {
    for (const url of prevPreviewUrlsRef.current) {
      URL.revokeObjectURL(url);
    }
    prevPreviewUrlsRef.current = [];
  }, []);

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
      // Clean up debounce timer on unmount
      if (debounceTimerRef.current !== null) {
        clearTimeout(debounceTimerRef.current);
      }
      // Revoke all preview URLs on unmount
      revokeOldPreviews();
    };
  }, [revokeOldPreviews]);

  useEffect(() => {
    const { pages } = state;

    // Clear debounce timer if one is pending
    if (debounceTimerRef.current !== null) {
      clearTimeout(debounceTimerRef.current);
    }

    // If no pages, clear everything immediately
    if (pages.length === 0) {
      revokeOldPreviews();
      setLayouts([]);
      setPreviews([]);
      setIsRendering(false);
      return;
    }

    // Debounce the preview computation
    setIsRendering(true);

    debounceTimerRef.current = setTimeout(async () => {
      // Increment generation to detect stale renders
      const generation = ++renderGenerationRef.current;

      try {
        // Compute layouts synchronously
        const newLayouts = computeLayout(pages, settings);

        // Check if this render is still current
        if (!mountedRef.current || generation !== renderGenerationRef.current) {
          return;
        }

        setLayouts(newLayouts);

        // Render previews asynchronously
        const newPreviews = await renderPreviews(newLayouts);

        // Check again after async work
        if (!mountedRef.current || generation !== renderGenerationRef.current) {
          // Clean up the previews we just generated since they're stale
          for (const p of newPreviews) {
            URL.revokeObjectURL(p.previewUrl);
          }
          return;
        }

        // Revoke old preview URLs before setting new ones
        revokeOldPreviews();

        // Store new URLs for future cleanup
        prevPreviewUrlsRef.current = newPreviews.map((p) => p.previewUrl);

        setPreviews(newPreviews);
      } catch (error) {
        // On error, clear previews but keep layouts if available
        if (mountedRef.current && generation === renderGenerationRef.current) {
          revokeOldPreviews();
          setPreviews([]);
        }
      } finally {
        if (mountedRef.current && generation === renderGenerationRef.current) {
          setIsRendering(false);
        }
      }
    }, DEBOUNCE_MS);

    // Cleanup: cancel pending debounce if deps change before it fires
    return () => {
      if (debounceTimerRef.current !== null) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [state.pages, settings, revokeOldPreviews, state]);

  return { previews, layouts, isRendering };
}
