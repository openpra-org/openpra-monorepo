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
   * @returns JSON-serialized `QuantificationResult`
   */
  export function quantifyFaultTree(requestJson: string): string;

  /**
   * Validate an OpenPRA JSON model bundle.
   * @param input - JSON string of the OpenPRA model
   * @returns JSON string with diagnostics
   */
  export function validateOpenpraJson(input: string): string;

  /**
   * Quantify an OpenPRA JSON model bundle.
   * @param input - JSON string of the OpenPRA model
   * @param strict - If true, uses strict resolve mode
   * @returns JSON string with quantification results
   */
  export function quantifyOpenpraJson(input: string, strict?: boolean): string;
}
