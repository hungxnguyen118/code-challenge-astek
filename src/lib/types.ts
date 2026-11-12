/**
 * Shared domain types for the whole parsing pipeline.
 *
 * Design note: every extracted value carries *where it came from* (raw text,
 * source column, extraction method) and *how sure we are* (confidence 0..1).
 * The UI relies on this to explain itself and to tell the user which values
 * deserve a second look.
 */

/** A single spreadsheet cell after ingestion. Dates are kept as Date objects. */
export type CellValue = string | number | boolean | Date | null;

/** The eight fields the challenge asks for. */
export const CORE_FIELDS = [
  "assetType",
  "manufacturer",
  "model",
  "serialNumber",
  "cpu",
  "ramGB",
  "storage",
  "screenInches",
] as const;

/** Extra fields we pull out when we find them ("anything else useful is a bonus"). */
export const BONUS_FIELDS = [
  "hostname",
  "assetTag",
  "assignedUser",
  "location",
  "os",
  "purchaseDate",
  "warrantyEnd",
  "status",
  "notes",
] as const;

export const ALL_FIELDS = [...CORE_FIELDS, ...BONUS_FIELDS] as const;

export type CoreField = (typeof CORE_FIELDS)[number];
export type BonusField = (typeof BONUS_FIELDS)[number];
export type FieldKey = CoreField | BonusField;

/**
 * What a column can be mapped to.
 * `combined` = a free-text column that packs several fields together
 * ("HP EliteBook 840 G8 / i5 / 16GB / 256GB SSD / 14in").
 */
export type MappingTarget = FieldKey | "combined";

export const COMPUTER_TYPES = [
  "laptop",
  "desktop",
  "workstation",
  "server",
  "virtual-machine",
  "tablet",
  "thin-client",
] as const;

export const NON_COMPUTER_TYPES = [
  "monitor",
  "dock",
  "keyboard",
  "mouse",
  "headset",
  "printer",
  "phone",
  "network",
  "accessory",
] as const;

export type ComputerType = (typeof COMPUTER_TYPES)[number];
export type NonComputerType = (typeof NON_COMPUTER_TYPES)[number];
export type AssetType = ComputerType | NonComputerType | "other";

export type DriveType = "SSD" | "NVMe" | "HDD" | "eMMC" | "Hybrid";

export interface Drive {
  sizeGB: number;
  type: DriveType | null;
}

export interface StorageValue {
  totalGB: number;
  drives: Drive[];
}

/** The TypeScript type of the *normalised* value of each field. */
export interface FieldValueMap {
  assetType: AssetType;
  manufacturer: string;
  model: string;
  serialNumber: string;
  cpu: string;
  ramGB: number;
  storage: StorageValue;
  screenInches: number;
  hostname: string;
  assetTag: string;
  assignedUser: string;
  location: string;
  os: string;
  /** ISO date `YYYY-MM-DD` */
  purchaseDate: string;
  /** ISO date `YYYY-MM-DD` */
  warrantyEnd: string;
  status: string;
  notes: string;
}

/**
 * How a value was obtained, from most to least trustworthy:
 * - `column`   : read from a column mapped to this field, then normalised
 * - `parsed`   : pulled out of free text (a combined/description/model cell)
 * - `inferred` : deduced from other values (Latitude ⇒ Dell, PowerEdge ⇒ server)
 * - `manual`   : typed in by the user in the review screen
 */
export type ExtractionMethod = "column" | "parsed" | "inferred" | "manual";

export interface ExtractedValue<T> {
  value: T;
  /** Original text in the file (or the reason, for inferred values). */
  raw: string;
  confidence: number;
  method: ExtractionMethod;
  /** Header of the column the value came from, if any. */
  sourceColumn?: string;
}

export type AssetFields = { [K in FieldKey]?: ExtractedValue<FieldValueMap[K]> };

/** Result of a normaliser: a typed value plus how confident the normaliser is. */
export interface Normalized<T> {
  value: T;
  confidence: number;
}

export type WarningSeverity = "error" | "warning" | "info";

export interface AssetWarning {
  code:
    | "missing-serial"
    | "placeholder-serial"
    | "duplicate-serial"
    | "suspicious-ram"
    | "suspicious-storage"
    | "suspicious-screen"
    | "unknown-type"
    | "low-confidence"
    | "warranty-expired";
  severity: WarningSeverity;
  message: string;
  field?: FieldKey;
}

/**
 * - `computer`     : what we are after
 * - `non-computer` : monitors, docks, phones… kept, but shown separately
 * - `skipped`      : totals, repeated headers, notes, empty-ish rows
 */
