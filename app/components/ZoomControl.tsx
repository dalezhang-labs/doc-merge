"use client";

import { ZoomIn } from "lucide-react";

interface ZoomControlProps {
  zoom: number;
  onZoomChange: (zoom: number) => void;
  min?: number;
  max?: number;
  step?: number;
}

/**
 * Compact zoom slider for the preview toolbar.
 * Displays a ZoomIn icon, a native range input, and the current zoom percentage.
 * Clamps input values to [min, max].
 */
export function ZoomControl({
  zoom,
  onZoomChange,
  min = 50,
  max = 200,
  step = 10,
}: ZoomControlProps) {
  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = Number(e.target.value);
    const clamped = Math.min(max, Math.max(min, raw));
    onZoomChange(clamped);
  }

  return (
    <div className="flex items-center gap-2">
      <ZoomIn className="size-4 text-muted-foreground" />
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={zoom}
        onChange={handleChange}
        className="h-1.5 w-24 cursor-pointer appearance-none rounded-full bg-muted accent-primary"
        aria-label="Preview zoom"
      />
      <span className="min-w-[3ch] text-xs tabular-nums text-muted-foreground">
        {zoom}%
      </span>
    </div>
  );
}
