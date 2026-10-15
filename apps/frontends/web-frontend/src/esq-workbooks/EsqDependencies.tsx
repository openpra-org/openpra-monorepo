import { JSX, useId, useMemo, useRef, useState, type ChangeEvent } from "react";
import type { EsqModel } from "interfaces-mef-types/esq/event-sequence-quantification";
import { esqSequenceRunId, esqTreeRunId } from "interfaces-mef-types/esq/esq-run-inputs";
import { DEFAULT_ANNUALIZATION_CONVENTION, type WorkbookBayesianNetwork, type WorkbookHclConfiguration } from "interfaces-mef-types/modeling";
import { HclUncertaintySettingsSchema } from "interfaces-mef-types/zod/modeling";
import { validateBayesianNetworkModel } from "interfaces-shared-types/newly-developed-methods/bayesian-network";
import type { HclBatchInput, HclCalculationType, HclEvidenceScenario, HclHazardSweepSpec } from "interfaces-shared-types/newly-developed-methods/hybrid-causal-logic";
import { BayesianNetworkEditor } from "../newly-developed-methods/bayesian-network";
import type { HclEditorBatchRunResult, HclEditorRunResult, HclEventTreeOption } from "../newly-developed-methods/hybrid-causal-logic";
import { createEvidenceBatchSamples, downloadText } from "../newly-developed-methods/hybrid-causal-logic/hclBindingEditor";
import { HclEvidenceScenarioEditor } from "../newly-developed-methods/hybrid-causal-logic/hclEvidenceScenarioEditor";
import {
  exportHclEvidenceScenariosCsv,
  exportHclEvidenceScenariosJson,
  importHclEvidenceScenariosCsv,
  importHclEvidenceScenariosJson,
} from "../newly-developed-methods/hybrid-causal-logic/hclEvidenceScenarioInterchange";
import { HclHazardSweepControls } from "../newly-developed-methods/hybrid-causal-logic/hclHazardSweepControls";
import { HclResults } from "../newly-developed-methods/hybrid-causal-logic/hclResults";
import { HclSamplingControls } from "../newly-developed-methods/hybrid-causal-logic/hclSamplingControls";
import { treeLabel, type NetworkOption } from "./esqShared";
import { useEsqWorkbook } from "./esqWorkbookContext";
import { generateEsqHclScenarios, getEsqHclEventTreeResult, runEsqHclEventTree, runEsqHclEventTreeBatch } from "./esqWorkbookApi";
import { exampleLinkLabel } from "./esqViewData";
import "./css/esqSolveTabs.css";

type DependencyEvidence = "BASE" | "SCENARIOS" | "HAZARD";

interface DependencyStudyTree {
  treeId: string;
  runResult: HclEditorRunResult | null;
  batchRunResult: HclEditorBatchRunResult | null;
  failure: string | null;
}

interface DependencyStudy {
  result: HclCalculationType;
  evidence: DependencyEvidence;
  trees: DependencyStudyTree[];
}

interface DependencyStudyInput {
  workbookId: string;
  revision: number;
  option: NetworkOption;
  treeId: string;
  result: HclCalculationType;
  evidence: DependencyEvidence;
  scenarioIds: string[];
  batchInput: HclBatchInput | null;
}

interface DependencyPanelProps {
  option: NetworkOption;
  evidence: DependencyEvidence;
  result: HclCalculationType;
  batchInput: HclBatchInput | null;
  study: DependencyStudy | null;
  running: boolean;
  onBatchInput: (input: HclBatchInput | null) => void;
}

const NO_REASON = "The run did not finish and gave no reason.";

function withoutGrid(configuration: WorkbookHclConfiguration): WorkbookHclConfiguration {
  const { hazardGrid: _saved, ...rest } = configuration;
  return rest;
}

function studyConfiguration(configuration: WorkbookHclConfiguration, batchInput: HclBatchInput | null): WorkbookHclConfiguration {
  return batchInput === null ? configuration : { ...withoutGrid(configuration), ...batchInput };
}

function eventTreeOptionsOf(model: EsqModel, workbookId: string, workbookName: string): HclEventTreeOption[] {
  return model.trees.map((tree) => ({
    workbookId,
    workbookName,
    modelId: esqTreeRunId(tree.id),
    modelCode: tree.code,
    modelName: tree.name,
    sequences: model.sequences.filter((sequence) => sequence.treeId === tree.id).map((sequence) => ({
      id: esqSequenceRunId(tree.id, sequence.id),
      name: sequence.code,
      modelId: esqTreeRunId(tree.id),
      modelName: tree.code,
    })),
    faultTrees: [],
  }));
}

