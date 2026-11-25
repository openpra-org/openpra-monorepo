import type { BayesianNetworkEvidenceConfiguration } from "interfaces-mef-types/modeling";
import type { BayesianNetworkModel } from "interfaces-shared-types/newly-developed-methods/bayesian-network";

function MissingEvidenceObservations({ model, evidence, editable, onChange }: {
  model: BayesianNetworkModel;
  evidence: BayesianNetworkEvidenceConfiguration;
  editable: boolean;
  onChange: (evidence: BayesianNetworkEvidenceConfiguration) => void;
}): JSX.Element | null {
  const kept = evidence.observations.filter((observation) =>
    model.nodes.some((node) => node.id === observation.nodeId
      && node.states.some((state) => state.id === observation.stateId)),
  );
  const missing = evidence.observations.length - kept.length;
  if (missing === 0) return null;
  return (
    <div className="bneditor__evidence-missing" role="alert">
      <span>{`${String(missing)} evidence ${missing === 1 ? "entry points" : "entries point"} at a node or state that no longer exists.`}</span>
      {editable && <button type="button" className="posnav__btn posnav__btn--sm" onClick={() => onChange({ observations: kept })}>Remove</button>}
    </div>
  );
}

export { MissingEvidenceObservations };
