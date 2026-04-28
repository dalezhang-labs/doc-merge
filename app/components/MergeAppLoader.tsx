"use client";

import dynamic from "next/dynamic";

/**
 * Client-side dynamic loader for MergeApp.
 * Uses ssr: false to prevent pdfjs-dist from running during server-side rendering
 * (it requires browser APIs like DOMMatrix, OffscreenCanvas, etc.).
 */
const MergeApp = dynamic(
  () => import("./MergeApp").then((m) => ({ default: m.MergeApp })),
  { ssr: false }
);

export function MergeAppLoader() {
  return <MergeApp />;
}
