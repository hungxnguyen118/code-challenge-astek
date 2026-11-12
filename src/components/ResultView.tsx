"use client";

import { useState } from "react";
import type { Overrides, ParseResult, SheetResult } from "@/lib/types";
import { download, toCsv, toJson } from "@/lib/export";
import { FleetSummary } from "./FleetSummary";
import { TableSection } from "./TableSection";

interface Props {
  result: ParseResult;
  overrides: Overrides;
  onOverrides: (o: Overrides) => void;
}

const STATUS_BADGE: Record<SheetResult["status"], { label: string; cls: string }> = {
  parsed: { label: "", cls: "" },
  duplicate: { label: "copy", cls: "bg-amber-100 text-amber-800" },
  empty: { label: "empty", cls: "bg-gray-100 text-gray-500" },
  "no-asset-data": { label: "no assets", cls: "bg-gray-100 text-gray-500" },
};

export function ResultView({ result, overrides, onOverrides }: Props) {
  const firstUseful = result.sheets.find((s) => s.included) ?? result.sheets[0];
  const [active, setActive] = useState(firstUseful?.name ?? "");
  const [withNonComputers, setWithNonComputers] = useState(false);
  const sheet = result.sheets.find((s) => s.name === active) ?? firstUseful;
  const base = result.fileName.replace(/\.[^.]+$/, "");

  const setInclusion = (name: string, included: boolean) =>
    onOverrides({ ...overrides, sheetInclusion: { ...overrides.sheetInclusion, [name]: included } });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3">
        <div className="min-w-0">
          <div className="truncate font-medium">{result.fileName}</div>
          {result.notes.map((n) => (
            <div key={n} className="text-xs text-gray-500">
              ℹ {n}
            </div>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <label className="mr-2 flex items-center gap-1.5 text-gray-600">
            <input type="checkbox" checked={withNonComputers} onChange={(e) => setWithNonComputers(e.target.checked)} />
            include non-computers
          </label>
          <button
            onClick={() => download(`${base}.clean.csv`, toCsv(result, { includeNonComputers: withNonComputers }), "text/csv;charset=utf-8")}
            className="rounded-md bg-blue-600 px-3 py-1.5 font-medium text-white hover:bg-blue-700"
          >
            Export CSV
          </button>
          <button
            onClick={() => download(`${base}.clean.json`, toJson(result, { includeNonComputers: withNonComputers }), "application/json")}
            className="rounded-md border border-gray-300 bg-white px-3 py-1.5 hover:bg-gray-50"
          >
            Export JSON
          </button>
        </div>
      </div>

      <FleetSummary result={result} />

      <nav className="flex flex-wrap gap-1 border-b border-gray-200" aria-label="Sheets">
        {result.sheets.map((s) => {
          const count = s.tables.reduce((n, t) => n + t.assets.filter((a) => a.kind === "computer").length, 0);
          const badge = STATUS_BADGE[s.status];
          const selected = s.name === sheet?.name;
          return (
            <button
              key={s.name}
              onClick={() => setActive(s.name)}
              className={`-mb-px flex items-center gap-2 rounded-t-md border px-3 py-2 text-sm ${
                selected ? "border-gray-200 border-b-white bg-white font-medium" : "border-transparent text-gray-500 hover:text-gray-800"
              } ${s.included ? "" : "opacity-70"}`}
            >
              {s.name}
              {s.hidden && <span className="rounded bg-gray-100 px-1.5 text-[11px] text-gray-500">hidden</span>}
              {badge.label && <span className={`rounded px-1.5 text-[11px] ${badge.cls}`}>{badge.label}</span>}
              {s.status === "parsed" && <span className="rounded-full bg-gray-100 px-1.5 text-[11px] text-gray-600">{count}</span>}
            </button>
          );
        })}
      </nav>

      {sheet && (
        <div className="space-y-4">
          {sheet.error && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
              This sheet couldn&apos;t be analysed ({sheet.error}). Other sheets are unaffected.
            </div>
          )}
          {sheet.status !== "parsed" && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              <span>
                {sheet.status === "duplicate" && <>This sheet looks like a copy — {sheet.statusReason}. </>}
                {sheet.status === "empty" && <>This sheet is empty. </>}
                {sheet.status === "no-asset-data" && <>No computer data was recognised on this sheet. </>}
                {sheet.included ? "Its rows are counted in the totals and exports." : "Its rows are not counted in the totals or exports."}
              </span>
              {sheet.status !== "empty" && (
                <button onClick={() => setInclusion(sheet.name, !sheet.included)} className="rounded-md border border-amber-300 bg-white px-3 py-1 hover:bg-amber-100">
                  {sheet.included ? "Exclude this sheet" : "Include it anyway"}
                </button>
              )}
            </div>
          )}
          {sheet.status === "parsed" && !sheet.included && (
            <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm">
              <span>You excluded this sheet.</span>
              <button onClick={() => setInclusion(sheet.name, true)} className="rounded-md border bg-white px-3 py-1">
                Include it again
              </button>
            </div>
          )}
          {sheet.tables.map((t) => (
            <TableSection key={t.table.id} tableResult={t} overrides={overrides} onOverrides={onOverrides} duplicates={result.duplicates} />
          ))}
        </div>
      )}
    </div>
  );
}
