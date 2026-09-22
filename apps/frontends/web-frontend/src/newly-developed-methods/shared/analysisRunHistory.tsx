import { useEffect, useRef, useState } from "react";
import { stringifyJson } from "interfaces-shared-types/json";
import { EventTreeSchema } from "interfaces-mef-types/zod/es/event-sequence-analysis";
import { hclEventTreeResultMetadata } from "../hybrid-causal-logic/hclResultLabels";
import {
  AnalysisRunDetailsSchema,
  AnalysisRunProvenanceListSchema,
  type AnalysisRunDetails,
  type AnalysisRunProvenance,
  type AnalysisRunMetadata,
} from "interfaces-shared-types/newly-developed-methods/shared";
import {
  HclBatchExecuteResultSchema,
  HclQuantificationResultSchema,
} from "interfaces-shared-types/newly-developed-methods/hybrid-causal-logic";
import { EventTreeAnalysisResultSchema } from "interfaces-shared-types/newly-developed-methods/event-tree";
import { FaultTreeAnalysisResultSchema } from "interfaces-shared-types/newly-developed-methods/fault-tree";
import {
  BayesianNetworkModelSchema,
  BayesianNetworkStoredResultSchema,
} from "interfaces-shared-types/newly-developed-methods/bayesian-network";
import { BayesianNetworkResults, BayesianNetworkBatchResults } from "../bayesian-network/bayesianNetworkResults";
import { HclResults } from "../hybrid-causal-logic/hclResults";
import { FaultTreeResults } from "../fault-tree";
import type { HclEditorRunResult, HclEventTreeOption } from "../hybrid-causal-logic/hclBindingTypes";
import { fetchJson } from "../../api/client";
import { ANALYSIS_RUN_CHANGED, type AnalysisRunChanged } from "./analysisRunEvents";
import "./css/analysisRunHistory.css";

const HistoricalEventTreeLabelsSchema = EventTreeSchema.pick({
  uuid: true,
  name: true,
  sequences: true,
  endStateIds: true,
  transfers: true,
}).strip();

function hclResult(run: AnalysisRunMetadata, value: unknown): HclEditorRunResult | null {
  if (value === null) return null;
  return run.methodType === "EVENT_TREE" ?
      { kind: "EVENT_TREE", result: EventTreeAnalysisResultSchema.parse(value) }
    : { kind: "FAULT_TREE", result: HclQuantificationResultSchema.parse(value) };
}

function historicalFaultTreeBasicEventCodes(details: AnalysisRunDetails): Record<string, string> {
  const codes: Record<string, string> = {};
  for (const source of details.workbookSnapshots) {
    if (source.hostType !== "SY") continue;
    const events = source.mef["systemBasicEvents"];
    if (!Array.isArray(events)) continue;
    for (const candidate of events) {
      if (typeof candidate !== "object" || candidate === null) continue;
      const event = candidate as Record<string, unknown>;
      if (typeof event["uuid"] === "string" && typeof event["code"] === "string") {
        codes[event["uuid"]] = event["code"];
      }
    }
  }
  return codes;
}

export function SavedAnalysisResult({ details }: { details: AnalysisRunDetails }) {
  const eventTreeOptions: HclEventTreeOption[] = details.workbookSnapshots.flatMap((source) => {
    const trees = source.mef["eventTrees"];
    if (source.hostType !== "ES" || !Array.isArray(trees)) return [];
    return trees.flatMap((candidate) => {
      const parsed = HistoricalEventTreeLabelsSchema.safeParse(candidate);
      if (!parsed.success) return [];
      const tree = parsed.data;
      return [
        {
          workbookId: source.identity.workbookId,
          workbookName: String(source.mef["name"] ?? source.identity.workbookId),
          modelId: tree.uuid,
          modelCode: tree.uuid,
          modelName: tree.name,
          faultTrees: [],
          ...hclEventTreeResultMetadata([tree]),
        },
      ];
    });
  });
  if (details.result === null) return <p>{details.run.failure?.message ?? "No numerical result was recorded."}</p>;
  if (details.run.scope === "BATCH") {
    const batch = HclBatchExecuteResultSchema.parse(details.result);
    const members = new Map(details.members?.map((row) => [row.run.id, row]));
    return (
      <HclResults
        workflow="BATCH"
        calculationType={details.request["calculationType"] === "UNCERTAINTY" ? "UNCERTAINTY" : "PROBABILITY"}
        runResult={null}
        faultTreeOptions={[]}
        eventTreeOptions={eventTreeOptions}
        batchRunResult={{
          kind: details.run.methodType === "EVENT_TREE" ? "EVENT_TREE" : "FAULT_TREE",
          compilationReuse: batch.compilationReuse,
          hazardConvolution: batch.hazardConvolution,
          scenarios: batch.runs.map((row) => ({
            scenarioId: row.scenarioId,
            scenarioCode: row.scenarioCode,
            scenarioName: row.scenarioName,
            status: row.run.status,
            failure: row.run.failure?.message ?? null,
            result: hclResult(row.run, members.get(row.run.id)?.result ?? null),
          })),
        }}
      />
    );
  }
  if (details.run.methodType === "FAULT_TREE") {
    const result = FaultTreeAnalysisResultSchema.parse(details.result);
    return (
      <FaultTreeResults
        analysisResult={result}
        resultIsStale={details.run.freshness?.status !== "CURRENT"}
        basicEventCodes={historicalFaultTreeBasicEventCodes(details)}
      />
    );
  }
  if (details.run.methodType === "BAYESIAN_NETWORK") {
    const result = BayesianNetworkStoredResultSchema.parse(details.result);
    const candidate = details.workbookSnapshots
      .flatMap((source) => {
        const models = source.mef["dependencyBayesianNetworks"] ?? source.mef["bayesianNetworks"];
        return Array.isArray(models) ? models : [];
      })
      .find((model: { modelId?: string }) => model.modelId === details.run.owner.modelId);
    const model = BayesianNetworkModelSchema.safeParse(candidate);
    if (!model.success)
      return (
        <p>Historical network labels are unavailable. Download the saved run to inspect every returned probability.</p>
      );
    return "scenarios" in result ?
        <BayesianNetworkBatchResults
          batch={{ ...result, queryNodeId: result.queryNodeIds[0]! }}
          model={model.data}
        />
      : <BayesianNetworkResults
          result={result}
          model={model.data}
        />;
  }
  return (
    <HclResults
      runResult={hclResult(details.run, details.result)}
      batchRunResult={null}
      calculationType={details.request["calculationType"] === "UNCERTAINTY" ? "UNCERTAINTY" : "PROBABILITY"}
      faultTreeOptions={[]}
      eventTreeOptions={eventTreeOptions}
    />
  );
}

