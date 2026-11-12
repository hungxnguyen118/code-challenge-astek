"use client";

import { useRef, useState } from "react";
import { MAX_FILE_BYTES } from "@/lib/parser";

const SAMPLES = [
  { file: "assets_FINAL_v3_USE_THIS_ONE.xlsx", label: "The “FINAL_v3” workbook", detail: "title rows, header on row 4, copy sheet, stuffed model cells" },
  { file: "combined_descriptions.xlsx", label: "Description-only sheet", detail: "everything packed in one free-text column" },
  { file: "inventaire_fr.csv", label: "French CSV", detail: "semicolons, Windows-1252, “16 Go”, “14 pouces”" },
  { file: "no_header.csv", label: "No header row", detail: "columns recognised from their values alone" },
];

interface Props {
  onFile: (name: string, load: () => Promise<ArrayBuffer>) => void;
}

export function UploadZone({ onFile }: Props) {
  const input = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const pick = (files: FileList | null) => {
    const f = files?.[0];
    if (f) onFile(f.name, () => f.arrayBuffer());
  };

  return (
    <div className="space-y-6">
      <div
        role="button"
        tabIndex={0}
        onClick={() => input.current?.click()}
        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && input.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          pick(e.dataTransfer.files);
        }}
        className={`flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-16 text-center transition ${
          dragging ? "border-blue-500 bg-blue-50" : "border-gray-300 bg-white hover:border-gray-400"
        }`}
      >
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-gray-400" aria-hidden>
          <path d="M12 16V4m0 0l-4 4m4-4l4 4M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <p className="text-lg font-medium">Drop a spreadsheet here, or click to choose</p>
        <p className="text-sm text-gray-500">.xlsx · .xls · .ods · .csv — up to {MAX_FILE_BYTES / 1024 / 1024} MB</p>
        <p className="text-xs text-gray-400">Your file is processed entirely in your browser. Nothing is uploaded.</p>
        <input
          ref={input}
          type="file"
          accept=".xlsx,.xlsm,.xls,.ods,.csv,.tsv,.txt"
          className="hidden"
          onChange={(e) => {
            pick(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      <div>
        <p className="mb-2 text-sm font-medium text-gray-700">No file at hand? Try a messy sample:</p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {SAMPLES.map((s) => (
            <button
              key={s.file}
              onClick={() =>
                onFile(s.file, async () => {
                  const res = await fetch(`/samples/${s.file}`);
                  if (!res.ok) throw new Error(`Sample not found (${res.status})`);
                  return res.arrayBuffer();
                })
              }
              className="rounded-lg border border-gray-200 bg-white p-4 text-left hover:border-blue-400 hover:shadow-sm"
            >
              <div className="font-medium">{s.label}</div>
              <div className="mt-1 text-xs text-gray-500">{s.detail}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
