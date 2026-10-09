import { useState, type JSX } from "react";
import { expressionReferences, type UncertainExpression } from "interfaces-mef-types/core/uncertainty";
import type { HclBasicEventUncertainty, HclUncertaintySettings } from "interfaces-mef-types/modeling";
import { ExpressionEditor, draftFor } from "../shared/uncertainEditor";
import { expressionText } from "../shared/uncertainText";
import type { HclFaultTreeOption } from "./hclBindingTypes";

interface HclBasicEventChoice {
  key: string;
  tree: HclFaultTreeOption;
  event: HclFaultTreeOption["basicEvents"][number];
}

const OVERRIDE_MODELS = ["MISSION", "STANDBY"] as const;

function basicEventKey(workbookId: string, eventId: string): string {
  return `${workbookId}:${eventId}`;
}

function definitionKey(definition: HclBasicEventUncertainty): string {
  return basicEventKey(definition.faultTreeBasicEvent.workbookId, definition.faultTreeBasicEvent.entityId);
}

function typedCopy(expression: UncertainExpression | undefined): UncertainExpression | undefined {
  if (expression === undefined || expressionReferences(expression).length > 0) return undefined;
  if (expression.node === "VALUE" && expression.value.unit === "PROBABILITY") return expression;
  if (expression.node === "MODEL" && (expression.model.form === "MISSION" || expression.model.form === "STANDBY")) return expression;
  return undefined;
}

function overrideStart(choice: HclBasicEventChoice): UncertainExpression {
  return typedCopy(choice.event.syValue?.expression)
    ?? { node: "VALUE", value: { unit: "PROBABILITY", law: draftFor("POINT", { family: "UNIFORM", lower: 0, upper: 1 }, "PROBABILITY") } };
}

function SyValueLine({ choice }: { choice: HclBasicEventChoice }): JSX.Element {
  const value = choice.event.syValue;
  return (
    <li className="hcleditor__uncertainty-sy-value">
      <strong>{choice.tree.modelCode} / {choice.event.code}</strong>
      <span>{value === undefined ? "Takes its Systems Analysis value." : `Takes its Systems Analysis value, ${value.text}.`}</span>
      {value !== undefined && value.daLinks.length > 0 && <span>Linked to DA {value.daLinks.join(", ")}.</span>}
    </li>
  );
}

function HclBasicEventControls({ choices, settings, editable, onChange, onError }: {
  choices: readonly HclBasicEventChoice[];
  settings: HclUncertaintySettings;
  editable: boolean;
  onChange: (settings: HclUncertaintySettings) => void;
  onError: (message: string | null) => void;
}): JSX.Element {
  const [selectedKey, setSelectedKey] = useState("");
  const overridden = new Set(settings.basicEvents.map(definitionKey));
  const available = choices.filter((choice) => !overridden.has(choice.key));
  const selected = available.find((choice) => choice.key === selectedKey) ?? available[0];

  function add(): void {
    if (selected === undefined) {
      onError("No unbound basic event is left to override.");
      return;
    }
    onChange({
      ...settings,
      basicEvents: [...settings.basicEvents, {
        faultTreeBasicEvent: { referenceType: "FAULT_TREE_BASIC_EVENT", workbookId: selected.tree.workbookId, entityId: selected.event.id },
        expression: overrideStart(selected),
      }],
    });
    onError(null);
  }

  function update(index: number, expression: UncertainExpression): void {
    onChange({ ...settings, basicEvents: settings.basicEvents.map((definition, at) => (at === index ? { ...definition, expression } : definition)) });
  }

  function remove(index: number): void {
    onChange({ ...settings, basicEvents: settings.basicEvents.filter((_, at) => at !== index) });
  }

  function nameOf(definition: HclBasicEventUncertainty): string {
    const choice = choices.find((candidate) => candidate.key === definitionKey(definition));
    return choice === undefined ? definition.faultTreeBasicEvent.entityId : `${choice.tree.modelCode} / ${choice.event.code}`;
  }

  return (
    <section className="hcleditor__uncertainty-section" aria-label="Basic event uncertainty">
      <div className="hcleditor__uncertainty-section-head">
        <div><strong>Basic events</strong><span>An event without an override takes its Systems Analysis value.</span></div>
      </div>
      {editable && available.length > 0 && (
        <div className="hcleditor__uncertainty-add">
          <label><span>Basic event</span><select aria-label="Basic event to override" value={selected?.key ?? ""} onChange={(event) => setSelectedKey(event.target.value)}>
            {available.map((choice) => <option key={choice.key} value={choice.key}>{choice.tree.modelCode} / {choice.event.code}</option>)}
          </select></label>
          <button type="button" className="posnav__btn posnav__btn--sm" onClick={add}>Add override</button>
        </div>
      )}
      {settings.basicEvents.length > 0 && (
        <details className="hcleditor__uncertainty-collection">
          <summary>Overrides <span>{String(settings.basicEvents.length)}</span></summary>
          <div className="hcleditor__uncertainty-list">
            {settings.basicEvents.map((definition, index) => (
              <details key={definitionKey(definition)} className="hcleditor__uncertainty-item">
                <summary>
                  <span className="hcleditor__uncertainty-item-name"><small>FT / basic event</small><strong>{nameOf(definition)}</strong></span>
                  <span className="hcleditor__uncertainty-family">{expressionText(definition.expression)}</span>
                  <span className="hcleditor__uncertainty-expand">Settings</span>
                </summary>
                <div className="hcleditor__uncertainty-item-settings hcleditor__uncertainty-item-settings--editor">
                  <ExpressionEditor expression={definition.expression} unit="PROBABILITY" models={OVERRIDE_MODELS} disabled={!editable} onChange={(expression) => update(index, expression)} />
                  {editable && <button type="button" className="hcleditor__uncertainty-delete" onClick={() => remove(index)}>Delete</button>}
                </div>
              </details>
            ))}
          </div>
        </details>
      )}
      {available.length > 0 && (
        <details className="hcleditor__uncertainty-collection">
          <summary>Events that take their SY value <span>{String(available.length)}</span></summary>
          <ul className="hcleditor__uncertainty-list hcleditor__uncertainty-sy-values">
            {available.map((choice) => <SyValueLine key={choice.key} choice={choice} />)}
          </ul>
        </details>
      )}
    </section>
  );
}

export { HclBasicEventControls, basicEventKey, type HclBasicEventChoice };
