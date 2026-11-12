import type { Drive, DriveType, Normalized, StorageValue } from "../types";
import { parseLooseNumber } from "../text";
import type { UnitHint } from "./unitHint";

const SIZE_RE = /(?:(\d+)\s*[x×*]\s*)?(\d+(?:[.,]\d+)?)\s*(tb|tib|to|t|gb|gib|go|g|mb|mo)?\b/i;

function driveType(s: string): DriveType | null {
  if (/nvme|pcie|m\.?2/i.test(s)) return "NVMe";
  if (/sshd|hybrid|fusion/i.test(s)) return "Hybrid";
  if (/ssd|flash|solid/i.test(s)) return "SSD";
  if (/emmc/i.test(s)) return "eMMC";
  if (/hdd|hard\s*dis[kc]|sata\s*\d|rpm|\b7\.?2k\b|\b10k\b|\b15k\b|sas\b|disque dur|mechanical/i.test(s)) return "HDD";
  return null;
}

/**
 * Normalise storage to a total size in GB plus the individual drives.
 *
 * "256GB SSD" · "0.5 TB" · "512 Go NVMe" · "1TB HDD + 256 SSD" · "2x 1TB" · "256"
 */
export function normalizeStorage(raw: unknown, hint?: UnitHint): Normalized<StorageValue> | null {
  if (typeof raw === "number") {
    const d = bareSize(raw, hint);
    return d ? { value: { totalGB: d.sizeGB, drives: [{ sizeGB: d.sizeGB, type: null }] }, confidence: d.confidence } : null;
  }
  if (typeof raw !== "string") return null;
  const s = raw.replace(/ /g, " ").trim();
  if (!s) return null;
  // RAM-only text ("16GB DDR4") is not storage.
  if (/ddr\d|ram\b|memory|m[eé]moire/i.test(s) && !driveType(s)) return null;

  // Split multi-drive values. A comma only splits when followed by a space, so "1,5 TB" stays one value.
  const parts = s.split(/\s*(?:\+|&|;|\/|,\s|\band\b|\bet\b)\s*/i).filter(Boolean);
  const drives: Drive[] = [];
  let confidence = 1;
  let pendingType: DriveType | null = null;

  for (const part of parts) {
    const m = SIZE_RE.exec(part);
    const type = driveType(part);
    if (!m) {
      // A part that's only a type ("SSD") applies to the previous drive.
      if (type && drives.length > 0 && drives[drives.length - 1]!.type === null) drives[drives.length - 1]!.type = type;
      else if (type) pendingType = type;
      continue;
    }
    const count = m[1] ? Number(m[1]) : 1;
    const n = parseLooseNumber(m[2]!);
    if (n === null || n <= 0) continue;
    const unit = (m[3] ?? "").toLowerCase();
    let sizeGB: number;
    if (unit.startsWith("t")) sizeGB = n * 1000;
    else if (unit.startsWith("m")) sizeGB = n / 1000;
    else if (unit.startsWith("g")) sizeGB = n;
    else {
      const bare = bareSize(n, hint, type !== null);
      if (!bare) continue;
      sizeGB = bare.sizeGB;
      confidence = Math.min(confidence, bare.confidence + 0.1);
    }
    for (let i = 0; i < count; i++) drives.push({ sizeGB: Math.round(sizeGB), type: type ?? pendingType });
    pendingType = null;
  }
  if (drives.length === 0) return null;

  const totalGB = drives.reduce((sum, d) => sum + d.sizeGB, 0);
  if (drives.every((d) => d.type === null)) confidence = Math.min(confidence, 0.85);
  if (totalGB < 8 || totalGB > 1_000_000) confidence = Math.min(confidence, 0.3);
  return { value: { totalGB, drives }, confidence: Math.min(confidence, 0.95) };
}

function bareSize(n: number, hint?: UnitHint, hasType = false): { sizeGB: number; confidence: number } | null {
  if (!Number.isFinite(n) || n <= 0) return null;
  if (hint === "TB") return { sizeGB: n * 1000, confidence: 0.9 };
  if (hint === "MB") return { sizeGB: n / 1000, confidence: 0.85 };
  if (hint === "GB") return { sizeGB: n, confidence: 0.9 };
  // "1 SSD", "2" in a storage column → TB; "256", "512" → GB
  if (n <= 16 && hasType) return { sizeGB: n * 1000, confidence: 0.6 };
  if (n >= 32) return { sizeGB: n, confidence: 0.65 };
  if (n <= 8) return { sizeGB: n * 1000, confidence: 0.4 };
  return { sizeGB: n, confidence: 0.3 };
}

/** "512 GB SSD", "1 TB HDD + 256 GB SSD", "2 × 1 TB SSD" */
export function formatStorage(v: StorageValue): string {
  const groups: Array<{ drive: Drive; count: number }> = [];
  for (const d of v.drives) {
    const g = groups.find((x) => x.drive.sizeGB === d.sizeGB && x.drive.type === d.type);
    if (g) g.count++;
    else groups.push({ drive: d, count: 1 });
  }
  return groups
    .map(({ drive, count }) => `${count > 1 ? `${count} × ` : ""}${formatSize(drive.sizeGB)}${drive.type ? ` ${drive.type}` : ""}`)
    .join(" + ");
}

export function formatSize(gb: number): string {
  if (gb >= 1000 && gb % 1000 === 0) return `${gb / 1000} TB`;
  if (gb >= 1000) return `${Math.round(gb / 100) / 10} TB`;
  return `${Math.round(gb)} GB`;
}
