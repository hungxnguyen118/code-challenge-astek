/**
 * Generates deliberately messy spreadsheets used by the end-to-end tests and the
 * "try a sample" button. Each file exercises one kind of mess the brief warns about.
 *
 *   npm run fixtures
 */
import * as XLSX from "xlsx";
import { mkdirSync, writeFileSync, copyFileSync } from "node:fs";
import { join } from "node:path";

const OUT = join(process.cwd(), "tests", "fixtures");
const PUBLIC = join(process.cwd(), "public", "samples");
mkdirSync(OUT, { recursive: true });
mkdirSync(PUBLIC, { recursive: true });

type Row = Array<string | number | Date | null>;

function xlsx(name: string, sheets: Array<{ name: string; rows: Row[]; merges?: XLSX.Range[]; hidden?: boolean }>) {
  const wb = XLSX.utils.book_new();
  for (const s of sheets) {
    const ws = XLSX.utils.aoa_to_sheet(s.rows, { cellDates: true });
    if (s.merges) ws["!merges"] = s.merges;
    XLSX.utils.book_append_sheet(wb, ws, s.name);
  }
  sheets.forEach((s, i) => {
    if (s.hidden) {
      wb.Workbook ??= {};
      wb.Workbook.Sheets ??= [];
      wb.Workbook.Sheets[i] = { ...(wb.Workbook.Sheets[i] ?? {}), Hidden: 1 };
    }
  });
  // The ESM build of SheetJS has no fs access: write to a buffer ourselves.
  writeFileSync(join(OUT, name), XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer);
}

