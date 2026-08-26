import { type JSX } from "react";
import type {
  AnalysisRunProvenance,
  WorkbookCrossReference,
} from "interfaces-shared-types/newly-developed-methods";
import { WorkbookSectionHeading } from "../workbooks/workbookSectionHeading";
import { ESQIcon } from "./esqIcons";

interface EsqAnalysisRunProvenanceProps {
  runs: AnalysisRunProvenance[];
  loading: boolean;
  error: string | null;
}

function targetLabel(run: AnalysisRunProvenance): string {
  if (run.target.targetType === "BAYESIAN_NETWORK_QUERY") return "Exact BN query";
  if (run.target.targetType === "HCL_FAULT_TREE") return "HCL fault-tree quantification";
  return "HCL event-tree quantification";
}

function targetReference(run: AnalysisRunProvenance): string {
  if (run.target.targetType === "BAYESIAN_NETWORK_QUERY") {
    return `${run.target.model.modelId} · ${run.target.queryNodeIds.length} query node${run.target.queryNodeIds.length === 1 ? "" : "s"}`;
  }
  if (run.target.targetType === "HCL_FAULT_TREE") {
    return `${run.target.faultTreeTopEvent.modelId} / ${run.target.faultTreeTopEvent.entityId}`;
  }
  return run.target.eventTree.modelId;
}

function entityDetail(reference: WorkbookCrossReference): string {
  const quantification = reference.referenceType === "HUMAN_FAILURE_EVENT"
    ? ` / HEP ${reference.quantificationId}`
    : "";
  return `${reference.referenceType} · ${"modelId" in reference ? `${reference.modelId} / ` : ""}${reference.entityId}${quantification}`;
}

function EsqAnalysisRunProvenance({
  runs,
  loading,
  error,
}: EsqAnalysisRunProvenanceProps): JSX.Element {
  return (
    <section className="poscard esqrun" aria-label="Immutable analysis runs">
      <div className="poscard__head esqrun__head">
        <div>
          <div className="esqrun__eyebrow"><ESQIcon.Lock /> Revision-pinned provenance</div>
          <WorkbookSectionHeading workbook="ESQ" title="Immutable analysis runs" level={3} />
          <p className="poscard__sub">Exact targets, source revisions, models, and entity references used by PRAXIS.</p>
        </div>
        {!loading && error === null && (
          <span className="esqrun__count">{runs.length} run{runs.length === 1 ? "" : "s"}</span>
        )}
      </div>
      {loading && <p className="pws-status">Loading run provenance…</p>}
      {error !== null && <p className="pws-status pws-status--error">{error}</p>}
      {!loading && error === null && runs.length === 0 && (
        <div className="esqrun__empty">Run exact inference or HCL quantification to create an immutable record.</div>
      )}
      {!loading && error === null && runs.length > 0 && (
        <div className="esqrun__list">
          {runs.map((provenance, index) => (
            <details className="esqrun__item" key={provenance.run.id} open={index === 0}>
              <summary className="esqrun__summary">
                <span className={`esqrun__status esqrun__status--${provenance.run.status.toLowerCase()}`}>
                  {provenance.run.status}
                </span>
                <span className="esqrun__summary-main">
                  <strong>{targetLabel(provenance)}</strong>
                  <span>{targetReference(provenance)}</span>
                </span>
                <span className="esqrun__time">
                  {new Date(provenance.run.completedAt ?? provenance.run.requestedAt).toLocaleString()}
                </span>
              </summary>
              <div className="esqrun__body">
                <div className="esqrun__identity">
                  <span>Run</span>
                  <code>{provenance.run.id}</code>
                  <span>Owner snapshot</span>
                  <code>{provenance.run.owner.workbookId} / {provenance.run.owner.modelId} / revision {provenance.run.owner.workbookRevision}</code>
                </div>
                <div className="esqrun__sources">
                  {provenance.contributions.map((contribution) => (
                    <div className="esqrun__source" key={contribution.workbook.workbookId}>
                      <div className="esqrun__source-head">
                        <span className="esqrun__host">{contribution.hostType}</span>
                        <code>{contribution.workbook.workbookId}</code>
                        <span className="esqrun__revision">revision {contribution.workbook.workbookRevision}</span>
                      </div>
                      {(contribution.models.length > 0 || contribution.entities.length > 0) && (
                        <details className="esqrun__source-detail">
                          <summary>
                            {contribution.models.length} model{contribution.models.length === 1 ? "" : "s"}
                            {" · "}
                            {contribution.entities.length} entit{contribution.entities.length === 1 ? "y" : "ies"}
                          </summary>
                          {contribution.models.length > 0 && (
                            <div className="esqrun__references">
                              <span>Models</span>
                              {contribution.models.map((model) => <code key={model.modelId}>{model.modelId}</code>)}
                            </div>
                          )}
                          {contribution.entities.length > 0 && (
                            <div className="esqrun__references">
                              <span>Entities</span>
                              {contribution.entities.map((entity) => (
                                <code key={JSON.stringify(entity)}>{entityDetail(entity)}</code>
                              ))}
                            </div>
                          )}
                        </details>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </details>
          ))}
        </div>
      )}
    </section>
  );
}

export { EsqAnalysisRunProvenance, type EsqAnalysisRunProvenanceProps };
