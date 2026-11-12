import type { AssetType, Normalized } from "../types";
import { COMPUTER_TYPES } from "../types";
import { normalizeText } from "../text";

/**
 * Keywords → asset type, EN + FR. Order matters: more specific first
 * ("thin client" before "client", "docking station" before "station").
 */
const TYPE_KEYWORDS: Array<{ type: AssetType; words: string[] }> = [
  { type: "thin-client", words: ["thin client", "client leger", "zero client"] },
  { type: "virtual-machine", words: ["virtual machine", "machine virtuelle", "vm", "vps", "virtual server", "serveur virtuel"] },
  { type: "dock", words: ["docking station", "dock", "docking", "station d accueil", "port replicator", "replicateur"] },
  { type: "workstation", words: ["workstation", "station de travail", "mobile workstation", "cad station"] },
  { type: "server", words: ["server", "serveur", "srv", "rack server", "blade", "host", "hyperviseur", "hypervisor", "esxi host", "nas", "san", "storage array"] },
  { type: "laptop", words: ["laptop", "notebook", "portable", "ordinateur portable", "pc portable", "ultrabook", "macbook", "chromebook", "2 in 1", "2in1", "convertible", "netbook", "mobile pc"] },
  { type: "tablet", words: ["tablet", "tablette", "ipad", "slate"] },
  { type: "desktop", words: ["desktop", "pc fixe", "fixe", "poste fixe", "tower", "tour", "sff", "small form factor", "mini pc", "micro pc", "all in one", "aio", "unite centrale", "uc", "pc", "computer", "ordinateur", "mt", "usff", "tiny"] },
  { type: "monitor", words: ["monitor", "moniteur", "ecran", "screen", "display", "lcd", "tv", "television"] },
  { type: "keyboard", words: ["keyboard", "clavier"] },
  { type: "mouse", words: ["mouse", "souris", "trackpad", "trackball"] },
  { type: "headset", words: ["headset", "casque", "headphones", "ecouteurs", "speakerphone", "webcam", "camera"] },
  { type: "printer", words: ["printer", "imprimante", "scanner", "copier", "mfp", "plotter", "traceur"] },
  { type: "phone", words: ["phone", "smartphone", "mobile phone", "telephone", "iphone", "android phone", "desk phone"] },
  { type: "network", words: ["switch", "router", "routeur", "firewall", "pare feu", "access point", "borne wifi", "wifi", "ups", "onduleur", "modem", "load balancer"] },
  { type: "accessory", words: ["cable", "adapter", "adaptateur", "charger", "chargeur", "power supply", "alimentation", "bag", "sacoche", "hub", "dongle", "projector", "projecteur", "usb stick", "cle usb", "external drive", "disque externe"] },
  { type: "other", words: ["other", "autre", "misc", "divers"] },
];

const KEYWORD_REGEXES = TYPE_KEYWORDS.flatMap(({ type, words }) =>
  words.map((w) => ({ type, word: w, re: new RegExp(`(?:^|\\s)${w}(?:s|x)?(?=\\s|$)`) })),
);

/** "Notebook" → laptop, "PC fixe" → desktop, "Serveur" → server, "Écran" → monitor */
export function normalizeAssetType(raw: unknown): Normalized<AssetType> | null {
  if (typeof raw !== "string") return null;
  const n = normalizeText(raw);
  if (!n) return null;
  for (const { type, word, re } of KEYWORD_REGEXES) {
    if (n === word || n === `${word}s`) return { value: type, confidence: 1 };
    if (re.test(n)) return { value: type, confidence: 0.85 };
  }
  return null;
}

/**
 * Look for a device-type keyword inside free text (a description, a model, a sheet name).
 * Generic words that are too ambiguous inside a sentence ("pc", "screen", "host") are ignored here.
 */
const AMBIGUOUS_IN_TEXT = new Set(["pc", "computer", "ordinateur", "screen", "display", "host", "mt", "uc", "tour", "fixe", "portable", "tiny", "san", "lcd", "hub", "camera", "other", "autre", "misc", "divers", "tv", "wifi", "aio"]);

export function findAssetTypeInText(text: string): { type: AssetType; word: string } | null {
  const n = normalizeText(text);
  if (!n) return null;
  for (const { type, word, re } of KEYWORD_REGEXES) {
    if (AMBIGUOUS_IN_TEXT.has(word)) continue;
    if (re.test(n)) return { type, word };
  }
  return null;
}

export function isComputerType(t: AssetType): boolean {
  return (COMPUTER_TYPES as readonly string[]).includes(t);
}

export const ASSET_TYPE_LABELS: Record<AssetType, string> = {
  laptop: "Laptop",
  desktop: "Desktop",
  workstation: "Workstation",
  server: "Server",
  "virtual-machine": "Virtual machine",
  tablet: "Tablet",
  "thin-client": "Thin client",
  monitor: "Monitor",
  dock: "Dock",
  keyboard: "Keyboard",
  mouse: "Mouse",
  headset: "Audio / video",
  printer: "Printer",
  phone: "Phone",
  network: "Network",
  accessory: "Accessory",
  other: "Other",
};
