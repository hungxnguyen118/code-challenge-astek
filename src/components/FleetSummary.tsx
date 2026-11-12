import type { ParseResult } from "@/lib/types";
import { CORE_FIELDS } from "@/lib/types";
import { ASSET_TYPE_LABELS } from "@/lib/extract/assetType";
import { fieldLabel } from "@/lib/extract/registry";
import type { AssetType } from "@/lib/types";
import { pct } from "@/lib/format";

function Stat({ label, value, tone = "default" }: { label: string; value: number | string; tone?: "default" | "warn" | "bad" }) {
  const color = tone === "bad" ? "text-red-600" : tone === "warn" ? "text-amber-600" : "text-gray-900";
  return (
    <div className="rounded-lg border border-gray-200 bg-white px-4 py-3">
      <div className={`text-2xl font-semibold tabular-nums ${color}`}>{value}</div>
      <div className="text-xs text-gray-500">{label}</div>
    </div>
  );
}

function Breakdown({ title, data, labels }: { title: string; data: Record<string, number>; labels?: (k: string) => string }) {
  const entries = Object.entries(data).sort((a, b) => b[1] - a[1]);
  const max = Math.max(1, ...entries.map(([, v]) => v));
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <div className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-500">{title}</div>
      {entries.length === 0 && <div className="text-sm text-gray-400">—</div>}
      <div className="space-y-1.5">
        {entries.slice(0, 6).map(([k, v]) => (
          <div key={k} className="flex items-center gap-2 text-sm">
            <span className="w-28 shrink-0 truncate">{labels ? labels(k) : k}</span>
            <div className="h-2 flex-1 rounded bg-gray-100">
              <div className="h-2 rounded bg-blue-500" style={{ width: `${(v / max) * 100}%` }} />
            </div>
            <span className="w-8 text-right tabular-nums text-gray-600">{v}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function FleetSummary({ result }: { result: ParseResult }) {
  const s = result.summary;
  return (
    <section className="grid gap-3 lg:grid-cols-[1fr_1fr_1fr_1.2fr]">
      <div className="grid grid-cols-2 gap-3 lg:col-span-1">
        <Stat label="computers" value={s.computers} />
        <Stat label="other devices" value={s.nonComputers} />
        <Stat label="rows needing attention" value={s.warnings} tone={s.warnings ? "warn" : "default"} />
        <Stat label="duplicate serials" value={s.duplicates} tone={s.duplicates ? "bad" : "default"} />
      </div>
      <Breakdown title="By type" data={s.byType} labels={(k) => (k === "unknown" ? "Unknown" : ASSET_TYPE_LABELS[k as AssetType] ?? k)} />
      <Breakdown title="By manufacturer" data={s.byManufacturer} />
      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <div className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-500">Field coverage</div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
          {CORE_FIELDS.map((k) => (
            <div key={k} className="flex items-center justify-between text-sm" title={`${pct(s.completeness[k])} of computers have a ${fieldLabel(k)}`}>
              <span className="text-gray-600">{fieldLabel(k)}</span>
              <span className={`tabular-nums ${s.completeness[k] < 0.5 ? "text-amber-600" : "text-gray-900"}`}>{pct(s.completeness[k])}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
