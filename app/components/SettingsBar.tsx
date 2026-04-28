"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { MergeSettings, PageSize, FillMode, ExportFormat } from "../lib/types";

interface SettingsBarProps {
  settings: MergeSettings;
  onSettingsChange: (settings: Partial<MergeSettings>) => void;
}

/**
 * Compact horizontal settings bar with selectors for page size, fill mode,
 * and export format. Uses shadcn/ui Select components.
 */
export function SettingsBar({ settings, onSettingsChange }: SettingsBarProps) {
  return (
    <div className="flex flex-wrap items-center gap-4">
      {/* Page Size */}
      <div className="flex items-center gap-2">
        <label className="text-xs font-medium text-muted-foreground whitespace-nowrap">
          Page Size
        </label>
        <Select
          value={settings.pageSize}
          onValueChange={(val) => {
            if (val) onSettingsChange({ pageSize: val as PageSize });
          }}
        >
          <SelectTrigger size="sm" className="w-[100px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="a4">A4</SelectItem>
            <SelectItem value="letter">Letter</SelectItem>
            <SelectItem value="original">Original</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Fill Mode */}
      <div className="flex items-center gap-2">
        <label className="text-xs font-medium text-muted-foreground whitespace-nowrap">
          Fill Mode
        </label>
        <Select
          value={settings.fillMode}
          onValueChange={(val) => {
            if (val) onSettingsChange({ fillMode: val as FillMode });
          }}
        >
          <SelectTrigger size="sm" className="w-[80px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="fit">Fit</SelectItem>
            <SelectItem value="fill">Fill</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Export Format */}
      <div className="flex items-center gap-2">
        <label className="text-xs font-medium text-muted-foreground whitespace-nowrap">
          Format
        </label>
        <Select
          value={settings.exportFormat}
          onValueChange={(val) => {
            if (val) onSettingsChange({ exportFormat: val as ExportFormat });
          }}
        >
          <SelectTrigger size="sm" className="w-[80px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="pdf">PDF</SelectItem>
            <SelectItem value="jpg">JPG</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
