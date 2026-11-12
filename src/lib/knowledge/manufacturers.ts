/**
 * Canonical manufacturer names and the aliases people actually type.
 * Aliases are in normalised form (see `normalizeText`).
 */
export interface ManufacturerEntry {
  name: string;
  aliases: string[];
  /** True for brands that only make peripherals (helps spot non-computer rows). */
  peripheralOnly?: boolean;
}

export const MANUFACTURERS: ManufacturerEntry[] = [
  { name: "Dell", aliases: ["dell", "dell inc", "dell computer", "dell technologies", "dell emc", "del", "alienware"] },
  { name: "HPE", aliases: ["hpe", "hewlett packard enterprise", "hp enterprise"] },
  { name: "HP", aliases: ["hp", "hewlett packard", "hp inc", "hewlett packard company", "h p", "compaq", "hp compaq"] },
  { name: "Lenovo", aliases: ["lenovo", "lenovo group", "lenevo", "lenova", "ibm lenovo"] },
  { name: "Apple", aliases: ["apple", "apple inc", "apple computer"] },
  { name: "Microsoft", aliases: ["microsoft", "microsoft corporation", "ms", "msft"] },
  { name: "Asus", aliases: ["asus", "asustek", "asustek computer", "asus tek"] },
  { name: "Acer", aliases: ["acer", "acer inc"] },
  { name: "Fujitsu", aliases: ["fujitsu", "fujitsu siemens", "fujitsu technology solutions", "fts"] },
  { name: "Dynabook", aliases: ["dynabook", "toshiba", "toshiba dynabook"] },
  { name: "Samsung", aliases: ["samsung", "samsung electronics"] },
  { name: "Panasonic", aliases: ["panasonic"] },
  { name: "Supermicro", aliases: ["supermicro", "super micro", "smc"] },
  { name: "Cisco", aliases: ["cisco", "cisco systems"] },
  { name: "Huawei", aliases: ["huawei"] },
  { name: "MSI", aliases: ["msi", "micro star"] },
  { name: "Razer", aliases: ["razer"] },
  { name: "Google", aliases: ["google"] },
  { name: "Intel", aliases: ["intel"] },
  { name: "Gigabyte", aliases: ["gigabyte"] },
  { name: "Getac", aliases: ["getac"] },
  { name: "IBM", aliases: ["ibm"] },
  { name: "Oracle", aliases: ["oracle", "sun", "sun microsystems"] },
  { name: "Xiaomi", aliases: ["xiaomi"] },
  { name: "VMware", aliases: ["vmware", "vmware inc"] },
  { name: "Synology", aliases: ["synology"] },
  { name: "NetApp", aliases: ["netapp"] },
  { name: "LG", aliases: ["lg", "lg electronics"] },
  { name: "Sony", aliases: ["sony", "vaio"] },
  { name: "Logitech", aliases: ["logitech", "logi"], peripheralOnly: true },
  { name: "BenQ", aliases: ["benq"], peripheralOnly: true },
  { name: "ViewSonic", aliases: ["viewsonic"], peripheralOnly: true },
  { name: "Eizo", aliases: ["eizo"], peripheralOnly: true },
  { name: "AOC", aliases: ["aoc"], peripheralOnly: true },
  { name: "Philips", aliases: ["philips"], peripheralOnly: true },
  { name: "iiyama", aliases: ["iiyama"], peripheralOnly: true },
  { name: "Brother", aliases: ["brother"], peripheralOnly: true },
  { name: "Canon", aliases: ["canon"], peripheralOnly: true },
  { name: "Epson", aliases: ["epson"], peripheralOnly: true },
  { name: "Xerox", aliases: ["xerox"], peripheralOnly: true },
  { name: "Jabra", aliases: ["jabra"], peripheralOnly: true },
  { name: "Poly", aliases: ["poly", "plantronics"], peripheralOnly: true },
  { name: "Ubiquiti", aliases: ["ubiquiti", "ubnt"], peripheralOnly: true },
  { name: "Netgear", aliases: ["netgear"], peripheralOnly: true },
  { name: "APC", aliases: ["apc", "schneider apc"], peripheralOnly: true },
  { name: "Kensington", aliases: ["kensington"], peripheralOnly: true },
];
