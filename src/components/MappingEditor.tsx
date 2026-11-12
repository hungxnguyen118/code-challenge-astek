"use client";

import { useState } from "react";
import type { ColumnMapping, DetectedTable, MappingTarget, Overrides } from "@/lib/types";
import { ALL_FIELDS } from "@/lib/types";
import { fieldLabel } from "@/lib/extract/registry";
import { confidenceLevel, pct } from "@/lib/format";
import { ownValue } from "@/lib/text";

const TARGETS: MappingTarget[] = [...ALL_FIELDS, "combined"];

interface Props {
  table: DetectedTable;
  mapping: ColumnMapping[];
  overrides: Overrides;
  onOverrides: (o: Overrides) => void;
}

/**
 * The "fix the mapping" screen. Every change is stored as an override and the
 * whole (pure) pipeline re-runs, so the table below updates instantly.
 */
export function MappingEditor({ table, mapping, overrides, onOverrides }: Props) {
  const current = ownValue(overrides.tables, table.id) ?? {};
  const [headerInput, setHeaderInput] = useState(String(table.headerRow ?? ""));

  const update = (next: typeof current) => onOverrides({ ...overrides, tables: { ...overrides.tables, [table.id]: next } });

  const setColumn = (index: number, value: string) => {
    const columns = { ...current.columns };
    if (value === "__auto") delete columns[index];
    else columns[index] = value === "__none" ? null : (value as MappingTarget);
    update({ ...current, columns });
  };

  const applyHeader = (value: string) => {
    if (value === "none") update({ headerRow: "none" });
    else {
      const n = Number(value);
      if (Number.isInteger(n) && n > 0) update({ headerRow: n }); // a new header invalidates column overrides
    }
  };

  const isOverridden = current.headerRow !== undefined || Object.keys(current.columns ?? {}).length > 0;
  const usedTargets = new Map<MappingTarget, number>();
  for (const m of mapping) if (m.target && m.target !== "combined" && m.target !== "notes") usedTargets.set(m.target, (usedTargets.get(m.target) ?? 0) + 1);

  return (
    <div className="border-b border-gray-100 bg-slate-50 px-4 py-3">
      <div className="mb-3 flex flex-wrap items-center gap-3 text-sm">
        <span className="font-medium">Header row:</span>
        <input
          value={headerInput}
          onChange={(e) => setHeaderInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && applyHeader(headerInput)}
          className="w-16 rounded border border-gray-300 px-2 py-1"
          inputMode="numeric"
          aria-label="Header row number"
        />
        <button onClick={() => applyHeader(headerInput)} className="rounded border border-gray-300 bg-white px-2 py-1 hover:bg-gray-50">
          Apply
        </button>
        <button onClick={() => applyHeader("none")} className="rounded border border-gray-300 bg-white px-2 py-1 hover:bg-gray-50">
          There is no header
        </button>
        {isOverridden && (
          <button
            onClick={() => {
              const tables = { ...overrides.tables };
              delete tables[table.id];
              onOverrides({ ...overrides, tables });
              setHeaderInput(String(table.headerRow ?? ""));
            }}
            className="ml-auto rounded border border-gray-300 bg-white px-2 py-1 hover:bg-gray-50"
          >
            Reset to automatic
          </button>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase tracking-wide text-gray-500">
            <tr>
              <th className="py-1 pr-2 font-medium">Col</th>
              <th className="py-1 pr-2 font-medium">Header in file</th>
              <th className="py-1 pr-2 font-medium">Sample values</th>
              <th className="py-1 pr-2 font-medium">Used as</th>
              <th className="py-1 pr-2 font-medium">Confidence</th>
              <th className="py-1 font-medium">Why</th>
            </tr>
          </thead>
          <tbody>
            {mapping.map((m) => {
              const col = table.columns.find((c) => c.index === m.columnIndex);
              const level = confidenceLevel(m.confidence);
              const clash = m.target && (usedTargets.get(m.target) ?? 0) > 1;
              return (
                <tr key={m.columnIndex} className="border-t border-gray-200 align-top">
                  <td className="py-1.5 pr-2 font-mono text-gray-400">{m.letter}</td>
                  <td className="py-1.5 pr-2 font-medium">{m.header}</td>
                  <td className="max-w-[280px] py-1.5 pr-2 text-xs text-gray-500">
                    <div className="truncate" title={col?.samples.slice(0, 10).join(" · ")}>
                      {col?.samples.slice(0, 3).join(" · ") || "(empty)"}
                    </div>
                  </td>
                  <td className="py-1.5 pr-2">
                    <select
                      value={m.manual ? (m.target ?? "__none") : "__auto"}
                      onChange={(e) => setColumn(m.columnIndex, e.target.value)}
                      className={`rounded border px-1.5 py-1 ${m.manual ? "border-green-400 bg-green-50" : "border-gray-300 bg-white"}`}
                    >
                      <option value="__auto">Auto: {m.manual ? "…" : m.target ? fieldLabel(m.target) : "ignore"}</option>
                      <option value="__none">Ignore this column</option>
                      {TARGETS.map((t) => (
                        <option key={t} value={t}>
                          {fieldLabel(t)}
                        </option>
                      ))}
                    </select>
                    {clash && <div className="mt-0.5 text-xs text-red-600">used by several columns</div>}
                  </td>
                  <td className="py-1.5 pr-2">
                    {m.target ? (
                      <span className={`rounded px-1.5 py-0.5 text-xs ${level === "high" ? "bg-green-100 text-green-800" : level === "medium" ? "bg-yellow-100 text-yellow-800" : "bg-orange-100 text-orange-800"}`}>
                        {m.manual ? "manual" : pct(m.confidence)}
                      </span>
                    ) : (
                      <span className="text-xs text-gray-400">—</span>
                    )}
                  </td>
                  <td className="py-1.5 text-xs text-gray-600">
                    {m.reasons.join("; ")}
                    {m.alternative && !m.manual && <span className="text-gray-400"> · runner-up: {fieldLabel(m.alternative.target)}</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
