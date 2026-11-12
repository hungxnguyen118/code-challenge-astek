/**
 * Public entry points of the parser. The UI only talks to this module.
 *
 *   readWorkbook(name, bytes)      File bytes → RawWorkbook (grid per sheet). Throws IngestError.
 *   analyzeWorkbook(raw, overrides) RawWorkbook → ParseResult. Pure; re-run on every user correction.
 */
export { readWorkbook, IngestError, MAX_FILE_BYTES, SUPPORTED_EXTENSIONS } from "./ingest";
export { analyzeWorkbook, includedAssets } from "./pipeline";
