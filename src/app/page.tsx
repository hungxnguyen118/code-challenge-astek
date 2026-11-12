"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Overrides, RawWorkbook } from "@/lib/types";
import { analyzeWorkbook, readWorkbook, IngestError } from "@/lib/parser";
import { UploadZone } from "@/components/UploadZone";
import { ErrorPanel, type UiError } from "@/components/ErrorPanel";
import { ResultView } from "@/components/ResultView";

type Phase = { kind: "idle" } | { kind: "loading"; fileName: string } | { kind: "error"; error: UiError } | { kind: "ready"; raw: RawWorkbook };

/**
 * Single-page flow: Upload → (parse) → Review & fix → Export.
 *
 * Everything runs in the browser: the file never leaves the user's machine, and
 * no backend is required. The parsed workbook (`raw`) is kept, and the analysis
 * is recomputed from (raw, overrides) whenever the user corrects something.
 */
export default function Home() {
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const [overrides, setOverrides] = useState<Overrides>({});

  const handleFile = useCallback(async (name: string, load: () => Promise<ArrayBuffer>) => {
    setPhase({ kind: "loading", fileName: name });
    setOverrides({});
    try {
      const data = await load();
      // Yield one frame so the loading state renders before the (synchronous) parse.
      await new Promise((r) => setTimeout(r, 30));
      const raw = readWorkbook(name, data);
      setPhase({ kind: "ready", raw });
    } catch (err) {
      if (err instanceof IngestError) setPhase({ kind: "error", error: { title: err.message, hint: err.hint, fileName: name } });
      else {
        console.error(err);
        setPhase({
          kind: "error",
          error: { title: "Something went wrong while reading this file.", hint: "Try exporting it again from Excel, or as CSV. Details are in the browser console.", fileName: name },
        });
      }
    }
  }, []);

  // `/?sample=<file>` opens one of the bundled samples directly (handy for demos and screenshots).
  useEffect(() => {
    const sample = new URLSearchParams(window.location.search).get("sample");
    if (!sample || !/^[\w.-]+$/.test(sample)) return;
    // Scheduled (not called synchronously in the effect) and cancellable, so React strict mode doesn't load it twice.
    const timer = setTimeout(() => {
      void handleFile(sample, async () => {
        const res = await fetch(`/samples/${sample}`);
        if (!res.ok) throw new IngestError(`Sample “${sample}” not found.`, "Pick a file instead.", "empty");
        return res.arrayBuffer();
      });
    }, 0);
    return () => clearTimeout(timer);
  }, [handleFile]);

  const result = useMemo(() => {
    if (phase.kind !== "ready") return null;
    try {
      return { ok: true as const, value: analyzeWorkbook(phase.raw, overrides) };
    } catch (err) {
      console.error(err);
      return { ok: false as const, error: err instanceof Error ? err.message : String(err) };
    }
  }, [phase, overrides]);

  const reset = () => {
    setPhase({ kind: "idle" });
    setOverrides({});
  };

  return (
    <main className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6">
      <header className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Asset Sheet Parser</h1>
          <p className="text-sm text-gray-500">Upload any spreadsheet of laptops, desktops and servers — we&apos;ll work out the layout.</p>
        </div>
        {phase.kind === "ready" && (
          <button onClick={reset} className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm hover:bg-gray-50">
            Upload another file
          </button>
        )}
      </header>

      {phase.kind === "idle" && <UploadZone onFile={handleFile} />}
      {phase.kind === "loading" && (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-gray-200 bg-white p-16 text-gray-600">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-blue-600" />
          <p>
            Reading <span className="font-medium">{phase.fileName}</span>…
          </p>
          <p className="text-xs text-gray-400">Finding tables → matching columns → extracting values</p>
        </div>
      )}
      {phase.kind === "error" && <ErrorPanel error={phase.error} onRetry={reset} />}
      {phase.kind === "ready" && result && !result.ok && (
        <ErrorPanel
          error={{ title: "We read the file, but analysing it failed.", hint: `Please report this file. (${result.error})`, fileName: phase.raw.fileName }}
          onRetry={reset}
        />
      )}
      {phase.kind === "ready" && result?.ok && <ResultView result={result.value} overrides={overrides} onOverrides={setOverrides} />}
    </main>
  );
}
