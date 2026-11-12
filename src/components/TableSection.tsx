"use client";

import { useMemo, useState } from "react";
import type { Asset, DuplicateGroup, FieldKey, Overrides, RowKind, TableResult } from "@/lib/types";
import { BONUS_FIELDS, CORE_FIELDS } from "@/lib/types";
import { fieldLabel } from "@/lib/extract/registry";
import { fieldText } from "@/lib/format";
import { MappingEditor } from "./MappingEditor";
import { AssetTable } from "./AssetTable";
import { AssetDrawer } from "./AssetDrawer";

interface Props {
  tableResult: TableResult;
  overrides: Overrides;
  onOverrides: (o: Overrides) => void;
  duplicates: DuplicateGroup[];
}

const KIND_TABS: Array<{ kind: RowKind; label: string }> = [
  { kind: "computer", label: "Computers" },
  { kind: "non-computer", label: "Other devices" },
  { kind: "skipped", label: "Skipped rows" },
];

export function TableSection({ tableResult, overrides, onOverrides }: Props) {
  const { table, mapping, assets } = tableResult;
  const [kind, setKind] = useState<RowKind>("computer");
  const [onlyWarnings, setOnlyWarnings] = useState(false);
  const [query, setQuery] = useState("");
  const lowConfidenceColumns = mapping.filter((m) => m.target && !m.manual && m.confidence < 0.6).length;
  const [showMapping, setShowMapping] = useState(table.headerRow === null || table.headerConfidence < 0.5);
  const [openId, setOpenId] = useState<string | null>(null);

  const mapped = mapping.filter((m) => m.target).length;
  const counts = Object.fromEntries(KIND_TABS.map((t) => [t.kind, assets.filter((a) => a.kind === t.kind).length])) as Record<RowKind, number>;

  // Show the core fields always, bonus fields only if this table has them.
  const columns: FieldKey[] = useMemo(() => {
    const bonus = BONUS_FIELDS.filter((k) => assets.some((a) => a.fields[k]));
    return [...CORE_FIELDS, ...bonus];
  }, [assets]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return assets.filter(
      (a: Asset) =>
        a.kind === kind &&
        (!onlyWarnings || a.warnings.some((w) => w.severity !== "info")) &&
        (!q || columns.some((k) => fieldText(a.fields, k).toLowerCase().includes(q)) || a.raw.some((r) => r.value.toLowerCase().includes(q))),
    );
  }, [assets, kind, onlyWarnings, query, columns]);

  const open = assets.find((a) => a.id === openId) ?? null;

  return (
    <section className="rounded-xl border border-gray-200 bg-white">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 px-4 py-3 text-sm">
        <div className="space-y-0.5">
          <div>
            {table.title && <span className="mr-2 font-medium">“{table.title}”</span>}
            {table.headerRow !== null ? (
              <>
                Header found on <b>row {table.headerRow}</b>
              </>
            ) : (
              <b className="text-amber-700">No header row found</b>
            )}
            <span className="text-gray-400"> · </span>
            <b>{mapped}</b>/{mapping.length} columns used
            <span className="text-gray-400"> · </span>
            rows {table.firstRow}–{table.lastRow}
          </div>
          <div className="text-xs text-gray-500">
            {table.headerReason}
            {lowConfidenceColumns > 0 && <span className="ml-1 text-amber-700">· {lowConfidenceColumns} column guess(es) worth checking</span>}
          </div>
        </div>
        <button
          onClick={() => setShowMapping((v) => !v)}
          className={`rounded-md border px-3 py-1.5 ${showMapping ? "border-blue-300 bg-blue-50 text-blue-800" : "border-gray-300 hover:bg-gray-50"}`}
        >
          {showMapping ? "Hide column mapping" : "Fix the mapping"}
        </button>
      </div>

      {showMapping && <MappingEditor table={table} mapping={mapping} overrides={overrides} onOverrides={onOverrides} />}

      <div className="flex flex-wrap items-center gap-2 px-4 py-2">
        <div className="flex rounded-md border border-gray-200 p-0.5 text-sm">
          {KIND_TABS.map((t) => (
            <button
              key={t.kind}
              onClick={() => setKind(t.kind)}
              className={`rounded px-2.5 py-1 ${kind === t.kind ? "bg-gray-900 text-white" : "text-gray-600 hover:bg-gray-100"}`}
            >
              {t.label} <span className="opacity-70">{counts[t.kind]}</span>
            </button>
          ))}
        </div>
        <label className="ml-2 flex items-center gap-1.5 text-sm text-gray-600">
          <input type="checkbox" checked={onlyWarnings} onChange={(e) => setOnlyWarnings(e.target.checked)} />
          only rows with warnings
        </label>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search…"
          className="ml-auto w-48 rounded-md border border-gray-300 px-2 py-1 text-sm"
        />
      </div>

      <AssetTable assets={visible} columns={columns} kind={kind} onOpen={setOpenId} />

      <Legend />

      {open && (
        <AssetDrawer
          asset={open}
          columns={columns}
          overrides={overrides}
          onOverrides={onOverrides}
          onClose={() => setOpenId(null)}
          fieldLabel={fieldLabel}
        />
      )}
    </section>
  );
}

function Legend() {
  return (
    <div className="flex flex-wrap items-center gap-4 border-t border-gray-100 px-4 py-2 text-xs text-gray-500">
      <span className="flex items-center gap-1">
        <span className="inline-block h-3 w-3 rounded-sm border border-gray-200 bg-white" /> confident
      </span>
      <span className="flex items-center gap-1">
        <span className="conf-medium inline-block h-3 w-3 rounded-sm" /> double-check
      </span>
      <span className="flex items-center gap-1">
        <span className="conf-low inline-block h-3 w-3 rounded-sm" /> low confidence
      </span>
      <span>
        <span className="text-violet-600">✦</span> extracted from text
      </span>
      <span>
        <span className="text-sky-600">↳</span> inferred
      </span>
      <span>
        <span className="text-green-600">✎</span> edited by you
      </span>
      <span>Hover a value to see where it came from · click a row for details</span>
    </div>
  );
}
