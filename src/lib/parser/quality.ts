import type { Asset, AssetWarning, CoreField, DuplicateGroup, FleetSummary } from "../types";
import { CORE_FIELDS } from "../types";
import { isPlaceholderSerial } from "../extract/serial";
import { MEMORY_SPEEDS_MHZ } from "../extract/ram";
import { ASSET_TYPE_LABELS } from "../extract/assetType";
import { countBy } from "../text";

export const LOW_CONFIDENCE = 0.5;

/** Per-asset data quality checks. Mutates `asset.warnings`. */
export function checkAsset(asset: Asset, today: Date = new Date()): void {
  const w = (x: AssetWarning) => asset.warnings.push(x);
  const f = asset.fields;

  if (asset.kind === "computer") {
    if (!f.serialNumber) {
      const serialCell = asset.raw.find((r) => /serial|s\/n|sn\b|s[ée]rie|service tag/i.test(r.header))?.value ?? "";
      if (serialCell && isPlaceholderSerial(serialCell)) {
        w({ code: "placeholder-serial", severity: "warning", field: "serialNumber", message: `Serial is a placeholder (“${serialCell}”)` });
      } else {
        w({ code: "missing-serial", severity: "warning", field: "serialNumber", message: "No serial number" });
      }
    }
    if (!f.assetType) w({ code: "unknown-type", severity: "info", field: "assetType", message: "Couldn't tell what kind of device this is" });
  }

  const ram = f.ramGB?.value;
  if (ram !== undefined) {
    if (MEMORY_SPEEDS_MHZ.has(ram)) w({ code: "suspicious-ram", severity: "warning", field: "ramGB", message: `RAM of ${ram} looks like a memory speed (MHz), not a size` });
    else if (ram > 4096 || ram < 0.5) w({ code: "suspicious-ram", severity: "warning", field: "ramGB", message: `RAM of ${ram} GB is implausible` });
    else if (ram > 256 && f.assetType && f.assetType.value !== "server" && f.assetType.value !== "virtual-machine") {
      w({ code: "suspicious-ram", severity: "warning", field: "ramGB", message: `${ram} GB of RAM is unusual for a ${ASSET_TYPE_LABELS[f.assetType.value].toLowerCase()}` });
    }
  }
  const storage = f.storage?.value.totalGB;
  if (storage !== undefined && (storage < 16 || storage > 1_000_000)) {
    w({ code: "suspicious-storage", severity: "warning", field: "storage", message: `Storage of ${storage} GB is implausible` });
  }
  const screen = f.screenInches?.value;
  if (screen !== undefined && (screen < 7 || screen > 100)) {
    w({ code: "suspicious-screen", severity: "warning", field: "screenInches", message: `Screen size of ${screen}" is implausible` });
  }
  const warranty = f.warrantyEnd?.value;
  if (warranty && asset.kind === "computer" && warranty < today.toISOString().slice(0, 10)) {
    w({ code: "warranty-expired", severity: "info", field: "warrantyEnd", message: `Warranty expired on ${warranty}` });
  }
  for (const key of CORE_FIELDS) {
    const v = f[key];
    if (v && v.confidence < LOW_CONFIDENCE && v.method !== "manual" && !asset.warnings.some((x) => x.field === key)) {
      w({ code: "low-confidence", severity: "info", field: key, message: `Low confidence (${Math.round(v.confidence * 100)}%) — please double-check` });
    }
  }
}

/** Same serial on several rows (across sheets too) — usually a copy/paste error or a re-issued device. */
export function findDuplicates(assets: Asset[]): DuplicateGroup[] {
  const bySerial = new Map<string, string[]>();
  for (const a of assets) {
    const s = a.fields.serialNumber?.value;
    if (!s) continue;
    const key = s.replace(/[^A-Z0-9]/gi, "").toUpperCase();
    if (key.length < 4) continue;
    bySerial.set(key, [...(bySerial.get(key) ?? []), a.id]);
  }
  const groups: DuplicateGroup[] = [];
  for (const [serial, ids] of bySerial) if (ids.length > 1) groups.push({ serial, assetIds: ids });
  const index = new Map(assets.map((a) => [a.id, a]));
  for (const g of groups) {
    for (const id of g.assetIds) {
      const a = index.get(id)!;
      const others = g.assetIds.filter((x) => x !== id).map((x) => x.replace("!", " row "));
      a.warnings.push({ code: "duplicate-serial", severity: "error", field: "serialNumber", message: `Same serial as ${others.join(", ")}` });
    }
  }
  return groups;
}

export function summarize(assets: Asset[], duplicates: DuplicateGroup[]): FleetSummary {
  const computers = assets.filter((a) => a.kind === "computer");
  // countBy uses a prototype-less object: a brand literally called "constructor" or "__proto__" must count like any other.
  const byType = countBy(computers.map((a) => a.fields.assetType?.value ?? "unknown"));
  const byManufacturer = countBy(computers.map((a) => a.fields.manufacturer?.value ?? "Unknown"));
  const completeness = Object.fromEntries(
    CORE_FIELDS.map((k) => [k, computers.length ? computers.filter((a) => a.fields[k] !== undefined).length / computers.length : 0]),
  ) as Record<CoreField, number>;
  let low = 0;
  for (const a of computers) for (const k of CORE_FIELDS) if ((a.fields[k]?.confidence ?? 1) < LOW_CONFIDENCE) low++;
  return {
    computers: computers.length,
    nonComputers: assets.filter((a) => a.kind === "non-computer").length,
    skippedRows: assets.filter((a) => a.kind === "skipped").length,
    byType,
    byManufacturer,
    completeness,
    warnings: computers.reduce((n, a) => n + a.warnings.filter((w) => w.severity !== "info").length, 0),
    duplicates: duplicates.length,
    lowConfidenceValues: low,
  };
}
