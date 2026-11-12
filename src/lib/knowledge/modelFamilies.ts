import type { AssetType } from "../types";

/**
 * Product families → manufacturer + asset type. This is what lets us say
 * "Lat 5420" is a Dell laptop or "DL380" is an HPE server even when the
 * spreadsheet has no Manufacturer or Type column.
 *
 * `match` is a regex source (case-insensitive, matched on word boundaries).
 * The first alternative that matches is replaced by `family` when cleaning
 * a model name, which also expands abbreviations ("Lat" → "Latitude").
 */
export interface ModelFamily {
  family: string;
  manufacturer: string;
  type: AssetType;
  match: string;
  /** Match is a model code (e.g. "DL380"): on cleaning, prefix the family instead of replacing. */
  prefix?: boolean;
  /** Ambiguous pattern: only trust it when the manufacturer agrees. */
  weak?: boolean;
}

export const MODEL_FAMILIES: ModelFamily[] = [
  // Dell
  { family: "Latitude", manufacturer: "Dell", type: "laptop", match: "latitude|lat(?=\\s*\\d)|lati" },
  { family: "Precision", manufacturer: "Dell", type: "workstation", match: "precision|prec(?=\\s*\\d)" },
  { family: "OptiPlex", manufacturer: "Dell", type: "desktop", match: "optiplex|opti(?=\\s*\\d)|opx(?=\\s*\\d)" },
  { family: "Vostro", manufacturer: "Dell", type: "laptop", match: "vostro" },
  { family: "Inspiron", manufacturer: "Dell", type: "laptop", match: "inspiron" },
  { family: "XPS", manufacturer: "Dell", type: "laptop", match: "xps" },
  { family: "PowerEdge", manufacturer: "Dell", type: "server", match: "poweredge|power edge|pe(?=\\s*[rtm]\\d{3})" },
  { family: "PowerEdge", manufacturer: "Dell", type: "server", match: "[rtcm]\\d{3}0?(?:xs|xd|xa)?", prefix: true, weak: true },
  { family: "Wyse", manufacturer: "Dell", type: "thin-client", match: "wyse" },
  { family: "Alienware", manufacturer: "Dell", type: "desktop", match: "alienware" },
  // HP / HPE
  { family: "EliteBook", manufacturer: "HP", type: "laptop", match: "elitebook|elite book|eb(?=\\s*\\d{3})" },
  { family: "ProBook", manufacturer: "HP", type: "laptop", match: "probook|pro book|pb(?=\\s*\\d{3})" },
  { family: "ZBook", manufacturer: "HP", type: "workstation", match: "zbook|z book" },
  { family: "EliteDesk", manufacturer: "HP", type: "desktop", match: "elitedesk|elite desk|ed(?=\\s*\\d{3})" },
  { family: "ProDesk", manufacturer: "HP", type: "desktop", match: "prodesk|pro desk" },
  { family: "EliteOne", manufacturer: "HP", type: "desktop", match: "eliteone|elite one" },
  { family: "ProOne", manufacturer: "HP", type: "desktop", match: "proone|pro one" },
  { family: "Elite Mini", manufacturer: "HP", type: "desktop", match: "elite mini" },
  { family: "Elite Dragonfly", manufacturer: "HP", type: "laptop", match: "elite dragonfly|dragonfly" },
  { family: "Spectre", manufacturer: "HP", type: "laptop", match: "spectre" },
  { family: "Envy", manufacturer: "HP", type: "laptop", match: "envy" },
  { family: "Pavilion", manufacturer: "HP", type: "laptop", match: "pavilion" },
  { family: "Z Workstation", manufacturer: "HP", type: "workstation", match: "z[2468] g\\d|z[2468](?= tower| mini)" },
  { family: "ProLiant", manufacturer: "HPE", type: "server", match: "proliant|pro liant" },
  { family: "ProLiant", manufacturer: "HPE", type: "server", match: "(?:dl|ml|bl)\\s?\\d{3}", prefix: true },
  { family: "Thin Client", manufacturer: "HP", type: "thin-client", match: "t[56]\\d0(?= thin)|thin client" },
  // Lenovo
  { family: "ThinkPad", manufacturer: "Lenovo", type: "laptop", match: "thinkpad|think pad|tp(?=\\s*[a-z]?\\d)" },
  { family: "ThinkBook", manufacturer: "Lenovo", type: "laptop", match: "thinkbook|think book" },
  { family: "ThinkCentre", manufacturer: "Lenovo", type: "desktop", match: "thinkcentre|thinkcenter|think centre|tc(?=\\s*m\\d)" },
  { family: "ThinkStation", manufacturer: "Lenovo", type: "workstation", match: "thinkstation|think station" },
  { family: "ThinkSystem", manufacturer: "Lenovo", type: "server", match: "thinksystem|think system" },
  { family: "ThinkSystem", manufacturer: "Lenovo", type: "server", match: "s[rt]\\d{3}", prefix: true },
  { family: "IdeaPad", manufacturer: "Lenovo", type: "laptop", match: "ideapad|idea pad" },
  { family: "IdeaCentre", manufacturer: "Lenovo", type: "desktop", match: "ideacentre|ideacenter" },
  { family: "Yoga", manufacturer: "Lenovo", type: "laptop", match: "yoga" },
  { family: "Legion", manufacturer: "Lenovo", type: "laptop", match: "legion" },
  // Apple
  { family: "MacBook Pro", manufacturer: "Apple", type: "laptop", match: "macbook pro|mbp|mac book pro" },
  { family: "MacBook Air", manufacturer: "Apple", type: "laptop", match: "macbook air|mba|mac book air" },
  { family: "MacBook", manufacturer: "Apple", type: "laptop", match: "macbook" },
  { family: "iMac", manufacturer: "Apple", type: "desktop", match: "imac" },
  { family: "Mac mini", manufacturer: "Apple", type: "desktop", match: "mac mini|macmini" },
  { family: "Mac Studio", manufacturer: "Apple", type: "desktop", match: "mac studio" },
  { family: "Mac Pro", manufacturer: "Apple", type: "workstation", match: "mac pro" },
  { family: "iPad", manufacturer: "Apple", type: "tablet", match: "ipad" },
  { family: "iPhone", manufacturer: "Apple", type: "phone", match: "iphone" },
  // Microsoft
  { family: "Surface Laptop", manufacturer: "Microsoft", type: "laptop", match: "surface laptop" },
  { family: "Surface Book", manufacturer: "Microsoft", type: "laptop", match: "surface book" },
  { family: "Surface Studio", manufacturer: "Microsoft", type: "desktop", match: "surface studio" },
  { family: "Surface Pro", manufacturer: "Microsoft", type: "tablet", match: "surface pro" },
  { family: "Surface Go", manufacturer: "Microsoft", type: "tablet", match: "surface go" },
  // Others
  { family: "ZenBook", manufacturer: "Asus", type: "laptop", match: "zenbook" },
  { family: "VivoBook", manufacturer: "Asus", type: "laptop", match: "vivobook" },
  { family: "ExpertBook", manufacturer: "Asus", type: "laptop", match: "expertbook" },
  { family: "ROG", manufacturer: "Asus", type: "laptop", match: "rog" },
  { family: "TravelMate", manufacturer: "Acer", type: "laptop", match: "travelmate" },
  { family: "Aspire", manufacturer: "Acer", type: "laptop", match: "aspire" },
  { family: "Swift", manufacturer: "Acer", type: "laptop", match: "swift" },
  { family: "Veriton", manufacturer: "Acer", type: "desktop", match: "veriton" },
  { family: "LIFEBOOK", manufacturer: "Fujitsu", type: "laptop", match: "lifebook" },
  { family: "ESPRIMO", manufacturer: "Fujitsu", type: "desktop", match: "esprimo" },
  { family: "PRIMERGY", manufacturer: "Fujitsu", type: "server", match: "primergy" },
  { family: "Tecra", manufacturer: "Dynabook", type: "laptop", match: "tecra" },
  { family: "Portégé", manufacturer: "Dynabook", type: "laptop", match: "portege|portégé" },
  { family: "Satellite", manufacturer: "Dynabook", type: "laptop", match: "satellite" },
  { family: "Toughbook", manufacturer: "Panasonic", type: "laptop", match: "toughbook" },
  { family: "Galaxy Book", manufacturer: "Samsung", type: "laptop", match: "galaxy book" },
  { family: "Galaxy Tab", manufacturer: "Samsung", type: "tablet", match: "galaxy tab" },
  { family: "Galaxy", manufacturer: "Samsung", type: "phone", match: "galaxy s\\d+|galaxy a\\d+" },
  { family: "SuperServer", manufacturer: "Supermicro", type: "server", match: "superserver|super server" },
  { family: "UCS", manufacturer: "Cisco", type: "server", match: "ucs" },
  { family: "NUC", manufacturer: "Intel", type: "desktop", match: "nuc" },
  { family: "Chromebook", manufacturer: "", type: "laptop", match: "chromebook" },
  { family: "Pixel", manufacturer: "Google", type: "phone", match: "pixel \\d" },
];

/** Compiled once. */
export const MODEL_FAMILY_REGEXES = MODEL_FAMILIES.map((f) => ({
  ...f,
  regex: new RegExp(`(?<![a-z0-9])(?:${f.match})(?![a-z])`, "i"),
}));
