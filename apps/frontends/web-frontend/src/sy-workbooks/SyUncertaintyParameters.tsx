import { useEffect, useMemo, useState, type JSX } from "react";
import { WorkbookSectionHeading } from "../workbooks/workbookSectionHeading";
import { SYProvenanceChip } from "./syShared";
import { useSyWorkbook } from "./syWorkbookContext";
import { analysisModelBasicEvents, linkedModelInputs } from "./syUncertainty";
import { isSystemLevelModel } from "./sySelectors";
import "./css/syUncertainty.css";

function SyUncertaintyParameters({ selectedModelId }: { selectedModelId?: string } = {}): JSX.Element {
  const { sy, controlledParameters, shortOf } = useSyWorkbook();
  const models = useMemo(() => sy.systemLogicModels.filter((model) =>
    model.topGate !== null && !isSystemLevelModel(model)), [sy.systemLogicModels]);
  const [modelId, setModelId] = useState(models[0]?.uuid ?? "");
  useEffect(() => {
    if (!models.some((model) => model.uuid === modelId)) setModelId(models[0]?.uuid ?? "");
  }, [modelId, models]);
  const model = models.find((candidate) => candidate.uuid === (selectedModelId ?? modelId));
  const events = model === undefined ? [] : analysisModelBasicEvents(sy, model);
  const linked = events.filter((event) => event.controlledDataSource?.referenceType === "WORKBOOK_PARAMETER");
  const inputs = model === undefined ? [] : linkedModelInputs(sy, model, controlledParameters);

  return <section className="poscard syunc-parameters" aria-label="Linked DA uncertainty inputs">
    <div className="poscard__head">
      <WorkbookSectionHeading workbook="SY" title="Linked DA inputs" level={3} />
      <SYProvenanceChip>SY-A32 · DA</SYProvenanceChip>
    </div>
    {(sy.uncertaintyAnalyses ?? []).some((analysis) => analysis.parameterUncertainties.length > 0) &&
      <p className="syft-analysis__notice" role="status">Older distributions stored in SY remain available in the workbook data, but runs now use the linked DA distributions.</p>}
    {selectedModelId === undefined && models.length > 0 && <label className="posfield" style={{ maxWidth: 440 }}><span className="posfield__label">Fault tree</span>
      <select className="posfield__select" aria-label="Linked input fault tree" value={modelId} onChange={(event) => setModelId(event.target.value)}>
        {models.map((candidate) => <option key={candidate.uuid} value={candidate.uuid}>{shortOf(candidate.systemReference)} · {candidate.code} · {candidate.name}</option>)}
      </select>
    </label>}
    <div className="sy-review">
      {model === undefined ? <p className="sy-review-empty">Create a detailed fault tree in Step 02 first.</p> : inputs.length === 0 ?
        <p className="sy-review-empty">No linked basic event in this fault tree has a DA uncertainty distribution. {linked.length} basic event{linked.length === 1 ? " is" : "s are"} linked to DA.</p> :
        <table className="sy-review-table" aria-label="Linked DA inputs">
          <thead><tr><th scope="col">Basic event</th><th scope="col">DA parameter</th><th scope="col">Distribution</th><th scope="col">Sampling</th></tr></thead>
          <tbody>{inputs.map(({ event, source, distribution, issues }) => <tr key={event.uuid}>
            <td><span className="sy-review-name posmono">{event.code ?? event.uuid}</span><span className="sy-review-sub">{event.name}</span></td>
            <td><span>{source.parameterName}</span><span className="sy-review-sub">{source.workbookName}</span></td>
            <td>{distribution.type}</td>
            <td>{issues.length === 0 ? "Ready" : <span className="sy-error">{issues.join(" ")}</span>}</td>
          </tr>)}</tbody>
        </table>}
    </div>
  </section>;
}

export { SyUncertaintyParameters };
