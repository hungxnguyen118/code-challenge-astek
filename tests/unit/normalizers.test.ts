import { describe, expect, it } from "vitest";
import { normalizeRam } from "@/lib/extract/ram";
import { normalizeStorage, formatStorage } from "@/lib/extract/storage";
import { normalizeScreen } from "@/lib/extract/screen";
import { normalizeCpu } from "@/lib/extract/cpu";
import { normalizeManufacturer } from "@/lib/extract/manufacturer";
import { normalizeModel, inferFromModel } from "@/lib/extract/model";
import { normalizeSerial, isPlaceholderSerial } from "@/lib/extract/serial";
import { normalizeAssetType } from "@/lib/extract/assetType";
import { normalizeDate, normalizeOs } from "@/lib/extract/misc";
import { unitHintFromHeader } from "@/lib/extract/unitHint";
import { parseLooseNumber } from "@/lib/text";

describe("RAM", () => {
  it.each([
    ["16", 16],
    ["16GB", 16],
    ["16 GB", 16],
    ["16 gig", 16],
    ["16 Go", 16],
    ["16384 MB", 16],
    ["16 GB DDR4", 16],
    ["2x8GB", 16],
    ["8+8 GB", 16],
    ["32GB RAM", 32],
    ["0.5 TB", 512],
    [8, 8],
    [16384, 16],
    ["1,5 TB", 1536],
  ] as const)("%s → %d GB", (input, expected) => {
    expect(normalizeRam(input)?.value).toBe(expected);
  });

  it("uses the header unit for bare numbers", () => {
    expect(normalizeRam(8192, "MB")?.value).toBe(8);
    expect(normalizeRam("8", "GB")?.confidence).toBeGreaterThan(0.85);
  });

  it("flags values that look like MHz", () => {
    expect(normalizeRam(2400)?.confidence).toBeLessThan(0.3);
  });

  it("rejects storage text", () => {
    expect(normalizeRam("256GB SSD")).toBeNull();
  });
});

describe("Storage", () => {
  it.each([
    ["256GB SSD", 256, "256 GB SSD"],
    ["512 Go NVMe", 512, "512 GB NVMe"],
    ["1TB", 1000, "1 TB"],
    ["0.5 TB", 500, "500 GB"],
    ["1TB HDD + 256GB SSD", 1256, "1 TB HDD + 256 GB SSD"],
    ["2x 1TB SSD", 2000, "2 × 1 TB SSD"],
    ["SSD 512GB", 512, "512 GB SSD"],
    ["1,5 TB", 1500, "1.5 TB"],
    [256, 256, "256 GB"],
  ] as const)("%s → %d GB (%s)", (input, total, label) => {
    const r = normalizeStorage(input);
    expect(r?.value.totalGB).toBe(total);
    expect(formatStorage(r!.value)).toBe(label);
  });

  it("does not take RAM for storage", () => {
    expect(normalizeStorage("16GB DDR4")).toBeNull();
  });
});

describe("Screen", () => {
  it.each([
    ["14", 14],
    ['14"', 14],
    ["14in", 14],
    ["14 inch", 14],
    ["14''", 14],
    ["15,6 pouces", 15.6],
    ['15.6"', 15.6],
    ["35.6 cm", 14],
    ["15.6 FHD", 15.6],
    [13.3, 13.3],
  ] as const)("%s → %d in", (input, expected) => {
    expect(normalizeScreen(input)?.value).toBe(expected);
  });
});

describe("CPU", () => {
  it.each([
    ["i7", "Intel Core i7"],
    ["Core i7-1185G7", "Intel Core i7-1185G7"],
    ["Intel(R) Core(TM) i5-8250U CPU @ 1.60GHz", "Intel Core i5-8250U"],
    ["i5 8350U", "Intel Core i5-8350U"],
    ["Intel Core Ultra 7 155H", "Intel Core Ultra 7 155H"],
    ["AMD Ryzen 5 PRO 4650U", "AMD Ryzen 5 PRO 4650U"],
    ["Ryzen 7 5800H", "AMD Ryzen 7 5800H"],
    ["Xeon E5-2620 v4", "Intel Xeon E5-2620 v4"],
    ["Intel Xeon Gold 6230", "Intel Xeon Gold 6230"],
    ["Apple M2", "Apple M2"],
    ["M1 Pro", "Apple M1 Pro"],
    ["AMD EPYC 7302", "AMD EPYC 7302"],
  ] as const)("%s → %s", (input, expected) => {
    expect(normalizeCpu(input)?.value).toBe(expected);
  });
});

