import { describe, expect, it } from "vitest";
import { parseCombined } from "@/lib/extract/combined";
import { formatStorage } from "@/lib/extract/storage";

function flat(text: string) {
  const r = parseCombined(text);
  return {
    manufacturer: r.manufacturer?.value,
    model: r.model?.value,
    type: r.assetType?.value,
    cpu: r.cpu?.value,
    ram: r.ramGB?.value,
    storage: r.storage ? formatStorage(r.storage.value) : undefined,
    screen: r.screenInches?.value,
  };
}

describe("parseCombined", () => {
  it("splits the example from the brief", () => {
    expect(flat("HP EliteBook 840 G8 / i5 / 16GB / 256GB SSD / 14in")).toEqual({
      manufacturer: "HP",
      model: "EliteBook 840 G8",
      type: "laptop",
      cpu: "Intel Core i5",
      ram: 16,
      storage: "256 GB SSD",
      screen: 14,
    });
  });

  it("handles a single cell with no separators", () => {
    expect(flat("Dell Lat 5420 i7 16GB")).toMatchObject({
      manufacturer: "Dell",
      model: "Latitude 5420",
      type: "laptop",
      cpu: "Intel Core i7",
      ram: 16,
    });
  });

  it("handles comma-separated specs and full CPU names", () => {
    expect(flat("Lenovo ThinkPad T14 Gen 2, Intel Core i7-1165G7, 32 GB RAM, 1TB NVMe, 14\"")).toEqual({
      manufacturer: "Lenovo",
      model: "ThinkPad T14 Gen 2",
      type: "laptop",
      cpu: "Intel Core i7-1165G7",
      ram: 32,
      storage: "1 TB NVMe",
      screen: 14,
    });
  });

  it("recognises servers", () => {
    expect(flat("HPE ProLiant DL380 Gen10 - 2x Xeon Gold 6230 - 256GB - 4x 1.2TB SAS HDD")).toMatchObject({
      manufacturer: "HPE",
      type: "server",
      cpu: "Intel Xeon Gold 6230",
      ram: 256,
    });
  });

  it("recognises Apple silicon without the brand next to the chip", () => {
    expect(flat("Apple MacBook Pro 14 M3 Pro 18GB 512GB")).toMatchObject({
      manufacturer: "Apple",
      type: "laptop",
      cpu: "Apple M3 Pro",
      ram: 18,
      storage: "512 GB",
    });
  });

  it("spots peripherals", () => {
    expect(flat("Dell P2422H 24\" monitor").type).toBe("monitor");
  });
});
