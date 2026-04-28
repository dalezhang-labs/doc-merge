"use client";

import { useState, useCallback } from "react";
import { Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { exportToPDF } from "../lib/pdf-exporter";
import { exportToJPG } from "../lib/jpg-exporter";
import type { PageLayout, MergeSettings } from "../lib/types";

interface ExportButtonProps {
  layouts: PageLayout[];
  settings: MergeSettings;
  disabled?: boolean;
}

/**
 * Export trigger button with progress indicator.
 * Calls the appropriate exporter (PDF or JPG) based on settings,
 * shows progress during processing, and triggers a browser download on completion.
 */
export function ExportButton({
  layouts,
  settings,
  disabled = false,
}: ExportButtonProps) {
  const [isExporting, setIsExporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const isEmpty = layouts.length === 0;

  const handleExport = useCallback(async () => {
    if (isEmpty || isExporting) return;

    setIsExporting(true);
    setProgress(0);
    setError(null);

    const onProgress = (current: number, total: number) => {
      setProgress(Math.round((current / total) * 100));
    };

    try {
      let blob: Blob;
      let filename: string;

      if (settings.exportFormat === "jpg") {
        blob = await exportToJPG(layouts, undefined, undefined, onProgress);
        filename = "merged-output.jpg";
      } else {
        blob = await exportToPDF(layouts, onProgress);
        filename = "merged-output.pdf";
      }

      // Trigger browser download
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Export failed. Please try again.";
      setError(message);
    } finally {
      setIsExporting(false);
      setProgress(0);
    }
  }, [layouts, settings.exportFormat, isEmpty, isExporting]);

  return (
    <div className="flex flex-col gap-2">
      {/* Progress bar (visible during export) */}
      {isExporting && (
        <Progress value={progress}>
          <span className="text-xs text-muted-foreground tabular-nums">
            {progress}%
          </span>
        </Progress>
      )}

      {/* Export button */}
      <Button
        onClick={handleExport}
        disabled={isEmpty || disabled || isExporting}
        className="w-full gap-2"
        size="lg"
      >
        {isExporting ? (
          <>
            <Loader2 className="size-4 animate-spin" />
            Exporting…
          </>
        ) : (
          <>
            <Download className="size-4" />
            Export as {settings.exportFormat.toUpperCase()}
          </>
        )}
      </Button>

      {/* Error message */}
      {error && (
        <p className="text-xs text-destructive" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