function csv(name: string, rows: Row[], delimiter = ",", encoding: "utf8" | "latin1" = "utf8", bom = false) {
  const text = rows
    .map((r) => r.map((c) => {
      const s = c === null ? "" : c instanceof Date ? c.toISOString().slice(0, 10) : String(c);
      return /[",;\n]/.test(s) && s.includes(delimiter) ? `"${s.replace(/"/g, '""')}"` : s;
    }).join(delimiter))
    .join("\r\n");
  const buf = Buffer.from((bom ? "﻿" : "") + text, encoding);
  writeFileSync(join(OUT, name), buf);
}

const d = (s: string) => new Date(`${s}T00:00:00Z`);

// 01 — clean baseline
csv("01_clean.csv", [
  ["Asset Type", "Manufacturer", "Model", "Serial Number", "CPU", "RAM", "Storage", "Screen Size"],
  ["Laptop", "Dell", "Latitude 5420", "5CG1234XYZ", "Intel Core i7-1185G7", "16GB", "512GB SSD", '14"'],
  ["Laptop", "HP", "EliteBook 840 G8", "5CD2345ABC", "Intel Core i5-1145G7", "8GB", "256GB SSD", '14"'],
  ["Desktop", "Lenovo", "ThinkCentre M720q", "MJ0ABC12", "Intel Core i5-8400T", "8GB", "256GB SSD", ""],
  ["Server", "Dell", "PowerEdge R740", "7XK9P23", "2x Intel Xeon Gold 6230", "256GB", "4x 1.2TB SAS HDD", ""],
  ["Laptop", "Apple", "MacBook Pro 14", "C02FK1ABQ6L4", "Apple M1 Pro", "16GB", "512GB SSD", '14.2"'],
]);

// 02 — the brief's story: title rows, header on row 4, "RAM" spelled 3 ways across sheets,
//      a model cell stuffed with specs, and a "Sheet1 (2)" copy nobody dares delete.
const story: Row[] = [
  ["ACME Corp — IT Hardware Inventory", null, null, null, null, null, null, null, null],
  ["Last updated: 03/2024 by J. Martin — DO NOT SORT", null, null, null, null, null, null, null, null],
  [null, null, null, null, null, null, null, null, null],
  ["Asset #", "Device", "Make", "Model", "S/N", "Processor", "Mem", "HDD", "Assigned To"],
  ["IT-0001", "Laptop", "Dell", "Dell Lat 5420 i7 16GB", "5CG1234XYZ", null, null, "256 SSD", "alice.martin@acme.com"],
  ["IT-0002", "Notebook", "HP", "EliteBook 840 G8", "5CD2345ABC", "i5-1145G7", "16 gig", "512GB SSD", "bob.durand@acme.com"],
  ["IT-0003", "Desktop", "LENOVO", "ThinkCentre M720q", "MJ0ABC12", "i5 8400T", "8192 MB", "1TB HDD", "carla.nguyen@acme.com"],
  ["IT-0004", "Server", "Dell Inc.", "PowerEdge R740", "7XK9P23", "Xeon Gold 6230", "256", "2x 960GB SSD", null],
  ["IT-0005", "laptop", "hewlett-packard", "ProBook 450 G7", "N/A", "Core i5-10210U", "8GB", "256GB", "dan.lee@acme.com"],
  ["IT-0006", "Monitor", "Dell", "P2422H 24\"", "CN0ABC123", null, null, null, "alice.martin@acme.com"],
  ["IT-0007", "Laptop", "Apple", "MBP 14 M1 Pro", "C02FK1ABQ6L4", "M1 Pro", "16GB", "512GB SSD", "eve.kim@acme.com"],
  ["IT-0008", "Desktop", "HP", "EliteDesk 800 G6", "5CG1234XYZ", "i7-10700", "16GB", "512GB NVMe", "frank.ito@acme.com"],
  [null, null, null, null, null, null, null, null, null],
  ["TOTAL: 8 items", null, null, null, null, null, null, null, null],
];
xlsx("02_assets_FINAL_v3_USE_THIS_ONE.xlsx", [
  { name: "Sheet1", rows: story },
  { name: "Sheet1 (2)", rows: story.slice(0, 11) },
  { name: "Notes", rows: [["Ask Paul about the 3 laptops in the storage room"], ["Monitors are tracked by facilities"]] },
]);

// 03 — French headers, semicolons, decimal commas, Windows-1252 encoding
csv(
  "03_french_semicolon.csv",
  [
    ["Type de matériel", "Marque", "Modèle", "Numéro de série", "Processeur", "Mémoire vive", "Disque", "Écran", "Utilisateur", "Date d'achat"],
    ["Portable", "Lenovo", "ThinkPad T14 Gen 2", "PF2ABCDE", "Intel Core i5-1135G7", "16 Go", "512 Go SSD", "14 pouces", "Élodie Lefèvre", "15/03/2022"],
    ["PC fixe", "HP", "ProDesk 400 G7", "CZC1234ABC", "Core i3-10100", "8 Go", "256 Go SSD", "", "François Dubois", "02/11/2021"],
    ["Portable", "Dell", "Latitude 7420", "9BCD123", "i7-1185G7", "32 Go", "1 To NVMe", "14,0\"", "Hélène Moreau", "20/06/2023"],
    ["Serveur", "HPE", "ProLiant DL380 Gen10", "CZJ9876XYZ", "Xeon Silver 4210R", "128 Go", "2 x 1,2 To HDD", "", "", "01/09/2020"],
    ["Écran", "Dell", "P2422H", "CN0XYZ987", "", "", "", "24\"", "Élodie Lefèvre", "15/03/2022"],
  ],
  ";",
  "latin1",
);

// 04 — only a free-text description column (+ serial)
xlsx("04_combined_description.xlsx", [
  {
    name: "Inventory",
    rows: [
      ["Item", "Description", "Serial"],
      [1, "HP EliteBook 840 G8 / i5 / 16GB / 256GB SSD / 14in", "5CD2345ABC"],
      [2, "Dell Lat 5420 i7 16GB", "5CG1234XYZ"],
      [3, "Lenovo ThinkPad T14 Gen 2, Intel Core i7-1165G7, 32 GB RAM, 1TB NVMe, 14\"", "PF2ABCDE"],
      [4, "HPE ProLiant DL380 Gen10 - 2x Xeon Gold 6230 - 256GB - 4x 1.2TB SAS HDD", "CZJ9876XYZ"],
      [5, "Apple MacBook Air 13 M2 8GB 256GB", "FVFXK2ABQ6L4"],
      [6, "Logitech MX Keys keyboard", "2231LZ0ABC"],
      [7, "Dell OptiPlex 7090 SFF i5-10505 8GB 256GB SSD", "4FGH123"],
    ],
  },
]);

// 05 — several sheets by type, a hidden sheet, an empty sheet
xlsx("05_multi_sheet.xlsx", [
  {
    name: "Laptops",
    rows: [
      ["Hostname", "Brand", "Model", "Serial No", "CPU", "RAM (GB)", "SSD (GB)", "Screen (in)", "OS"],
      ["LAP-PAR-001", "Dell", "Latitude 5430", "1ABC234", "i5-1245U", 16, 512, 14, "Windows 11 Pro"],
      ["LAP-PAR-002", "Lenovo", "ThinkPad X1 Carbon Gen 10", "PF3XYZ12", "i7-1265U", 32, 1000, 14, "Windows 11 Pro"],
      ["LAP-LYO-003", "Apple", "MacBook Air M2", "FVFXK2ABQ6L4", "Apple M2", 8, 256, 13.6, "macOS Sonoma"],
    ],
  },
  {
    name: "Servers",
    rows: [
      ["Name", "Vendor", "Model", "Service Tag", "CPU", "Memory (GB)", "Disks", "Location", "Warranty"],
      ["SRV-DB01", "Dell", "R740", "7XK9P23", "2 x Xeon Silver 4214", 384, "8 x 1.92TB SSD", "DC Paris - Rack 4", d("2025-06-30")],
      ["SRV-APP02", "HPE", "DL360 Gen10", "CZJ1234ABC", "Xeon Gold 5218", 192, "2 x 480GB SSD", "DC Paris - Rack 5", d("2027-01-31")],
      ["ESX-03", "Lenovo", "ThinkSystem SR650", "J30ABC12", "2x Xeon Gold 6248R", 768, "2 x 960GB SSD + 6 x 2.4TB HDD", "DC Lyon", d("2026-12-31")],
    ],
  },
  { name: "Old lookup", hidden: true, rows: [["Code", "Label"], ["L", "Laptop"], ["D", "Desktop"], ["S", "Server"]] },
  { name: "Empty", rows: [] },
]);

// 06 — no header at all
csv("06_no_header.csv", [
  ["Dell", "Latitude 5420", "5CG1234XYZ", "i7-1185G7", "16GB", "512GB SSD", '14"'],
  ["HP", "EliteBook 840 G8", "5CD2345ABC", "i5-1145G7", "8GB", "256GB SSD", '14"'],
  ["Lenovo", "ThinkPad T14", "PF2ABCDE", "i5-1135G7", "16GB", "512GB SSD", '14"'],
  ["Dell", "OptiPlex 7090", "4FGH123", "i5-10505", "8GB", "256GB SSD", ""],
  ["Apple", "MacBook Pro 16", "C02ABCDEF123", "M1 Max", "32GB", "1TB SSD", '16"'],
]);

// 07 — every way of writing units; RAM given in MB and MHz by mistake
xlsx("07_mixed_units.xlsx", [
  {
    name: "Fleet",
    rows: [
      ["Type", "Make", "Model", "Serial", "RAM", "Disk", "Display"],
      ["Laptop", "HP", "ProBook 640 G8", "5CG0000001", "16 gig", "0.5 TB", "14 inch"],
      ["Laptop", "HP", "ProBook 640 G8", "5CG0000002", "16384 MB", "512GB", "35.6 cm"],
      ["Laptop", "Dell", "Latitude 7400", "ABCD001", "2x8GB", "256 SSD", "14''"],
      ["Desktop", "Dell", "OptiPlex 5080", "ABCD002", "8", "1TB HDD + 256GB SSD", null],
      ["Laptop", "Lenovo", "ThinkPad L14", "PF0000003", 2400, "256 GB", "14"],
      ["Laptop", "Lenovo", "ThinkPad E15", "PF0000004", "8 Go", "1 To", "15,6\""],
    ],
  },
]);

// 08 — peripherals mixed in and a total line
xlsx("08_peripherals_and_totals.xlsx", [
  {
    name: "Equipment",
    rows: [
      ["Category", "Brand", "Product", "Serial Number", "Qty", "Price"],
      ["Laptop", "Dell", "Latitude 5520", "5CG9990001", 1, 1250],
      ["Monitor", "Dell", "P2722H", "CN0MON0001", 2, 280],
      ["Keyboard", "Logitech", "MX Keys", "LOGI000001", 1, 99],
      ["Docking station", "Dell", "WD19S", "DOCK000001", 1, 199],
      ["Desktop", "HP", "EliteDesk 800 G8", "CZC9990002", 1, 900],
      ["Mouse", "Logitech", "MX Master 3", "LOGI000002", 1, 89],
      ["Total", null, null, null, 7, 3117],
    ],
  },
]);

// 09 — two-row header with merged group cells
xlsx("09_merged_two_row_header.xlsx", [
  {
    name: "Inventory",
    rows: [
      ["Identification", "Identification", "Identification", "Hardware", "Hardware", "Hardware", "Hardware"],
      ["Make", "Model", "Serial", "CPU", "RAM", "Storage", "Screen"],
      ["Dell", "Latitude 5420", "5CG1234XYZ", "i7", "16GB", "512GB SSD", '14"'],
      ["HP", "ZBook Firefly 14 G8", "5CD9876ZYX", "i7-1165G7", "32GB", "1TB SSD", '14"'],
      ["Lenovo", "ThinkStation P340", "S1A2B3C4", "Xeon W-1250", "64GB", "1TB NVMe", ""],
    ],
    merges: [
      { s: { r: 0, c: 0 }, e: { r: 0, c: 2 } },
      { s: { r: 0, c: 3 }, e: { r: 0, c: 6 } },
    ],
  },
]);

// 10 — two tables stacked in one sheet, different column orders
xlsx("10_two_tables_one_sheet.xlsx", [
  {
    name: "IT",
    rows: [
      ["LAPTOPS"],
      ["Serial", "Model", "RAM", "Disk"],
      ["5CG1111111", "Dell Latitude 5420", "16GB", "512GB SSD"],
      ["5CG2222222", "HP EliteBook 850 G8", "16GB", "512GB SSD"],
      [null],
      [null],
      ["SERVERS"],
      ["Hostname", "Model", "Serial number", "CPU", "Memory", "Storage"],
      ["srv-file-01", "PowerEdge R640", "SRV111111", "Xeon Silver 4210", "128 GB", "4x 2TB HDD"],
      ["srv-web-02", "ProLiant DL360 Gen10", "SRV222222", "Xeon Gold 5218", "64 GB", "2x 480GB SSD"],
    ],
  },
]);

// 11 — unusual column names, shuffled order, typo
xlsx("11_weird_column_names.xlsx", [
  {
    name: "Data",
    rows: [
      ["Proc", "Disk Size", "S/N", "Mfr", "Memmory", "Form Factor", "Display", "Product"],
      ["i5-8350U", "256 GB", "PC0ABC12", "Lenovo", "8 GB", "Laptop", '14"', "ThinkPad T480"],
      ["i7-8650U", "512 GB", "PC0DEF34", "Lenovo", "16 GB", "Laptop", '14"', "ThinkPad T480s"],
      ["Ryzen 5 PRO 4650G", "512 GB", "CZC5555555", "HP", "16 GB", "Desktop", "", "ProDesk 405 G6"],
    ],
  },
]);

// 12 — duplicates and placeholder serials
csv("12_duplicates.csv", [
  ["Type", "Manufacturer", "Model", "Serial"],
  ["Laptop", "Dell", "Latitude 5420", "5CG1234XYZ"],
  ["Laptop", "Dell", "Latitude 5420", "5cg-1234-xyz"],
  ["Laptop", "HP", "EliteBook 840 G8", "N/A"],
  ["Laptop", "HP", "EliteBook 840 G8", "TBD"],
  ["Desktop", "Lenovo", "ThinkCentre M70q", ""],
]);

// 13 — error cases
xlsx("13_empty.xlsx", [{ name: "Sheet1", rows: [] }]);
writeFileSync(join(OUT, "14_corrupt.xlsx"), Buffer.from("PK\u0003\u0004 this is not really a zip file ".repeat(20)));
writeFileSync(join(OUT, "15_not_a_spreadsheet.pdf"), Buffer.from("%PDF-1.4 fake"));

// 16 — headers in a language we have no vocabulary for (German): content detection must carry it
xlsx("16_german_headers.xlsx", [
  {
    name: "Inventar",
    rows: [
      ["Gerätetyp", "Hersteller", "Modellbezeichnung", "Seriennummer", "Prozessor", "Arbeitsspeicher", "Festplatte", "Bildschirmdiagonale"],
      ["Notebook", "Dell", "Latitude 5420", "5CG1234XYZ", "Intel Core i7-1185G7", "16 GB", "512 GB SSD", '14"'],
      ["Notebook", "HP", "EliteBook 840 G8", "5CD2345ABC", "Intel Core i5-1145G7", "8 GB", "256 GB SSD", '14"'],
      ["Desktop", "Lenovo", "ThinkCentre M720q", "MJ0ABC12", "Intel Core i5-8400T", "8 GB", "256 GB SSD", ""],
      ["Server", "Dell", "PowerEdge R740", "7XK9P23", "Intel Xeon Gold 6230", "256 GB", "4 x 1,2 TB HDD", ""],
    ],
  },
]);

// The demo file offered by the "Try a sample" button.
copyFileSync(join(OUT, "02_assets_FINAL_v3_USE_THIS_ONE.xlsx"), join(PUBLIC, "assets_FINAL_v3_USE_THIS_ONE.xlsx"));
copyFileSync(join(OUT, "04_combined_description.xlsx"), join(PUBLIC, "combined_descriptions.xlsx"));
copyFileSync(join(OUT, "03_french_semicolon.csv"), join(PUBLIC, "inventaire_fr.csv"));
copyFileSync(join(OUT, "06_no_header.csv"), join(PUBLIC, "no_header.csv"));

console.log(`Fixtures written to ${OUT}`);
