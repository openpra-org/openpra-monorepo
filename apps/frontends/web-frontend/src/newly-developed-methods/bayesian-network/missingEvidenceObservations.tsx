import type { BayesianNetworkEvidenceConfiguration } from "interfaces-mef-types/modeling";
import type { BayesianNetworkModel } from "interfaces-shared-types/newly-developed-methods/bayesian-network";

function MissingEvidenceObservations({ model, evidence, editable, onChange }: {
  model: BayesianNetworkModel;
  evidence: BayesianNetworkEvidenceConfiguration;
  editable: boolean;
  onChange: (evidence: BayesianNetworkEvidenceConfiguration) => void;
}): JSX.Element | null {
  const missing = evidence.observations.filter((observation) =>
    !model.nodes.some((node) => node.id === observation.nodeId
      && node.states.some((state) => state.id === observation.stateId)),
  );
  if (missing.length === 0) return null;
  return <div role="alert">
    <p>Evidence references deleted nodes or states. Undo the edit or remove these observations.</p>
    {missing.map((observation, index) => <p key={`${observation.nodeId}:${index}`}>
      {model.nodes.find((node) => node.id === observation.nodeId)?.code ?? observation.nodeId}: {observation.stateId}{" "}
      {editable && <button type="button" onClick={() => onChange({
        observations: evidence.observations.filter((candidate) => candidate !== observation),
      })}>Remove observation</button>}
    </p>)}
  </div>;
}

export { MissingEvidenceObservations };