export function downloadSavedRun(details: AnalysisRunDetails): void {
  const url = URL.createObjectURL(new Blob([stringifyJson(details, 2)!], { type: "application/json" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `analysis-run-${details.run.id}.json`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

export function AnalysisRunHistory({
  host,
  workbookId,
  calculationType,
}: {
  host: AnalysisRunChanged["host"];
  workbookId: string | null;
  calculationType?: string;
}) {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<AnalysisRunProvenance[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [details, setDetails] = useState<AnalysisRunDetails | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const request = useRef(0);
  const selected = useRef<string | null>(null);
  const page = useRef<string | undefined>(undefined);
  const base = `/api/${host}-workbooks/${encodeURIComponent(workbookId ?? "")}/analysis-runs`;
  async function load(next?: string) {
    page.current = next;
    const current = ++request.current;
    setLoading(true);
    setError(null);
    try {
      const response = AnalysisRunProvenanceListSchema.parse(
        await fetchJson<unknown>(base + (next ? `?cursor=${encodeURIComponent(next)}` : "")),
      );
      const visibleRows = calculationType === undefined ? response.runs : (await Promise.all(response.runs.map(async (row) => {
        if (row.run.methodType !== "FAULT_TREE") return null;
        try {
          const detail = AnalysisRunDetailsSchema.parse(await fetchJson<unknown>(`${base}/${row.run.id}/details`));
          return detail.request["calculationType"] === calculationType
            && (calculationType !== "UNCERTAINTY" || detail.request["uncertaintyInputSource"] === "DA") ? row : null;
        } catch { return null; }
      }))).filter((row): row is AnalysisRunProvenance => row !== null);
      const refreshed =
        selected.current === null ?
          null
        : AnalysisRunDetailsSchema.parse(await fetchJson<unknown>(`${base}/${selected.current}/details`));
      if (current !== request.current) return;
      setRows(visibleRows);
      setCursor(response.nextCursor ?? null);
      setDetails(refreshed);
    } catch (caught) {
      if (current === request.current) {
        setRows([]);
        setDetails(null);
        selected.current = null;
        setError(caught instanceof Error ? caught.message : "Could not read saved runs.");
      }
    } finally {
      if (current === request.current) setLoading(false);
    }
  }
  async function inspect(id: string) {
    const current = ++request.current;
    selected.current = id;
    setLoading(true);
    setDetails(null);
    setError(null);
    try {
      const value = AnalysisRunDetailsSchema.parse(await fetchJson<unknown>(`${base}/${id}/details`));
      if (current === request.current) setDetails(value);
    } catch (caught) {
      if (current === request.current)
        setError(caught instanceof Error ? caught.message : "Could not read this saved run.");
    } finally {
      if (current === request.current) setLoading(false);
    }
  }
  useEffect(() => {
    request.current++;
    selected.current = null;
    setDetails(null);
    setRows([]);
    setCursor(null);
    setError(null);
  }, [host, workbookId, calculationType]);
  useEffect(() => {
    if (!open || workbookId === null) return;
    void load();
    const refresh = () => {
      if (document.visibilityState !== "hidden") void load(page.current);
    };
    const changed = (event: Event) => {
      const value = (event as CustomEvent<AnalysisRunChanged>).detail;
      if (value.host === host && value.workbookId === workbookId) void load();
    };
    window.addEventListener(ANALYSIS_RUN_CHANGED, changed);
    window.addEventListener("focus", refresh);
    const timer = window.setInterval(refresh, 30000);
    return () => {
      request.current++;
      window.clearInterval(timer);
      window.removeEventListener(ANALYSIS_RUN_CHANGED, changed);
      window.removeEventListener("focus", refresh);
    };
  }, [open, host, workbookId, calculationType]);
  if (workbookId === null) return null;
  return (
    <section className="analysis-history" aria-label={calculationType === "UNCERTAINTY" ? "Uncertainty history" : "Analysis history"}>
      <div className="analysis-history__header">
        <h3>{calculationType === "UNCERTAINTY" ? "Uncertainty history" : "Analysis history"}</h3>
        <button
          type="button"
          className="analysis-history__toggle"
          aria-expanded={open}
          onClick={() => setOpen((current) => !current)}
        >
          {open ? "Hide saved runs" : "Review saved runs"}
          <svg className="analysis-history__chevron" viewBox="0 0 12 12" fill="none" aria-hidden="true">
            <path d="m2 4 4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>
      {open && (
        <div className="analysis-history__body">
          <div className="analysis-history__toolbar">
            <p>{calculationType === "UNCERTAINTY" ? "Saved uncertainty results, inputs, and source revisions." : "Saved results, inputs, and source revisions for this workbook."}</p>
            <button type="button" className="posnav__btn posnav__btn--sm" disabled={loading} onClick={() => void load()}>Refresh history</button>
          </div>
          {loading && <p role="status" className="analysis-history__state">Loading saved runs…</p>}
          {error && <p role="alert" className="analysis-history__state analysis-history__state--error">{error}</p>}
          {!loading && !error && rows.length === 0 && <p className="analysis-history__state">No accessible runs on this page.</p>}
          <div className="analysis-history__list">
            {rows.map((row) => (
              <button
                type="button"
                key={row.run.id}
                className={details?.run.id === row.run.id ? "is-selected" : ""}
                aria-pressed={details?.run.id === row.run.id}
                onClick={() => void inspect(row.run.id)}
              >
                <span className="analysis-history__run-name">{row.run.methodType.replace(/_/g, " ")}{row.run.scope === "BATCH" ? " batch" : ""}</span>
                <span className={`analysis-history__status analysis-history__status--${row.run.status.toLowerCase()}`}>{row.run.status}</span>
                <time>{new Date(row.run.requestedAt).toLocaleString()}</time>
                <span className="analysis-history__freshness">{row.run.freshness?.status ?? "UNKNOWN"}</span>
              </button>
            ))}
          </div>
          {cursor && (
            <button type="button" className="posnav__btn posnav__btn--sm analysis-history__older" disabled={loading} onClick={() => void load(cursor)}>Older runs</button>
          )}
          {details && (
            <section aria-label="Saved run details">
              <div className="analysis-history__result-head"><div><span>Selected run</span><h3>Result</h3></div><span className="analysis-history__status">{details.run.status}</span></div>
              {details.run.freshness?.status !== "CURRENT" && (
                <p role="status" className="analysis-history__state">Historical result: sources have changed, are missing, or could not be compared.</p>
              )}
              <p className="analysis-history__byline">Requested by {details.run.requestedBy} · {new Date(details.run.requestedAt).toLocaleString()}</p>
              <ul className="analysis-history__sources">
                {details.run.freshness?.sources.map((source) => (
                  <li key={source.workbookId}>
                    {source.workbookId}: saved revision {source.savedRevision},{" "}
                    {source.status === "MISSING" ? "source missing" : `current revision ${source.currentRevision}`}
                  </li>
                ))}
              </ul>
              <SavedAnalysisResult details={details} />
              <details className="analysis-history__record">
                <summary>Run identity and recorded inputs</summary>
                <p>Run: {details.run.id}</p>
                <p>
                  Native build:{" "}
                  {details.run.engine?.version.startsWith("sha256:") ?
                    details.run.engine.version
                  : "Not recorded for this historical run"}
                </p>
                {details.nativeRequest === null && (
                  <p>The exact native request was not recorded for this historical run.</p>
                )}
                <p>
                  The download includes original workbook snapshots, evidence, settings, returned results and any batch
                  members.
                </p>
                {details.contributions?.map((source) => (
                  <details key={source.workbook.workbookId}>
                    <summary>
                      {source.hostType} · {source.workbook.workbookId} · revision {source.workbook.workbookRevision}
                    </summary>
                    <ul>
                      {source.models.map((model) => (
                        <li key={model.modelId}>Model: {model.modelId}</li>
                      ))}
                      {source.entities.map((entity) => (
                        <li key={JSON.stringify(entity)}>
                          {entity.referenceType}: {entity.entityId}
                          {entity.referenceType === "HUMAN_FAILURE_EVENT" ? ` / HEP ${entity.quantificationId}` : ""}
                        </li>
                      ))}
                    </ul>
                  </details>
                ))}
                <button type="button" className="posnav__btn posnav__btn--sm" onClick={() => downloadSavedRun(details)}>Download saved run</button>
              </details>
            </section>
          )}
        </div>
      )}
    </section>
  );
}