async function studyTree(input: DependencyStudyInput): Promise<DependencyStudyTree> {
  const configurationId = input.option.configuration.modelId;
  const dependencyConfiguration = { workbookId: input.option.workbookId, modelId: configurationId };
  const eventTree = { workbookId: input.workbookId, modelId: input.treeId };
  if (input.evidence === "BASE") {
    const execution = await runEsqHclEventTree(input.workbookId, configurationId, input.revision, eventTree, input.result, dependencyConfiguration);
    if (execution.run.status !== "SUCCEEDED") return { treeId: input.treeId, runResult: null, batchRunResult: null, failure: execution.run.failure?.message ?? NO_REASON };
    const result = await getEsqHclEventTreeResult(input.workbookId, configurationId, execution.run.id);
    return { treeId: input.treeId, runResult: { kind: "EVENT_TREE", result }, batchRunResult: null, failure: null };
  }
  const execution = await runEsqHclEventTreeBatch(
    input.workbookId,
    configurationId,
    input.revision,
    eventTree,
    input.result,
    input.scenarioIds,
    input.evidence === "HAZARD",
    dependencyConfiguration,
    input.batchInput ?? undefined,
  );
  const scenarios = await Promise.all(execution.runs.map(async (row) => ({
    scenarioId: row.scenarioId,
    scenarioCode: row.scenarioCode,
    scenarioName: row.scenarioName,
    status: row.run.status,
    failure: row.run.failure?.message ?? null,
    result: row.run.status === "SUCCEEDED" ? { kind: "EVENT_TREE" as const, result: await getEsqHclEventTreeResult(input.workbookId, configurationId, row.run.id) } : null,
  })));
  const batchRunResult: HclEditorBatchRunResult = {
    kind: "EVENT_TREE",
    scenarios,
    ...(execution.hazardConvolution === undefined ? {} : { hazardConvolution: execution.hazardConvolution }),
    ...(execution.compilationReuse === undefined ? {} : { compilationReuse: execution.compilationReuse }),
  };
  return { treeId: input.treeId, runResult: null, batchRunResult, failure: null };
}

