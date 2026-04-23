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
 * Quantify a single event tree from a flat ReactFlow graph plus linked fault trees.
 *
 * Input JSON shape (superset of `EventTreeQuantificationRequest`):
 * ```json
 * {
 *   "graph": {
 *     "eventTreeId":        "…",
 *     "initiatingEventId":  "…",
 *     "functionalEvents":   { "<nodeId>": { "id": "…", "faultTreeId": "…" } },
 *     "sequences":          { "<nodeId>": { "id": "…", "functionalEventStates": { "<feId>": "SUCCESS"|"FAILURE" } } },
 *     "nodes": […],
 *     "edges": […]
 *   },
 *   "faultTrees": { "<ftId>": { "faultTreeId": "…", "topEventId": "…", "nodes": { … } } },
 *   "algorithm":     "bdd" | "zbdd" | "mocus" | "monte_carlo",
 *   "approximation": "rare_event" | "mcub",   // optional
 *   "maxOrder":      3                         // optional
 * }
 * ```
 *
 * Output JSON shape (`EventTreeQuantificationResult`):
 * ```json
 * {
 *   "algorithm":  "bdd",
 *   "totalCdf":   0.00456,
 *   "sequences": [{ "sequenceId": "SEQ-1", "frequency": 0.002, "probability": 0.002, "path": […], "cutSets": [] }]
 * }
 * ```
 */
export declare function quantifyEventTree(input: string): string;
