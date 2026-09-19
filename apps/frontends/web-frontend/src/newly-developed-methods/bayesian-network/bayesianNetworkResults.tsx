import type {
  BayesianNetworkAnalysisResult,
  BayesianNetworkModel,
} from "interfaces-shared-types/newly-developed-methods/bayesian-network";
import type { BayesianNetworkQueryBatchResult } from "./bayesianNetworkTypes";
import { PagedResults, ResultCsvButton, ResultNumber, ResultWarnings } from "../shared/resultPresentation";
import { runCsvContext } from "../shared/probabilityResultExport";
import type { ResultCsvRecord } from "../shared/resultCsv";

export function bayesianResultRecords(
  result: BayesianNetworkAnalysisResult,
  model: BayesianNetworkModel,
): ResultCsvRecord[] {
  const nodes = new Map(model.nodes.map((node) => [node.id, node]));
  return result.marginals.flatMap((marginal) => {
    const node = nodes.get(marginal.nodeId);
    return marginal.values.map((value) => {
      const state = node?.states.find((candidate) => candidate.id === value.stateId);
      return {
        ...runCsvContext(result),
        result_type: "BAYESIAN_NETWORK",
        evidence: JSON.stringify(result.evidence),
        node_id: marginal.nodeId,
        node_code: node?.code,
        node_name: node?.name,
        state_id: value.stateId,
        state_code: state?.code,
        state_name: state?.name,
        probability: value.probability,
      };
    });
  });
}

export function bayesianBatchResultRecords(
  batch: BayesianNetworkQueryBatchResult,
  model: BayesianNetworkModel,
): ResultCsvRecord[] {
  return batch.scenarios.flatMap((scenario): ResultCsvRecord[] => {
    const identity = {
      scenario_id: scenario.scenarioId,
      scenario_code: scenario.scenarioCode,
      scenario_name: scenario.scenarioName,
      status: scenario.status,
      failure: scenario.failure,
    };
    return scenario.result === null ?
        [identity]
      : bayesianResultRecords(scenario.result, model).map((row) => ({ ...row, ...identity }));
  });
}

function Marginals({ result, model }: { result: BayesianNetworkAnalysisResult; model: BayesianNetworkModel }) {
  const nodes = new Map(model.nodes.map((node) => [node.id, node]));
  const rows = result.marginals.flatMap((marginal) =>
    marginal.values.map((value) => ({ nodeId: marginal.nodeId, ...value })),
  );
  return (
    <>
      <p className="analysis-results__identity">
        Run {result.runId} · revision {result.owner.workbookRevision}
      </p>
      <PagedResults
        items={rows}
        label="BN states"
        resetKey={result.runId}
      >
        {(page) => (
          <div className="bneditor__posterior">
            {page.map((value) => {
              const node = nodes.get(value.nodeId);
              const state = node?.states.find((candidate) => candidate.id === value.stateId);
              return (
                <div
                  key={`${value.nodeId}:${value.stateId}`}
                  className="bneditor__posterior-state"
                >
                  <span title={`Node ${value.nodeId}; state ${value.stateId}`}>
                    {node?.code ?? value.nodeId} / {state?.code ?? value.stateId}
                  </span>
                  <ResultNumber value={value.probability} />
                  <i aria-hidden="true">
                    <b style={{ width: `${String(Math.max(0, Math.min(1, value.probability)) * 100)}%` }} />
                  </i>
                </div>
              );
            })}
          </div>
        )}
      </PagedResults>
      <ResultWarnings issues={result.validationIssues} />
    </>
  );
}

export function BayesianNetworkResults({
  result,
  model,
}: {
  result: BayesianNetworkAnalysisResult;
  model: BayesianNetworkModel;
}) {
  return (
    <div aria-label="Posterior distribution">
      <div className="analysis-results__toolbar">
        <strong>Posterior probability</strong>
        <ResultCsvButton
          filename={`bn-${result.runId}.csv`}
          records={() => bayesianResultRecords(result, model)}
        />
      </div>
      <Marginals
        result={result}
        model={model}
      />
    </div>
  );
}

export function BayesianNetworkBatchResults({
  batch,
  model,
}: {
  batch: BayesianNetworkQueryBatchResult;
  model: BayesianNetworkModel;
}) {
  const key = JSON.stringify(batch.scenarios.map((scenario) => [scenario.scenarioId, scenario.result?.runId]));
  return (
    <div
      className="bneditor__query-batch-results"
      aria-label="BN query batch results"
    >
      <div className="analysis-results__toolbar">
        <strong>Scenario posterior probabilities</strong>
        <ResultCsvButton
          filename={`bn-${model.modelId}-batch.csv`}
          records={() => bayesianBatchResultRecords(batch, model)}
        />
      </div>
      <PagedResults
        items={batch.scenarios}
        label="BN scenarios"
        resetKey={key}
      >
        {(page) =>
          page.map((scenario) => (
            <details
              key={scenario.scenarioId}
              className="bneditor__query-batch-row"
            >
              <summary>
                <strong>{scenario.scenarioCode}</strong>
                <span>{scenario.scenarioName}</span>
                <span>{scenario.status === "SUCCEEDED" ? "Complete" : "Failed"}</span>
              </summary>
              {scenario.failure !== null && <p className="bneditor__error">{scenario.failure}</p>}
              {scenario.result !== null && (
                <Marginals
                  result={scenario.result}
                  model={model}
                />
              )}
            </details>
          ))
        }
      </PagedResults>
    </div>
  );
}
