"use client";

import { useEffect, useState } from "react";
import type { Asset, ExtractedValue, FieldKey, FieldValueMap, MappingTarget, Overrides } from "@/lib/types";
import { ALL_FIELDS } from "@/lib/types";
import { formatValue, pct } from "@/lib/format";
import { provenance } from "./AssetTable";
import { ownValue } from "@/lib/text";

interface Props {
  asset: Asset;
  columns: FieldKey[];
  overrides: Overrides;
  onOverrides: (o: Overrides) => void;
  onClose: () => void;
  fieldLabel: (k: MappingTarget) => string;
}

/** Row details: every value with its provenance, inline editing, and the original row side by side. */
export function AssetDrawer({ asset, overrides, onOverrides, onClose, fieldLabel }: Props) {
  const edits = ownValue(overrides.cellEdits, asset.id) ?? {};
  const [draft, setDraft] = useState<Partial<Record<FieldKey, string>>>({});

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const commit = (key: FieldKey) => {
    const text = draft[key];
    if (text === undefined) return;
    onOverrides({ ...overrides, cellEdits: { ...overrides.cellEdits, [asset.id]: { ...edits, [key]: text } } });
    setDraft((d) => {
      const next = { ...d };
      delete next[key];
      return next;
    });
  };
  const revert = (key: FieldKey) => {
    const rest = { ...edits };
    delete rest[key];
    onOverrides({ ...overrides, cellEdits: { ...overrides.cellEdits, [asset.id]: rest } });
  };
  const moveTo = (kind: "computer" | "non-computer") => onOverrides({ ...overrides, rowKinds: { ...overrides.rowKinds, [asset.id]: kind } });

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-black/20" onClick={onClose}>
      <aside
        role="dialog"
        aria-label={`Row ${asset.rowNumber} details`}
        className="h-full w-full max-w-2xl overflow-y-auto bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 flex items-center justify-between border-b border-gray-200 bg-white px-5 py-3">
          <div>
            <div className="font-semibold">
              {asset.sheetName} · row {asset.rowNumber}
            </div>
            <div className="text-xs text-gray-500">
              {asset.kind === "computer" ? "Computer" : asset.kind === "non-computer" ? "Other device" : "Skipped row"}
              {asset.kindReason && ` — ${asset.kindReason}`}
            </div>
          </div>
          <div className="flex items-center gap-2 text-sm">
            {asset.kind !== "computer" && (
              <button onClick={() => moveTo("computer")} className="rounded border border-gray-300 px-2 py-1 hover:bg-gray-50">
                It&apos;s a computer
              </button>
            )}
            {asset.kind === "computer" && (
              <button onClick={() => moveTo("non-computer")} className="rounded border border-gray-300 px-2 py-1 hover:bg-gray-50">
                Not a computer
              </button>
            )}
            <button onClick={onClose} className="rounded px-2 py-1 text-gray-500 hover:bg-gray-100" aria-label="Close">
              ✕
            </button>
          </div>
        </div>

        {asset.warnings.length > 0 && (
          <ul className="space-y-1 border-b border-gray-100 px-5 py-3 text-sm">
            {asset.warnings.map((w, i) => (
              <li key={i} className={w.severity === "error" ? "text-red-700" : w.severity === "warning" ? "text-amber-700" : "text-gray-600"}>
                • {w.message}
              </li>
            ))}
          </ul>
        )}

        <div className="px-5 py-4">
          <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-500">Extracted values</h3>
          <table className="w-full text-sm">
            <tbody>
              {ALL_FIELDS.map((k) => {
                const v = asset.fields[k] as ExtractedValue<unknown> | undefined;
                const shown = v ? formatValue(k, v.value as FieldValueMap[typeof k]) : "";
                return (
                  <tr key={k} className="border-t border-gray-100 align-top">
                    <td className="w-32 py-1.5 pr-2 text-gray-500">{fieldLabel(k)}</td>
                    <td className="py-1.5 pr-2">
                      <input
                        value={draft[k] ?? shown}
                        onChange={(e) => setDraft((d) => ({ ...d, [k]: e.target.value }))}
                        onBlur={() => commit(k)}
                        onKeyDown={(e) => e.key === "Enter" && commit(k)}
                        placeholder="—"
                        className="w-full rounded border border-transparent px-1.5 py-0.5 hover:border-gray-200 focus:border-blue-400 focus:outline-none"
                      />
                    </td>
                    <td className="w-56 py-1.5 text-xs text-gray-500">
                      {v && <span title={provenance(k, v)}>{v.method === "manual" ? "edited by you" : `${v.method} · ${pct(v.confidence)}${v.sourceColumn ? ` · “${v.sourceColumn}”` : ""}`}</span>}
                      {k in edits && (
                        <button onClick={() => revert(k)} className="ml-2 text-blue-600 hover:underline">
                          undo
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="mt-2 text-xs text-gray-400">Edits go through the same normalisers (“16 gig” → 16 GB) and are kept in the export.</p>
        </div>

        <div className="border-t border-gray-100 px-5 py-4">
          <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-500">Original row in the file</h3>
          <table className="w-full text-sm">
            <tbody>
              {asset.raw.map((r, i) => (
                <tr key={i} className="border-t border-gray-100">
                  <td className="w-48 py-1 pr-2 text-gray-500">{r.header}</td>
                  <td className="py-1 font-mono text-xs">{r.value || <span className="text-gray-300">(empty)</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </aside>
    </div>
  );
}
