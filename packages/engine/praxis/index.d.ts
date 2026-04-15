/**
 * TypeScript declarations for the praxis native Node.js addon.
 *
 * Build the addon first:
 *   cd packages/engine/praxis
 *   cargo build --features napi-rs --release
 *   cp target/release/libpraxis.so praxis.node   # Linux
 *   cp target/release/libpraxis.dylib praxis.node # macOS
 */
declare module "praxis-node" {
  /**
   * Quantify a fault tree using the praxis engine.
   *
   * @param requestJson - JSON-serialized `QuantificationRequest`:
   * ```json
   * {
   *   "graph": { "faultTreeId": "...", "topEventId": "...", "nodes": { ... } },
   *   "algorithm": "bdd" | "zbdd" | "mocus",
   *   "approximation": "rare_event" | "mcub",
   *   "maxOrder": 10
   * }
   * ```
   * Returns JSON-serialized `QuantificationResult`.
   * When `algorithm === "zbdd"`, the result includes a `zbddDiagnostics` field
   * with node/product/order counts from the ZBDD graph.
   */
  export function quantifyFaultTree(requestJson: string): string;

  /**
   * Validate an OpenPRA JSON model bundle.
   * @param input - JSON string of the OpenPRA model
   * @returns JSON string with validation diagnostics
   */
  export function validateOpenpraJson(input: string): string;

  /**
   * Quantify an OpenPRA JSON model bundle.
   * @param input - JSON string of the OpenPRA model
   * @param strict - If true, uses strict resolve mode (unresolved refs are errors)
   * @returns JSON string with quantification results
   */
  export function quantifyOpenpraJson(input: string, strict?: boolean): string;

  /**
   * Quantify an OpenPRA JSON model bundle with extended solver settings.
   * @param modelJson - JSON string of the OpenPRA model
   * @param settingsJson - JSON string of quantification settings
   * @returns JSON string with quantification results
   */
  export function quantifyOpenpraJsonWithSettings(modelJson: string, settingsJson: string): string;

  /**
   * Compile an event-tree PDAG from an OpenPRA JSON model with extended settings.
   * @param modelJson - JSON string of the OpenPRA model
   * @param settingsJson - JSON string of compilation settings
   * @returns JSON string with compiled PDAG result
   */
  export function compileEventTreePdagOpenpraJsonWithSettings(modelJson: string, settingsJson: string): string;

  /**
   * Convert an OpenPSA XML model to OpenPRA JSON format.
   * @param input - OpenPSA XML string
   * @returns JSON string of the converted OpenPRA model
   */
  export function convertOpenpraXmlToOpenpraJson(input: string): string;

  /**
   * Convert a single OpenPSA XML file to OpenPRA JSON format, with the file path
   * used for diagnostic messages.
   * @param filePath - Path of the source XML file (for error messages)
   * @param input - OpenPSA XML string
   * @returns JSON string of the converted OpenPRA model
   */
  export function convertOpenpraXmlFileToOpenpraJson(filePath: string, input: string): string;

  /**
   * Convert a batch of OpenPSA XML files to OpenPRA JSON format.
   * @param input - JSON array of `{ filePath, content }` objects
   * @returns JSON string of the merged OpenPRA model
   */
  export function convertOpenpraXmlBatchToOpenpraJson(input: string): string;
}
