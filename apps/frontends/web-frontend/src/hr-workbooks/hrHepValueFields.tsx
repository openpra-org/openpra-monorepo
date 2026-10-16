import { JSX } from "react";
import type { UncertainExpression } from "interfaces-mef-types/core/uncertainty";
import type { HepQuantification } from "interfaces-mef-types/hr/human-reliability-analysis";
import { ExpressionEditor } from "../newly-developed-methods/shared/uncertainEditor";
import { expressionText } from "../newly-developed-methods/shared/uncertainText";
import { useHrWorkbook } from "./hrWorkbookContext";
import { hepParameterOptions, hepReference, linkedDaHep } from "./hrDaLinks";

const START_HEP: UncertainExpression = { node: "VALUE", value: { unit: "PROBABILITY", law: { family: "POINT", value: 1e-3 } } };

function HrHepValueFields({ quantification }: { quantification: HepQuantification }): JSX.Element {
  const { editable, mutateHr, daHeps } = useHrWorkbook();
  const options = daHeps ?? [];
  const linked = linkedDaHep(quantification, options);
  const reference = hepReference(quantification);

  function change(hep: UncertainExpression): void {
    if (!editable) return;
    mutateHr((draft) => ({ ...draft, hepQuantifications: draft.hepQuantifications.map((candidate) => (candidate.uuid === quantification.uuid ? { ...candidate, hep } : candidate)) }));
  }

  return (
    <div className="posfield posfield-grid--span2"><label className="posfield__label">HEP</label>
      {quantification.hep === undefined && <p className="posmuted">No HEP yet. Type a law or link a DA value.</p>}
      <ExpressionEditor expression={quantification.hep ?? START_HEP} unit="PROBABILITY" options={hepParameterOptions(options)} disabled={!editable} onChange={change} />
      {linked !== undefined && <p className="posmuted" role="status">DA gives {expressionText(linked.law)}. Runs read it from DA.</p>}
      {reference !== undefined && linked === undefined && <p className="posmuted" role="status">The linked DA value is not available here. Runs still read it from DA.</p>}
    </div>
  );
}

export { HrHepValueFields };
