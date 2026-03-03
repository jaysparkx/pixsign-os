"use client";

import React from "react";

interface State {
  hasError: boolean;
}

/**
 * Catches ChunkLoadError / CSS 404 after a new deploy and forces
 * a hard reload so the browser fetches fresh HTML with correct chunk hashes.
 * Prevents blank-white-page when Netlify CDN serves stale HTML.
 */
export class ChunkErrorBoundary extends React.Component<
  { children: React.ReactNode },
  State
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State | null {
    // ChunkLoadError (webpack), CSS MIME type error, or dynamic import failure
    if (
      error.name === "ChunkLoadError" ||
      error.message?.includes("Loading chunk") ||
      error.message?.includes("Loading CSS chunk") ||
      error.message?.includes("Failed to fetch dynamically imported module")
    ) {
      return { hasError: true };
    }
    return null;
  }

  componentDidCatch(error: Error) {
    const isChunkError =
      error.name === "ChunkLoadError" ||
      error.message?.includes("Loading chunk") ||
      error.message?.includes("Loading CSS chunk") ||
      error.message?.includes("Failed to fetch dynamically imported module");

    if (isChunkError) {
      // Guard against reload loops: only reload once per 30 seconds
      const lastReload = sessionStorage.getItem("chunk-reload-ts");
      const now = Date.now();
      if (!lastReload || now - Number(lastReload) > 30_000) {
        sessionStorage.setItem("chunk-reload-ts", String(now));
        window.location.reload();
      }
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-neutral-950">
          <div className="text-center space-y-4 p-8">
            <p className="text-lg font-medium text-slate-700 dark:text-neutral-300">
              A new version is available.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="px-5 py-2.5 bg-brand-500 text-white rounded-xl font-medium hover:bg-brand-600 transition-colors"
            >
              Reload Page
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
