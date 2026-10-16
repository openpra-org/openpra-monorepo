import { JSX } from "react";
import type { Law, UncertainExpression, UncertainValue } from "interfaces-mef-types/core/uncertainty";
import { LawEditor, draftFor, updatedFamily } from "../shared/uncertainEditor";
import { FREQUENCY_UNIT, valueExpression } from "./frequencySources";
import "./css/ieFrequencyQuantification.css";

function typedValue(expression: UncertainExpression): UncertainValue | undefined {
  if (expression.node !== "VALUE") return undefined;
  return updatedFamily(expression.value.law) ? undefined : expression.value;
}

function draftLaw(mean: number | undefined): Law {
  return draftFor("POINT", { family: "POINT", value: mean ?? Number.NaN }, FREQUENCY_UNIT);
}

function FrequencyLawField({ expression, mean, describe, editable, addLabel, onChange }: {
  expression: UncertainExpression | undefined;
  mean: number | undefined;
  describe: (expression: UncertainExpression) => string;
  editable: boolean;
  addLabel: string;
  onChange: (expression: UncertainExpression) => void;
}): JSX.Element {
  if (expression === undefined) {
    return (
      <div className="iefq-law">
        {editable
          ? <button type="button" className="posnav__btn posnav__btn--sm" onClick={() => onChange(valueExpression(draftLaw(undefined)))}>{addLabel}</button>
          : <span className="iefq-text">None</span>}
      </div>
    );
  }
  const typed = typedValue(expression);
  if (typed !== undefined) {
    return (
      <div className="iefq-law">
        <LawEditor law={typed.law} unit={typed.unit} disabled={!editable} onChange={(law) => onChange({ node: "VALUE", value: { unit: typed.unit, law } })} />
      </div>
    );
  }
  return (
    <div className="iefq-law">
      <span className="iefq-text">{describe(expression)}</span>
      {editable && <button type="button" className="posnav__btn posnav__btn--sm" onClick={() => onChange(valueExpression(draftLaw(mean)))}>Type a law instead</button>}
    </div>
  );
}

export { FrequencyLawField };
