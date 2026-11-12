import type { MappingTarget } from "../types";

/**
 * Header vocabulary for each target, in *normalised* form (lower case, no accents,
 * punctuation → spaces — see `normalizeText`). English + French, because spreadsheets
 * in an international company are rarely monolingual.
 *
 * - `strong`: a header equal to / containing one of these is very likely this field.
 * - `weak`  : plausible but ambiguous ("name" could be a hostname or a model).
 * - `veto`  : tokens that disqualify the field even if a strong word matches
 *             ("RAM slots", "Monitor serial", "Memory type").
 *
 * This is data, not logic: extending support for a new language is a matter of
 * adding words here.
 */
export interface HeaderVocabulary {
  strong: string[];
  weak?: string[];
  veto?: string[];
}

export const HEADER_VOCABULARY: Record<MappingTarget, HeaderVocabulary> = {
  assetType: {
    strong: [
      "asset type", "device type", "equipment type", "hardware type", "item type", "type", "category",
      "categorie", "type de materiel", "type materiel", "type d equipement", "form factor", "asset class",
      "asset category", "device category", "kind", "famille", "nature",
    ],
    weak: ["class", "classe", "group", "device", "equipment", "materiel"],
    veto: ["disk", "drive", "storage", "memory", "ram", "cpu", "processor", "screen", "display", "contract", "os", "license"],
  },
  manufacturer: {
    strong: [
      "manufacturer", "make", "brand", "vendor", "maker", "marque", "fabricant", "constructeur", "mfr", "mfg",
      "manufacturer name", "oem", "manuf", "editeur",
    ],
    veto: ["cpu", "processor", "monitor", "screen", "disk", "warranty"],
  },
  model: {
    strong: [
      "model", "model name", "model number", "model no", "modele", "product name", "product model", "device model",
      "hardware model", "computer model", "model description", "reference", "ref", "modele materiel", "mod",
    ],
    weak: ["product", "produit", "name", "nom"],
    veto: ["cpu", "processor", "monitor", "screen", "disk", "ram", "memory", "os", "id"],
  },
  serialNumber: {
    strong: [
      "serial", "serial number", "serial no", "serialnumber", "serial num", "s n", "sn", "numero de serie",
      "n de serie", "no de serie", "num serie", "num de serie", "n serie", "nserie", "service tag", "svc tag",
      "servicetag", "serial nr", "serienummer", "imei",
    ],
    veto: ["monitor", "screen", "ecran", "dock", "charger", "battery", "keyboard", "disk"],
  },
  cpu: {
    strong: ["cpu", "processor", "processeur", "proc", "cpu model", "cpu type", "processor type", "processor model", "chip", "chipset", "cpu name"],
    veto: ["cores", "core count", "speed", "ghz", "mhz", "socket", "count", "qty", "threads", "nb"],
  },
  ramGB: {
    strong: [
      "ram", "memory", "mem", "memoire", "memoire vive", "ram gb", "ram size", "memory size", "memory gb",
      "installed ram", "installed memory", "system memory", "physical memory", "ram go", "ram capacity", "memory capacity",
    ],
    veto: ["slots", "slot", "type", "speed", "mhz", "max", "maximum", "free", "available", "storage", "disk", "gpu", "graphics", "video"],
  },
  storage: {
    strong: [
      "storage", "disk", "disk size", "hdd", "ssd", "hard drive", "hard disk", "drive", "disque", "disque dur",
      "stockage", "storage size", "storage capacity", "disk capacity", "capacity", "capacite", "hdd size", "ssd size",
      "drive size", "drives", "disks", "hard drive size", "rom", "internal storage", "capacite disque",
    ],
    veto: ["type", "free", "available", "used", "serial", "count", "qty", "model", "interface", "controller", "raid"],
  },
  screenInches: {
    strong: [
      "screen", "screen size", "display", "display size", "ecran", "taille ecran", "taille d ecran", "taille de l ecran",
      "diagonal", "diagonale", "screen inches", "display inches", "inches", "pouces", "monitor size", "lcd", "lcd size",
    ],
    veto: ["resolution", "res", "serial", "type", "count", "qty", "brand", "model", "touch", "external"],
  },
  hostname: {
    strong: [
      "hostname", "host name", "host", "computer name", "device name", "machine name", "pc name", "nom machine",
      "nom de machine", "nom du poste", "nom poste", "nom d hote", "netbios", "netbios name", "fqdn", "asset name",
      "workstation name", "server name", "nom du serveur", "dns name", "vm name",
    ],
    weak: ["name", "nom"],
    veto: ["user", "owner", "employee", "utilisateur", "model", "product", "file", "vendor", "manufacturer", "first", "last"],
  },
  assetTag: {
    strong: [
      "asset tag", "asset id", "asset number", "asset no", "asset num", "asset code", "asset", "tag", "inventory number",
      "inventory no", "inventory id", "inventory tag", "n inventaire", "numero d inventaire", "num inventaire",
      "inventaire", "etiquette", "it tag", "asset ref", "barcode", "code barre", "immobilisation", "id",
    ],
    weak: ["no", "n", "ref", "code"],
    veto: ["type", "category", "class", "status", "owner", "name", "serial"],
  },
  assignedUser: {
    strong: [
      "user", "assigned to", "assignee", "owner", "employee", "utilisateur", "collaborateur", "assigned user",
      "staff", "used by", "proprietaire", "holder", "custodian", "user name", "username", "employee name", "email",
      "user email", "affecte a", "attribue a", "beneficiaire", "person", "primary user", "login",
    ],
    veto: ["count", "number of", "qty"],
  },
  location: {
    strong: [
      "location", "site", "office", "building", "room", "localisation", "lieu", "emplacement", "bureau", "city",
      "ville", "country", "pays", "floor", "etage", "datacenter", "data center", "rack", "agence", "campus",
    ],
    weak: ["department", "service", "departement", "team", "equipe", "entity", "entite"],
  },
  os: {
    strong: [
      "os", "operating system", "systeme d exploitation", "systeme", "os version", "os name", "platform",
      "windows version", "os build", "plateforme", "operating system version",
    ],
    veto: ["license", "licence", "key"],
  },
  purchaseDate: {
    strong: [
      "purchase date", "purchased", "date of purchase", "acquisition date", "date d achat", "date achat", "bought",
      "order date", "invoice date", "buy date", "purchase", "achat", "date acquisition", "in service date",
      "deployment date", "date de mise en service", "received", "date",
    ],
    veto: ["price", "cost", "prix", "order number", "po", "warranty", "garantie", "end", "expiry", "fin"],
  },
  warrantyEnd: {
    strong: [
      "warranty", "warranty end", "warranty expiry", "warranty expiration", "warranty end date", "garantie",
      "fin de garantie", "fin garantie", "end of warranty", "warranty until", "support end", "warranty expires",
      "expiration garantie", "date fin garantie", "contract end", "end of support", "eol",
    ],
    veto: ["type", "provider", "status", "start", "debut", "level"],
  },
  status: {
    strong: ["status", "state", "statut", "etat", "condition", "lifecycle", "lifecycle status", "asset status", "in use", "deployment status"],
    veto: ["warranty", "garantie"],
  },
  notes: {
    strong: ["notes", "note", "comments", "comment", "remarks", "remarques", "commentaire", "commentaires", "observations", "observation", "misc", "info", "remarque"],
  },
  combined: {
    strong: [
      "description", "desc", "specs", "specifications", "specification", "configuration", "config", "details",
      "designation", "libelle", "hardware", "hardware description", "item description", "spec", "equipment",
      "item", "article", "materiel", "equipement", "device", "computer", "machine", "asset description",
      "product description", "caracteristiques", "full description",
    ],
    weak: ["product", "produit"],
  },
};

/**
 * Headers that are clearly *not* asset fields. If a header matches one of these,
 * content evidence for the column is heavily discounted — e.g. a "Qty" column
 * full of small numbers must not be mistaken for RAM.
 */
export const IGNORED_HEADER_WORDS = [
  "qty", "quantity", "quantite", "qte", "price", "cost", "prix", "cout", "amount", "montant", "total", "po",
  "po number", "invoice", "facture", "order number", "supplier", "fournisseur", "currency", "devise", "vat",
  "tva", "line", "row", "index", "count", "nb", "cores", "core count", "threads", "speed", "ghz", "mhz",
  "mac", "mac address", "ip", "ip address", "adresse ip", "phone", "telephone", "ext", "extension", "cost center",
  "centre de cout", "depreciation", "amortissement", "value", "valeur", "year", "annee", "age", "weight", "poids",
];
