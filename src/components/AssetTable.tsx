import type { Asset, ExtractedValue, FieldKey, FieldValueMap, RowKind } from "@/lib/types";
import { fieldLabel } from "@/lib/extract/registry";
import { confidenceLevel, formatValue, pct } from "@/lib/format";

const METHOD_MARK: Record<ExtractedValue<unknown>["method"], { mark: string; cls: string; text: string }> = {
  column: { mark: "", cls: "", text: "read from column" },
  parsed: { mark: "✦", cls: "text-violet-600", text: "extracted from free text in" },
  inferred: { mark: "↳", cls: "text-sky-600", text: "inferred from" },
  manual: { mark: "✎", cls: "text-green-600", text: "edited by you" },
};

/** Tooltip text explaining a value: original text, how we got it, from where, how sure. */
export function provenance(key: FieldKey, v: ExtractedValue<unknown>): string {
  const m = METHOD_MARK[v.method];
  const where = v.method === "inferred" ? v.raw : v.sourceColumn ? `“${v.sourceColumn}”` : "";
  const original = v.method === "inferred" ? "" : `Original: “${v.raw}”\n`;
  return `${fieldLabel(key)}\n${original}${m.text} ${where}\nConfidence: ${pct(v.confidence)}`.trim();
}

function Cell({ k, v }: { k: FieldKey; v: ExtractedValue<unknown> | undefined }) {
  if (!v) return <td className="px-2 py-1.5 text-gray-300">—</td>;
  const level = confidenceLevel(v.confidence);
  const m = METHOD_MARK[v.method];
  return (
    <td className={`max-w-[220px] truncate px-2 py-1.5 ${level === "high" ? "" : `conf-${level}`}`} title={provenance(k, v)}>
      {m.mark && <span className={`mr-1 ${m.cls}`}>{m.mark}</span>}
      {formatValue(k, v.value as FieldValueMap[typeof k])}
    </td>
  );
}

interface Props {
  assets: Asset[];
  columns: FieldKey[];
  kind: RowKind;
  onOpen: (id: string) => void;
}

export function AssetTable({ assets, columns, kind, onOpen }: Props) {
  if (assets.length === 0) {
    return <div className="px-4 py-10 text-center text-sm text-gray-400">Nothing here.</div>;
  }
  return (
    <div className="max-h-[65vh] overflow-auto">
      <table className="w-full border-collapse text-sm">
        <thead className="sticky top-0 z-10 bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
          <tr>
            <th className="px-2 py-2 font-medium">Row</th>
            {columns.map((k) => (
              <th key={k} className="whitespace-nowrap px-2 py-2 font-medium">
                {fieldLabel(k)}
              </th>
            ))}
            <th className="px-2 py-2 font-medium">{kind === "computer" ? "Warnings" : "Why"}</th>
          </tr>
        </thead>
        <tbody>
          {assets.map((a) => {
            const serious = a.warnings.filter((w) => w.severity !== "info");
            return (
              <tr key={a.id} onClick={() => onOpen(a.id)} className="cursor-pointer border-t border-gray-100 hover:bg-blue-50/40">
                <td className="px-2 py-1.5 tabular-nums text-gray-400">{a.rowNumber}</td>
                {columns.map((k) => (
                  <Cell key={k} k={k} v={a.fields[k] as ExtractedValue<unknown> | undefined} />
                ))}
                <td className="max-w-[260px] px-2 py-1.5 text-xs">
                  {kind === "computer" ? (
                    <div className="flex flex-wrap gap-1">
                      {a.warnings.map((w, i) => (
                        <span
                          key={i}
                          title={w.message}
                          className={`truncate rounded px-1.5 py-0.5 ${
                            w.severity === "error" ? "bg-red-100 text-red-700" : w.severity === "warning" ? "bg-amber-100 text-amber-800" : "bg-gray-100 text-gray-600"
                          }`}
                        >
                          {w.message}
                        </span>
                      ))}
                      {serious.length === 0 && a.warnings.length === 0 && <span className="text-green-600">✓</span>}
                    </div>
                  ) : (
                    <span className="text-gray-500">{a.kindReason}</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
