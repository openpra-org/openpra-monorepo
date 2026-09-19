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
import type { HclEditorRunResult, HclEventTreeOption } from "../hybrid-causal-logic/hclBindingTypes";
import { fetchJson } from "../../api/client";
import { ResultNumber, ResultWarnings } from "./resultPresentation";
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
      <>
        <p>
          Top-event probability: <ResultNumber value={result.topEventProbability} />
        </p>
        <ResultWarnings issues={result.validationIssues} />
      </>
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
}: {
  host: AnalysisRunChanged["host"];
  workbookId: string | null;
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
      const refreshed =
        selected.current === null ?
          null
        : AnalysisRunDetailsSchema.parse(await fetchJson<unknown>(`${base}/${selected.current}/details`));
      if (current !== request.current) return;
      setRows(response.runs);
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
  }, [host, workbookId]);
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
  }, [open, host, workbookId]);
  if (workbookId === null) return null;
  return (
    <details
      className="poscard analysis-history"
      open={open}
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary>Saved analysis runs</summary>
      {open && (
        <>
          <p>Original results and inputs are preserved. Source status reflects the latest access and revision check.</p>
          <button
            type="button"
            disabled={loading}
            onClick={() => void load()}
          >
            Refresh history
          </button>
          {loading && <p role="status">Loading saved runs…</p>}
          {error && <p role="alert">{error}</p>}
          {!loading && !error && rows.length === 0 && <p>No accessible runs on this page.</p>}
          <div className="analysis-history__list">
            {rows.map((row) => (
              <button
                type="button"
                key={row.run.id}
                onClick={() => void inspect(row.run.id)}
              >
                <span>
                  {row.run.methodType.replace(/_/g, " ")}
                  {row.run.scope === "BATCH" ? " batch" : ""}
                </span>
                <span>
                  {row.run.status} · {row.run.freshness?.status ?? "UNKNOWN"}
                </span>
                <time>{new Date(row.run.requestedAt).toLocaleString()}</time>
                <small>{row.run.id}</small>
              </button>
            ))}
          </div>
          {cursor && (
            <button
              type="button"
              disabled={loading}
              onClick={() => void load(cursor)}
            >
              Older runs
            </button>
          )}
          {details && (
            <section aria-label="Saved run details">
              <h3>Saved result</h3>
              {details.run.freshness?.status !== "CURRENT" && (
                <p role="status">Historical result: sources have changed, are missing, or could not be compared.</p>
              )}
              <p>
                Requested by {details.run.requestedBy} · {details.run.status}
              </p>
              <ul>
                {details.run.freshness?.sources.map((source) => (
                  <li key={source.workbookId}>
                    {source.workbookId}: saved revision {source.savedRevision},{" "}
                    {source.status === "MISSING" ? "source missing" : `current revision ${source.currentRevision}`}
                  </li>
                ))}
              </ul>
              <SavedAnalysisResult details={details} />
              <details>
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
                <button
                  type="button"
                  onClick={() => downloadSavedRun(details)}
                >
                  Download saved run
                </button>
              </details>
            </section>
          )}
        </>
      )}
    </details>
  );
}