function DependencyPanel({ option, evidence, result, batchInput, study, running, onBatchInput, network }: DependencyPanelProps & { network: WorkbookBayesianNetwork }): JSX.Element {
  const { esq, upstream, runtime, editable } = useEsqWorkbook();
  const fieldId = useId();
  const uploadRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [treeId, setTreeId] = useState("");
  const configuration = option.configuration;
  const model = esq.model;
  const eventTreeOptions = useMemo(() => (model === undefined ? [] : eventTreeOptionsOf(model, runtime.workbookId ?? "", esq.name)), [model, runtime.workbookId, esq.name]);
  const validation = useMemo(() => validateBayesianNetworkModel(network, {
    evidence: configuration.baseEvidence,
    hclBindings: configuration.bindings,
    workbookId: option.workbookId,
  }), [network, configuration, option.workbookId]);
  const shownConfiguration = studyConfiguration(configuration, batchInput);
  const uncertainty = HclUncertaintySettingsSchema.safeParse(configuration.solverSettings.uncertainty);
  const shown = study?.trees.find((entry) => entry.treeId === treeId) ?? study?.trees[0];
  const workbookName = upstream.options[option.owner].find((workbook) => workbook.id === option.workbookId)?.name ?? exampleLinkLabel(option.workbookId) ?? `the linked ${option.owner} workbook`;
  const sourceHref = option.owner === "SY"
    ? `/sy-workbooks/${encodeURIComponent(option.workbookId)}?step=deps&network=${encodeURIComponent(network.modelId)}&esqWorkbook=${encodeURIComponent(runtime.workbookId ?? "")}`
    : `/es-workbooks/${encodeURIComponent(option.workbookId)}`;

  async function upload(event: ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file === undefined) return;
    try {
      const text = await file.text();
      const rows = file.name.toLowerCase().endsWith(".csv") ? importHclEvidenceScenariosCsv(text, network) : importHclEvidenceScenariosJson(text, network);
      onBatchInput({ evidenceScenarios: rows, ...(shownConfiguration.hazardGrid === undefined ? {} : { hazardGrid: shownConfiguration.hazardGrid }) });
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The evidence scenarios could not be read.");
    }
  }

  function sample(format: "JSON" | "CSV"): void {
    const rows = createEvidenceBatchSamples(network);
    if (rows.length === 0) {
      setError("The network has no node with a state to put in a sample.");
      return;
    }
    const filename = `${network.code.trim().length > 0 ? network.code : "dependency-network"}-evidence-sample.${format.toLowerCase()}`;
    if (format === "JSON") downloadText(filename, exportHclEvidenceScenariosJson(rows, network), "application/json");
    else downloadText(filename, exportHclEvidenceScenariosCsv(rows, network), "text/csv");
    setError(null);
  }

  function generate(spec: HclHazardSweepSpec): Promise<HclEvidenceScenario[]> {
    const workbookId = runtime.workbookId;
    const revision = runtime.revision;
    if (workbookId === null || revision === null) return Promise.reject(new Error("Save the workbook first."));
    return generateEsqHclScenarios(workbookId, configuration.modelId, revision, spec, { workbookId: option.workbookId, modelId: configuration.modelId })
      .then((response) => response.scenarios);
  }

  function generated(rows: HclEvidenceScenario[], spec: HclHazardSweepSpec): void {
    const [first, ...rest] = spec.dimensions.map((dimension) => dimension.bnNode);
    if (first === undefined) return;
    onBatchInput({
      evidenceScenarios: rows,
      hazardGrid: {
        name: `${configuration.code} hazard grid`,
        annualFrequencyScale: { value: 1, unit: "PER_YEAR", annualization: { ...DEFAULT_ANNUALIZATION_CONVENTION } },
        normalizeWeights: false,
        ...shownConfiguration.hazardGrid,
        hazardNodeIds: [first, ...rest],
      },
    });
  }

  return (
    <div className="esq-dependency" role="region" aria-label="Dependencies">
      <BayesianNetworkEditor
        model={network}
        editable={false}
        readOnlyNotice={{ message: `This network belongs to ${workbookName}. Edit it in that workbook's Dependencies step.`, sourceHref, sourceLabel: `Open ${workbookName}` }}
        showAnalysis={false}
        showQueryAnalysis={false}
        hclScope="EVENT_TREE"
        analysisHost="esq"
        evidence={configuration.baseEvidence}
        queryNodeId={network.nodes[0]?.id ?? null}
        validation={validation}
        analysisResult={null}
        running={false}
        runError={null}
        workbookId={option.workbookId}
        hclConfigurations={[configuration]}
        faultTreeOptions={[]}
        eventTreeOptions={[]}
        hclRunning={false}
        hclRunError={null}
        hclRunResult={null}
        hclBatchRunResult={null}
        onModelChange={() => undefined}
        onEvidenceChange={() => undefined}
        onQueryNodeChange={() => undefined}
        onHclConfigurationsChange={() => undefined}
        onRunHclFaultTree={() => undefined}
        onRunHclEventTree={() => undefined}
        onRunHclFaultTreeBatch={() => undefined}
        onRunHclEventTreeBatch={() => undefined}
        onRun={() => undefined}
      />
      {evidence !== "BASE" && (
        <div className="esq-dependency__evidence">
          <div className="esq-dependency__tools">
            <input ref={uploadRef} hidden type="file" accept=".json,.csv,application/json,text/csv" aria-label="Upload evidence scenarios" onChange={(event) => { void upload(event); }} />
            <button type="button" className="posnav__btn posnav__btn--sm" disabled={running} onClick={() => uploadRef.current?.click()}>Upload JSON/CSV</button>
            <button type="button" className="posnav__btn posnav__btn--sm" onClick={() => sample("JSON")}>Sample JSON</button>
            <button type="button" className="posnav__btn posnav__btn--sm" onClick={() => sample("CSV")}>Sample CSV</button>
            {batchInput !== null && <button type="button" className="posnav__btn posnav__btn--sm" disabled={running} onClick={() => onBatchInput(null)}>Use saved scenarios</button>}
          </div>
          <HclHazardSweepControls key={option.key} model={network} disabled={!editable || running} onGenerate={generate} onGenerated={generated} onError={setError} />
          <HclEvidenceScenarioEditor model={network} configuration={shownConfiguration} editable={false} showHazardConvolution={evidence === "HAZARD"} onChange={() => undefined} onError={setError} />
        </div>
      )}
      {result === "UNCERTAINTY" && uncertainty.success && (
        <HclSamplingControls settings={uncertainty.data} editable={false} onChange={() => undefined} onError={setError} onDisable={() => undefined} />
      )}
      {error !== null && <p className="es-scope-error" role="alert">{error}</p>}
      {study !== null && shown !== undefined && (
        <div className="esq-dependency__results">
          {study.trees.length > 1 && (
            <div className="es-records__bar">
              <div className="es-records__filters">
                <div className="es-records__filter">
                  <label className="posfield__label" htmlFor={`${fieldId}-tree`}>Event tree</label>
                  <select id={`${fieldId}-tree`} className="posfield__select" value={shown.treeId} onChange={(event) => setTreeId(event.target.value)}>
                    {study.trees.map((entry) => <option key={entry.treeId} value={entry.treeId}>{model === undefined ? entry.treeId : treeLabel(model, entry.treeId)}</option>)}
                  </select>
                </div>
              </div>
            </div>
          )}
          {shown.failure !== null ? <p className="es-scope-error" role="alert">{shown.failure}</p> : (
            <HclResults
              runResult={shown.runResult}
              batchRunResult={shown.batchRunResult}
              workflow={study.evidence === "BASE" ? "MANUAL" : "BATCH"}
              calculationType={study.result}
              eventTreeOptions={eventTreeOptions}
              faultTreeOptions={[]}
              analysisHost="esq"
            />
          )}
        </div>
      )}
    </div>
  );
}

function EsqDependencies(props: DependencyPanelProps): JSX.Element | null {
  const { upstream } = useEsqWorkbook();
  const configuration = props.option.configuration;
  const source = props.option.owner === "ES" ? upstream.es : upstream.sy;
  const network = configuration.bayesianNetwork.workbookId === props.option.workbookId
    ? (source?.dependencyBayesianNetworks ?? []).find((candidate) => candidate.modelId === configuration.bayesianNetwork.modelId)
    : undefined;
  if (network === undefined) return null;
  return <DependencyPanel {...props} network={network} />;
}

export { EsqDependencies, studyConfiguration, studyTree, type DependencyEvidence, type DependencyStudy, type DependencyStudyTree };
