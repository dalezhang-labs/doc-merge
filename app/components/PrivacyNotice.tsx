"use client";

import { Shield } from "lucide-react";

/**
 * A subtle privacy badge informing users that all processing
 * occurs locally in the browser — no data leaves the client.
 */
export function PrivacyNotice() {
  return (
    <div className="flex items-center gap-1.5 text-xs text-muted-foreground select-none">
      <Shield className="size-3.5 shrink-0" />
      <span>All processing happens locally in your browser. No files are uploaded.</span>
    </div>
  );
}