describe("Manufacturer", () => {
  it.each([
    ["HP", "HP"],
    ["Hewlett-Packard", "HP"],
    ["hp inc.", "HP"],
    ["Dell Inc.", "Dell"],
    ["DELL", "Dell"],
    ["LENOVO", "Lenovo"],
    ["Apple Inc", "Apple"],
    ["HPE", "HPE"],
    ["Hewlett Packard Enterprise", "HPE"],
    ["Microsoft Corporation", "Microsoft"],
  ] as const)("%s → %s", (input, expected) => {
    expect(normalizeManufacturer(input)?.value).toBe(expected);
  });
});

describe("Model", () => {
  it.each([
    ["Lat 5420", "Latitude 5420"],
    ["Dell Latitude 5420", "Latitude 5420"],
    ["EliteBook 840 G8", "EliteBook 840 G8"],
    ["HP EB 840 G8", "EliteBook 840 G8"],
    ["ThinkPad T14 Gen 2", "ThinkPad T14 Gen 2"],
    ["DL380 Gen10", "ProLiant DL380 Gen10"],
    ["Optiplex 7090", "OptiPlex 7090"],
  ] as const)("%s → %s", (input, expected) => {
    expect(normalizeModel(input)?.value).toBe(expected);
  });

  it("infers manufacturer and type from the family", () => {
    expect(inferFromModel("Latitude 5420")).toMatchObject({ manufacturer: "Dell", type: "laptop" });
    expect(inferFromModel("PowerEdge R740")).toMatchObject({ manufacturer: "Dell", type: "server" });
    expect(inferFromModel("R740", "Dell")).toMatchObject({ type: "server" });
    expect(inferFromModel("R740")).toEqual({});
    expect(inferFromModel("ProLiant DL380")).toMatchObject({ manufacturer: "HPE", type: "server" });
  });
});

describe("Serial", () => {
  it("normalises", () => {
    expect(normalizeSerial("  5cg1234xyz ")?.value).toBe("5CG1234XYZ");
    expect(normalizeSerial("S/N: ABC12345")?.value).toBe("ABC12345");
    expect(normalizeSerial("SN7X21AB")?.value).toBe("SN7X21AB");
  });
  it.each(["N/A", "TBD", "000000", "-", "?", "unknown"])("%s is a placeholder", (s) => {
    expect(isPlaceholderSerial(s)).toBe(true);
    expect(normalizeSerial(s)).toBeNull();
  });
});

describe("Asset type", () => {
  it.each([
    ["Laptop", "laptop"],
    ["Notebook", "laptop"],
    ["PC Portable", "laptop"],
    ["PC fixe", "desktop"],
    ["Desktop", "desktop"],
    ["Serveur", "server"],
    ["Server", "server"],
    ["VM", "virtual-machine"],
    ["Écran", "monitor"],
    ["Docking station", "dock"],
    ["Thin client", "thin-client"],
  ] as const)("%s → %s", (input, expected) => {
    expect(normalizeAssetType(input)?.value).toBe(expected);
  });
});

describe("Dates & OS", () => {
  it.each([
    ["2023-04-01", "2023-04-01"],
    ["15/04/2023", "2023-04-15"],
    ["04/15/2023", "2023-04-15"],
    [45000, "2023-03-15"],
  ] as const)("%s → %s", (input, expected) => {
    expect(normalizeDate(input)?.value).toBe(expected);
  });
  it("normalises OS names", () => {
    expect(normalizeOs("Win 10 Pro")?.value).toBe("Windows 10 Pro");
    expect(normalizeOs("Windows Server 2019")?.value).toBe("Windows Server 2019");
  });
});

describe("helpers", () => {
  it("parses loose numbers", () => {
    expect(parseLooseNumber("15,6")).toBe(15.6);
    expect(parseLooseNumber("1,024")).toBe(1024);
    expect(parseLooseNumber("1.024,5")).toBe(1024.5);
  });
  it("reads unit hints from headers", () => {
    expect(unitHintFromHeader("RAM (GB)")).toBe("GB");
    expect(unitHintFromHeader("Mémoire (Mo)")).toBe("MB");
    expect(unitHintFromHeader("Screen (inches)")).toBe("in");
    expect(unitHintFromHeader('Screen "')).toBe("in");
  });
});
