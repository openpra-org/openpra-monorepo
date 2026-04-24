/**
 * praxis-node — Rust N-API native addon declarations.
 *
 * All functions accept/return JSON strings so they stay zero-copy across
 * the FFI boundary and require no napi type marshalling.
 */

/**
 * Validate an OpenPRA MEF model JSON string.
 * Returns a JSON envelope `{ ok: boolean, diagnostics: Diagnostic[] }`.
 */
export declare function validateOpenpraJson(input: string): string;

/**
 * Quantify all fault trees and event trees in an OpenPRA MEF model JSON.
 * @param strict When true, unresolved references cause an error (default: false).
 */
export declare function quantifyOpenpraJson(input: string, strict?: boolean): string;

/**
 * Quantify an OpenPRA MEF model with explicit analysis settings.
 * @param modelJson   Serialised OpenPRA MEF model.
 * @param settingsJson Serialised AnalysisSettings object.
 */
export declare function quantifyOpenpraJsonWithSettings(modelJson: string, settingsJson: string): string;

/**
 * Compile the PDAG for an event tree with explicit settings.
 */
export declare function compileEventTreePdagOpenpraJsonWithSettings(modelJson: string, settingsJson: string): string;

/** Convert an OpenPSA XML string to OpenPRA MEF JSON. */
export declare function convertOpensaXmlToOpenpraJson(input: string): string;

/** Convert a single OpenPSA XML file (identified by path) to OpenPRA MEF JSON. */
export declare function convertOpensaXmlFileToOpenpraJson(filePath: string, input: string): string;

/** Convert a batch of OpenPSA XML strings to OpenPRA MEF JSON. */
export declare function convertOpensaXmlBatchToOpenpraJson(input: string): string;

/**
 * Quantify a single fault tree from a flat ReactFlow graph.
 *
 * Input JSON shape (`FaultTreeQuantificationRequest`):
 * ```json
 * {
 *   "graph":         { "faultTreeId": "…", "topEventId": "…", "nodes": { … } },
 *   "algorithm":     "bdd" | "zbdd" | "mocus",
 *   "approximation": "rare_event" | "mcub",          // optional
 *   "maxOrder":      3,                               // optional
 *   "transferTrees": { "<ftId>": { … } }             // optional
 * }
 * ```
 *
 * Output JSON shape (`FaultTreeQuantificationResult`):
 * ```json
 * {
 *   "algorithm":           "bdd",
 *   "topEventProbability": 0.00123,
 *   "cutSets": [{ "events": ["id1","id2"], "probability": 0.001, "contribution": 0.81 }]
 * }
 * ```
 */
export declare function quantifyFaultTree(input: string): string;

/**
 * Phase 1 (Analyze): build BDD + full ZBDD and return exact probability plus per-order
 * MCS distribution. No cut sets are enumerated. Cheap relative to full quantification.
 *
 * Input JSON shape (same graph/transferTrees fields as `quantifyFaultTree`, no algorithm/approximation/limits needed):
 * ```json
 * { "graph": { "faultTreeId": "…", "topEventId": "…", "nodes": { … } } }
 * ```
 *
 * Output JSON shape (`FaultTreeMetadataResult`):
 * ```json
 * {
 *   "topEventProbability": 0.00123,
 *   "orderStats": [
 *     { "order": 1, "count": 3,  "minProbability": 1e-4, "maxProbability": 1e-2 },
 *     { "order": 2, "count": 12, "minProbability": 1e-8, "maxProbability": 1e-4 }
 *   ]
 * }
 * ```
 */
export declare function getFaultTreeMetadata(input: string): string;

/**
 * Phase 1 (Analyze): build BDD + full ZBDD for every sequence in an event tree and
 * return exact sequence frequencies plus per-order MCS distribution.
 * No cut sets are enumerated. Cheap relative to full quantification.
 *
 * Input JSON shape (same as `quantifyEventTree`, no algorithm/approximation/limits needed):
 * ```json
 * {
 *   "graph": {
 *     "eventTreeId": "…",
 *     "initiatingEventFrequency": 1.2e-4,
 *     "functionalEvents": { … },
 *     "sequences": { … },
 *     "nodes": […], "edges": […]
 *   },
 *   "faultTrees": { "<ftId>": { … } }
 * }
 * ```
 *
 * Output JSON shape (`EventTreeMetadataResult`):
 * ```json
 * {
 *   "totalCdf": 1.23e-4,
 *   "sequences": [
 *     {
 *       "sequenceId": "SEQ-1",
 *       "frequency": 6.1e-5,
 *       "orderStats": [
 *         { "order": 1, "count": 3, "minFrequency": 1e-6, "maxFrequency": 3e-5 },
 *         { "order": 2, "count": 8, "minFrequency": 1e-8, "maxFrequency": 1e-6 }
 *       ]
 *     }
 *   ]
 * }
 * ```
 */
export declare function getEventTreeMetadata(input: string): string;

/**
 * Quantify a single event tree from a flat ReactFlow graph plus linked fault trees.
 *
 * Input JSON shape (`EventTreeQuantificationRequest`):
 * ```json
 * {
 *   "graph": {
 *     "eventTreeId":               "…",
 *     "initiatingEventId":         "…",
 *     "initiatingEventFrequency":  1.2e-4,
 *     "functionalEvents":   { "<nodeId>": { "name": "…", "faultTreeId": "<ftId>" } },
 *     "sequences":          { "<nodeId>": { "name": "…", "functionalEventStates": { "<feNodeId>": "SUCCESS"|"FAILURE" } } },
 *     "nodes": […],
 *     "edges": […]
 *   },
 *   "faultTrees": { "<ftId>": { "faultTreeId": "…", "topEventId": "…", "nodes": { … } } },
 *   "algorithm":     "bdd" | "zbdd",
 *   "approximation": "rare_event" | "mcub",   // optional; only applied for "zbdd"
 *   "maxOrder":      3,                        // optional; limits ZBDD cut-set order
 *   "truncation":    1e-10                     // optional; limits ZBDD cut-set probability
 * }
 * ```
 *
 * Notes:
 *   - `initiatingEventFrequency` is required. The request is rejected with an error if absent or ≤ 0.
 *   - Every functional event must have a `faultTreeId` pointing to an entry in `faultTrees`.
 *     Missing fault trees produce an error rather than a silent fallback.
 *   - `frequency` in the output is the absolute sequence frequency (IE freq × conditional prob).
 *   - `probability` in the output is the conditional probability (frequency / IE freq).
 *   - `path` lists the FE states that define this sequence.
 *   - For `algorithm = "bdd"`, `cutSets` is always empty.
 *   - `approximation` and `maxOrder`/`truncation` only affect ZBDD cut-set enumeration.
 *
 * Output JSON shape (`EventTreeQuantificationResult`):
 * ```json
 * {
 *   "algorithm":  "zbdd",
 *   "totalCdf":   1.23e-4,
 *   "sequences": [
 *     {
 *       "sequenceId":  "SEQ-1",
 *       "frequency":   6.1e-5,
 *       "probability": 0.51,
 *       "path": [{ "functionalEventId": "<feNodeId>", "state": "FAILURE" }],
 *       "cutSets": [{ "events": ["pump-A", "valve-B"], "probability": 3e-5, "contribution": 0.49 }]
 *     }
 *   ]
 * }
 * ```
 */
export declare function quantifyEventTree(input: string): string;