export type RowKind = "computer" | "non-computer" | "skipped";

export interface Asset {
  /** Stable id: `${sheetName}!${rowNumber}` */
  id: string;
  sheetName: string;
  tableId: string;
  /** 1-based row number as shown in Excel, so users can find the row. */
  rowNumber: number;
  kind: RowKind;
  /** Why the row was classified as non-computer/skipped. */
  kindReason?: string;
  fields: AssetFields;
  warnings: AssetWarning[];
  /** The original row, header → cell text, for the "view original row" panel. */
  raw: Array<{ header: string; value: string }>;
}

export interface RawSheet {
  name: string;
  hidden: boolean;
  /** Rectangular-ish 2D grid; grid[0] is spreadsheet row `firstRow`. */
  grid: CellValue[][];
  /** 1-based spreadsheet row number of grid[0]. */
  firstRow: number;
  /** 0-based spreadsheet column index of grid[i][0]. */
  firstCol: number;
}

export interface RawWorkbook {
  fileName: string;
  fileType: "xlsx" | "xls" | "ods" | "csv";
  sheets: RawSheet[];
  /** Non-fatal notes from ingestion (encoding fallback, delimiter…). */
  notes: string[];
}

export interface DetectedColumn {
  /** 0-based index into the grid row. */
  index: number;
  /** Spreadsheet column letter (A, B, … AA). */
  letter: string;
  /** Header text, or "Column X" when the table has no header row. */
  header: string;
  /** Up to N non-empty sample values (as text). */
  samples: string[];
}

export interface DataRow {
  rowNumber: number;
  cells: CellValue[];
}

export interface DetectedTable {
  id: string;
  sheetName: string;
  /** 1-based spreadsheet row of the header, or null if no header was found. */
  headerRow: number | null;
  headerConfidence: number;
  headerReason: string;
  /** A single-cell title just above the table ("LAPTOPS", "Servers – Paris"), if any. */
  title?: string;
  columns: DetectedColumn[];
  rows: DataRow[];
  /** 1-based spreadsheet rows spanned by this table (header included). */
  firstRow: number;
  lastRow: number;
}

export interface ColumnMapping {
  columnIndex: number;
  header: string;
  letter: string;
  target: MappingTarget | null;
  confidence: number;
  /** Human-readable explanation, e.g. `Header "Mem" ≈ RAM; 47/50 values look like RAM`. */
  reasons: string[];
  /** True when the user chose this mapping in the "fix the mapping" panel. */
  manual: boolean;
  /** Runner-up target, used to explain ambiguous columns. */
  alternative?: { target: MappingTarget; score: number };
}

export type SheetStatus = "parsed" | "empty" | "duplicate" | "no-asset-data";

export interface TableResult {
  table: DetectedTable;
  mapping: ColumnMapping[];
  assets: Asset[];
}

export interface SheetResult {
  name: string;
  index: number;
  hidden: boolean;
  status: SheetStatus;
  statusReason?: string;
  /** For duplicates: name of the sheet this one copies. */
  duplicateOf?: string;
  /** Whether this sheet's assets count in totals/exports. */
  included: boolean;
  tables: TableResult[];
  error?: string;
}

export interface DuplicateGroup {
  serial: string;
  assetIds: string[];
}

export interface FleetSummary {
  computers: number;
  nonComputers: number;
  skippedRows: number;
  byType: Record<string, number>;
  byManufacturer: Record<string, number>;
  /** Share of computers that have a value for each core field (0..1). */
  completeness: Record<CoreField, number>;
  warnings: number;
  duplicates: number;
  lowConfidenceValues: number;
}

export interface ParseResult {
  fileName: string;
  fileType: RawWorkbook["fileType"];
  notes: string[];
  sheets: SheetResult[];
  summary: FleetSummary;
  duplicates: DuplicateGroup[];
}

/** User corrections, re-applied on every run of the (pure) pipeline. */
export interface TableOverride {
  /** Force the header row (1-based) or declare there is no header. */
  headerRow?: number | "none";
  /** Force a column (by index) to a target, or `null` to ignore it. */
  columns?: Record<number, MappingTarget | null>;
}

export interface Overrides {
  tables?: Record<string, TableOverride>;
  /** Sheets the user explicitly included/excluded (overrides duplicate detection). */
  sheetInclusion?: Record<string, boolean>;
  /** Manual cell edits: assetId → field → typed text. */
  cellEdits?: Record<string, Partial<Record<FieldKey, string>>>;
  /** Rows the user moved between computer / non-computer. */
  rowKinds?: Record<string, Exclude<RowKind, "skipped">>;
}
