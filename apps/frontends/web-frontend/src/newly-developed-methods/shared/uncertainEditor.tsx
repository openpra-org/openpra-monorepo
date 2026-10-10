import { useId } from "react";
import {
  vectorMean,
  type BaseLaw,
  type CcfFactorModel,
  type CcfTesting,
  type DurationLaw,
  type EmpiricalBayesLaw,
  type Law,
  type MixtureComponent,
  type PopulationLaw,
  type PosteriorLaw,
  type QuantilePoint,
  type TrendLaw,
  type UncertainExpression,
  type UncertainUnit,
  type UncertainVector,
  type VectorLaw,
} from "interfaces-mef-types/core/uncertainty";
import type { WorkbookParameterReference } from "interfaces-mef-types/modeling/references";
import { LawSchema, VectorLawSchema } from "interfaces-mef-types/zod/core/uncertainty";
import { WorkbookInput, WorkbookTextarea } from "../../workbooks/commitOnDeactivateFields";
import { expressionText, familyText } from "./uncertainText";
import "./css/uncertainEditor.css";

type LawWrapper = "TRUNCATED" | "MIXTURE" | "PRODUCT";

type EditableFamily = BaseLaw["family"] | LawWrapper;

const ALL_WRAPPERS: readonly LawWrapper[] = ["TRUNCATED", "MIXTURE", "PRODUCT"];

const FACTOR_DRAFT: Law = { family: "LOGNORMAL", mean: 1, errorFactor: 3, level: 0.95 };

interface ParameterOption {
  reference: WorkbookParameterReference;
  label: string;
  unit: UncertainUnit;
}

type ModelForm = "MISSION" | "STANDBY";

const BASE_FAMILIES: BaseLaw["family"][] = [
  "POINT",
  "LOGNORMAL",
  "GAMMA",
  "BETA",
  "NORMAL",
  "STUDENT_T",
  "LOGIT_NORMAL",
  "UNIFORM",
  "LOG_UNIFORM",
  "TRIANGULAR",
  "LOG_TRIANGULAR",
  "WEIBULL",
  "MAXIMUM_ENTROPY",
  "CONSTRAINED_NONINFORMATIVE",
  "DISCRETE",
  "TABULATED",
  "METALOG",
  "SAMPLES",
];

const PROBABILITY_ONLY: ReadonlySet<string> = new Set(["CONSTRAINED_NONINFORMATIVE", "LOGIT_NORMAL"]);

const DEFAULT_CENTER: Record<UncertainUnit, number> = {
  PROBABILITY: 1e-3,
  FRACTION: 1e-2,
  FACTOR: 1,
  PER_HOUR: 1e-5,
  PER_YEAR: 1e-2,
  HOURS: 24,
  MINUTES: 30,
  YEARS: 1,
  QUANTITY: 1,
};

const UPDATED_FAMILIES: ReadonlySet<Law["family"]> = new Set(["POSTERIOR", "POPULATION", "EMPIRICAL_BAYES", "DURATION", "TREND"]);

function updatedFamily(law: Law): law is PosteriorLaw | PopulationLaw | EmpiricalBayesLaw | DurationLaw | TrendLaw {
  return UPDATED_FAMILIES.has(law.family);
}

function bounded(unit: UncertainUnit): boolean {
  return unit === "PROBABILITY" || unit === "FRACTION";
}

function familiesFor(unit: UncertainUnit, wrappers: readonly LawWrapper[]): EditableFamily[] {
  const base: EditableFamily[] = BASE_FAMILIES.filter((family) => bounded(unit) || !PROBABILITY_ONLY.has(family));
  return [...base, ...wrappers];
}

function centerOf(law: Law, unit: UncertainUnit): number {
  switch (law.family) {
    case "POINT": return law.value;
    case "LOGNORMAL":
    case "NORMAL":
    case "MAXIMUM_ENTROPY":
    case "CONSTRAINED_NONINFORMATIVE":
      return law.mean;
    case "GAMMA": return law.shape / law.rate;
    case "TRIANGULAR":
    case "LOG_TRIANGULAR":
      return law.mode;
    case "WEIBULL": return law.scale;
    case "TRUNCATED": return centerOf(law.law, unit);
    case "PRODUCT": return law.factors[0] === undefined ? DEFAULT_CENTER[unit] : centerOf(law.factors[0], unit);
    default: return DEFAULT_CENTER[unit];
  }
}

function draftFor(family: EditableFamily, previous: Law, unit: UncertainUnit): Law {
  const raw = centerOf(previous, unit);
  const center = Number.isFinite(raw) && raw > 0 && (!bounded(unit) || raw < 1) ? raw : DEFAULT_CENTER[unit];
  const top = bounded(unit) ? Math.min(1, 10 * center) : 10 * center;
  switch (family) {
    case "POINT": return { family, value: center };
    case "LOGNORMAL": return { family, mean: center, errorFactor: 3, level: 0.95 };
    case "GAMMA": return { family, shape: 1, rate: 1 / center };
    case "BETA": return bounded(unit) ? { family, alpha: 1, beta: (1 - center) / center, lower: 0, upper: 1 } : { family, alpha: 1, beta: 1, lower: 0, upper: 2 * center };
    case "NORMAL": return { family, mean: center, standardDeviation: center / 2 };
    case "STUDENT_T": return { family, location: center, scale: center / 2, degreesOfFreedom: 5 };
    case "LOGIT_NORMAL": return { family, mu: Math.log(center / (1 - center)), sigma: 1 };
    case "UNIFORM": return { family, lower: center / 2, upper: Math.min(top, 2 * center) };
    case "LOG_UNIFORM": return { family, lower: center / 10, upper: top };
    case "TRIANGULAR": return { family, lower: center / 2, mode: center, upper: Math.min(top, 2 * center) };
    case "LOG_TRIANGULAR": return { family, lower: center / 10, mode: center, upper: top };
    case "WEIBULL": return { family, scale: center, shape: 1, location: 0 };
    case "MAXIMUM_ENTROPY": return { family, lower: 0, mean: center, upper: bounded(unit) ? 1 : 10 * center };
    case "CONSTRAINED_NONINFORMATIVE": return { family, mean: center };
    case "DISCRETE": return { family, outcomes: [{ value: center, weight: 1 }] };
    case "TABULATED": return { family, points: [{ probability: 0, value: center / 10 }, { probability: 0.5, value: center }, { probability: 1, value: top }], scale: "LOG" };
    case "METALOG": return { family, points: [{ probability: 0.05, value: center / 3 }, { probability: 0.5, value: center }, { probability: 0.95, value: Math.min(bounded(unit) ? 0.999 : Number.POSITIVE_INFINITY, 3 * center) }], lower: 0, upper: bounded(unit) ? 1 : null };
    case "SAMPLES": return { family, values: [center], weights: [], smoothing: { kind: "NONE" } };
    case "TRUNCATED": return { family, law: { family: "LOGNORMAL", mean: center, errorFactor: 3, level: 0.95 }, lower: null, upper: bounded(unit) ? 1 : 10 * top };
    case "MIXTURE": return {
      family,
      components: [
        { weight: 1, law: previous.family === "MIXTURE" || updatedFamily(previous) ? { family: "LOGNORMAL", mean: center, errorFactor: 3, level: 0.95 } : previous },
        { weight: 1, law: { family: "LOGNORMAL", mean: center, errorFactor: 10, level: 0.95 } },
      ],
    };
    case "PRODUCT": return previous.family === "PRODUCT" ? previous : { family, factors: [previous, FACTOR_DRAFT] };
  }
}

function numericFields(law: Law): { key: string; label: string; value: number }[] {
  switch (law.family) {
    case "POINT": return [{ key: "value", label: "Value", value: law.value }];
    case "BETA": return [{ key: "alpha", label: "α", value: law.alpha }, { key: "beta", label: "β", value: law.beta }, { key: "lower", label: "Lower", value: law.lower }, { key: "upper", label: "Upper", value: law.upper }];
    case "GAMMA": return [{ key: "shape", label: "Shape", value: law.shape }, { key: "rate", label: "Rate", value: law.rate }];
    case "LOGNORMAL": return [{ key: "mean", label: "Mean", value: law.mean }, { key: "errorFactor", label: "Error factor", value: law.errorFactor }, { key: "level", label: "EF level", value: law.level }];
    case "NORMAL": return [{ key: "mean", label: "Mean", value: law.mean }, { key: "standardDeviation", label: "Std. deviation", value: law.standardDeviation }];
    case "STUDENT_T": return [{ key: "location", label: "Location", value: law.location }, { key: "scale", label: "Scale", value: law.scale }, { key: "degreesOfFreedom", label: "Degrees of freedom", value: law.degreesOfFreedom }];
    case "LOGIT_NORMAL": return [{ key: "mu", label: "μ", value: law.mu }, { key: "sigma", label: "σ", value: law.sigma }];
    case "UNIFORM":
    case "LOG_UNIFORM":
      return [{ key: "lower", label: "Lower", value: law.lower }, { key: "upper", label: "Upper", value: law.upper }];
    case "TRIANGULAR":
    case "LOG_TRIANGULAR":
      return [{ key: "lower", label: "Lower", value: law.lower }, { key: "mode", label: "Mode", value: law.mode }, { key: "upper", label: "Upper", value: law.upper }];
    case "WEIBULL": return [{ key: "scale", label: "Scale", value: law.scale }, { key: "shape", label: "Shape", value: law.shape }, { key: "location", label: "Location", value: law.location }];
    case "MAXIMUM_ENTROPY": return [{ key: "lower", label: "Lower", value: law.lower }, { key: "mean", label: "Mean", value: law.mean }, { key: "upper", label: "Upper", value: law.upper }];
    case "CONSTRAINED_NONINFORMATIVE": return [{ key: "mean", label: "Mean", value: law.mean }];
    default: return [];
  }
}

function parsedNumber(text: string): number | undefined {
  const trimmed = text.trim();
  if (trimmed.length === 0) return undefined;
  const value = Number(trimmed);
  return Number.isFinite(value) ? value : undefined;
}

function numberList(text: string): number[] | undefined {
  const parts: string[] = [];
  let current = "";
  for (const character of text) {
    if (character === "," || character === " " || character === "\n" || character === "\t" || character === ";") {
      if (current.length > 0) parts.push(current);
      current = "";
    } else current += character;
  }
  if (current.length > 0) parts.push(current);
  const values = parts.map((part) => Number(part));
  return values.every((value) => Number.isFinite(value)) ? values : undefined;
}

function checked(candidate: object): Law | undefined {
  const parsed = LawSchema.safeParse(candidate);
  return parsed.success ? parsed.data : undefined;
}

function NumberField({ label, value, disabled, onCommit }: { label: string; value: number | null; disabled: boolean; onCommit: (value: number | undefined) => void }): JSX.Element {
  const id = useId();
  return (
    <label className="uncertain-editor__field" htmlFor={id}>
      <span>{label}</span>
      <WorkbookInput id={id} type="text" inputMode="decimal" value={value === null ? "" : String(value)} disabled={disabled} onChange={(event) => onCommit(parsedNumber(event.target.value))} />
    </label>
  );
}

function PointRows({ points, disabled, onChange }: { points: QuantilePoint[]; disabled: boolean; onChange: (points: QuantilePoint[]) => void }): JSX.Element {
  return (
    <div className="uncertain-editor__rows">
      {points.map((point, index) => (
        <div key={index} className="uncertain-editor__row">
          <NumberField label="Probability" value={point.probability} disabled={disabled} onCommit={(probability) => { if (probability !== undefined) onChange(points.map((entry, at) => (at === index ? { ...entry, probability } : entry))); }} />
          <NumberField label="Value" value={point.value} disabled={disabled} onCommit={(value) => { if (value !== undefined) onChange(points.map((entry, at) => (at === index ? { ...entry, value } : entry))); }} />
          {!disabled && points.length > 2 && <button type="button" className="uncertain-editor__link" onClick={() => onChange(points.filter((_, at) => at !== index))}>Remove</button>}
        </div>
      ))}
      {!disabled && <button type="button" className="uncertain-editor__link" onClick={() => onChange([...points, { probability: points[points.length - 1]?.probability ?? 0.5, value: points[points.length - 1]?.value ?? 0 }])}>Add point</button>}
    </div>
  );
}

function LawEditor({ law, unit, disabled, onChange, wrappers = ALL_WRAPPERS }: { law: Law; unit: UncertainUnit; disabled: boolean; onChange: (law: Law) => void; wrappers?: readonly LawWrapper[] }): JSX.Element {
  const id = useId();
  const families = familiesFor(unit, wrappers);
  const editable = !updatedFamily(law);
  const commit = (candidate: object): void => {
    const next = checked(candidate);
    if (next !== undefined) onChange(next);
  };
  return (
    <div className="uncertain-editor">
      <label className="uncertain-editor__field" htmlFor={id}>
        <span>Law</span>
        <select id={id} value={law.family} disabled={disabled || !editable} onChange={(event) => {
          const family = families.find((candidate) => candidate === event.target.value);
          if (family !== undefined) onChange(draftFor(family, law, unit));
        }}>
          {!families.some((family) => family === law.family) && <option value={law.family}>{familyText(law.family)}</option>}
          {families.map((family) => <option key={family} value={family}>{familyText(family)}</option>)}
        </select>
      </label>
      {numericFields(law).map((field) => (
        <NumberField key={field.key} label={field.label} value={field.value} disabled={disabled} onCommit={(value) => { if (value !== undefined) commit({ ...law, [field.key]: value }); }} />
      ))}
      {law.family === "DISCRETE" && (
        <div className="uncertain-editor__rows">
          {law.outcomes.map((outcome, index) => (
            <div key={index} className="uncertain-editor__row">
              <NumberField label="Value" value={outcome.value} disabled={disabled} onCommit={(value) => { if (value !== undefined) commit({ ...law, outcomes: law.outcomes.map((entry, at) => (at === index ? { ...entry, value } : entry)) }); }} />
              <NumberField label="Weight" value={outcome.weight} disabled={disabled} onCommit={(weight) => { if (weight !== undefined) commit({ ...law, outcomes: law.outcomes.map((entry, at) => (at === index ? { ...entry, weight } : entry)) }); }} />
              {!disabled && law.outcomes.length > 1 && <button type="button" className="uncertain-editor__link" onClick={() => commit({ ...law, outcomes: law.outcomes.filter((_, at) => at !== index) })}>Remove</button>}
            </div>
          ))}
          {!disabled && <button type="button" className="uncertain-editor__link" onClick={() => commit({ ...law, outcomes: [...law.outcomes, { value: law.outcomes[law.outcomes.length - 1]?.value ?? 0, weight: 1 }] })}>Add outcome</button>}
        </div>
      )}
      {law.family === "TABULATED" && (
        <>
          <label className="uncertain-editor__field">
            <span>Between points</span>
            <select value={law.scale} disabled={disabled} onChange={(event) => commit({ ...law, scale: event.target.value === "LOG" ? "LOG" : "LINEAR" })}>
              <option value="LINEAR">Linear</option>
              <option value="LOG">Logarithmic</option>
            </select>
          </label>
          <PointRows points={law.points} disabled={disabled} onChange={(points) => commit({ ...law, points })} />
        </>
      )}
      {law.family === "METALOG" && (
        <>
          <NumberField label="Lower bound" value={law.lower} disabled={disabled} onCommit={(lower) => commit({ ...law, lower: lower ?? null })} />
          <NumberField label="Upper bound" value={law.upper} disabled={disabled} onCommit={(upper) => commit({ ...law, upper: upper ?? null })} />
          <PointRows points={law.points} disabled={disabled} onChange={(points) => commit({ ...law, points })} />
        </>
      )}
      {law.family === "SAMPLES" && (
        <>
          <label className="uncertain-editor__field uncertain-editor__field--wide">
            <span>Values</span>
            <WorkbookTextarea value={law.values.join(", ")} disabled={disabled} onChange={(event) => { const values = numberList(event.target.value); if (values !== undefined) commit({ ...law, values }); }} />
          </label>
          <label className="uncertain-editor__field uncertain-editor__field--wide">
            <span>Weights, blank for equal</span>
            <WorkbookTextarea value={law.weights.join(", ")} disabled={disabled} onChange={(event) => { const weights = numberList(event.target.value); if (weights !== undefined) commit({ ...law, weights }); }} />
          </label>
          <label className="uncertain-editor__field">
            <span>Smoothing</span>
            <select value={law.smoothing.kind} disabled={disabled} onChange={(event) => commit({ ...law, smoothing: event.target.value === "GAUSSIAN_KERNEL" ? { kind: "GAUSSIAN_KERNEL", bandwidth: Math.abs(law.values[0] ?? 1) / 10 || 1 } : { kind: "NONE" } })}>
              <option value="NONE">None</option>
              <option value="GAUSSIAN_KERNEL">Gaussian kernel</option>
            </select>
          </label>
          {law.smoothing.kind === "GAUSSIAN_KERNEL" && <NumberField label="Bandwidth" value={law.smoothing.bandwidth} disabled={disabled} onCommit={(bandwidth) => { if (bandwidth !== undefined) commit({ ...law, smoothing: { kind: "GAUSSIAN_KERNEL", bandwidth } }); }} />}
        </>
      )}
      {law.family === "TRUNCATED" && (
        <>
          <NumberField label="Cut below" value={law.lower} disabled={disabled} onCommit={(lower) => commit({ ...law, lower: lower ?? null })} />
          <NumberField label="Cut above" value={law.upper} disabled={disabled} onCommit={(upper) => commit({ ...law, upper: upper ?? null })} />
          <div className="uncertain-editor__nested">
            <LawEditor law={law.law} unit={unit} disabled={disabled} wrappers={[]} onChange={(inner) => {
              if (inner.family === "TRUNCATED" || updatedFamily(inner)) return;
              commit({ ...law, law: inner });
            }} />
          </div>
        </>
      )}
      {law.family === "MIXTURE" && (
        <div className="uncertain-editor__rows">
          {law.components.map((component, index) => (
            <div key={index} className="uncertain-editor__nested">
              <NumberField label="Weight" value={component.weight} disabled={disabled} onCommit={(weight) => { if (weight !== undefined) commit({ ...law, components: law.components.map((entry, at) => (at === index ? { ...entry, weight } : entry)) }); }} />
              <LawEditor law={component.law} unit={unit} disabled={disabled} wrappers={[]} onChange={(inner) => {
                if (inner.family === "MIXTURE" || updatedFamily(inner)) return;
                const next: MixtureComponent = { ...component, law: inner };
                commit({ ...law, components: law.components.map((entry, at) => (at === index ? next : entry)) });
              }} />
              {!disabled && law.components.length > 2 && <button type="button" className="uncertain-editor__link" onClick={() => commit({ ...law, components: law.components.filter((_, at) => at !== index) })}>Remove component</button>}
            </div>
          ))}
          {!disabled && <button type="button" className="uncertain-editor__link" onClick={() => commit({ ...law, components: [...law.components, { weight: 1, law: law.components[law.components.length - 1]?.law ?? draftFor("LOGNORMAL", law, unit) }] })}>Add component</button>}
        </div>
      )}
      {law.family === "PRODUCT" && (
        <div className="uncertain-editor__rows">
          {law.factors.map((factor, index) => (
            <div key={index} className="uncertain-editor__nested">
              <LawEditor law={factor} unit={index === 0 ? unit : "FACTOR"} disabled={disabled} wrappers={[]} onChange={(inner) => commit({ ...law, factors: law.factors.map((entry, at) => (at === index ? inner : entry)) })} />
              {!disabled && law.factors.length > 2 && <button type="button" className="uncertain-editor__link" onClick={() => commit({ ...law, factors: law.factors.filter((_, at) => at !== index) })}>Remove factor</button>}
            </div>
          ))}
          {!disabled && <button type="button" className="uncertain-editor__link" onClick={() => commit({ ...law, factors: [...law.factors, FACTOR_DRAFT] })}>Add factor</button>}
        </div>
      )}
    </div>
  );
}

function valueOf(unit: UncertainUnit, law: Law): UncertainExpression {
  return { node: "VALUE", value: { unit, law } };
}

function pointValue(unit: UncertainUnit, value: number): UncertainExpression {
  return valueOf(unit, { family: "POINT", value });
}

function slotLaw(expression: UncertainExpression, unit: UncertainUnit): Law {
  return expression.node === "VALUE" ? expression.value.law : { family: "POINT", value: DEFAULT_CENTER[unit] };
}

const COMPOSED_SOURCE = "COMPOSED";

function referenceKey(reference: WorkbookParameterReference): string {
  return `${reference.workbookId}:${reference.entityId}`;
}

function SlotEditor({ label, expression, unit, options, disabled, onChange }: { label: string; expression: UncertainExpression; unit: UncertainUnit; options: readonly ParameterOption[]; disabled: boolean; onChange: (expression: UncertainExpression) => void }): JSX.Element {
  const id = useId();
  const matching = options.filter((option) => option.unit === unit);
  const labels = new Map(options.map((option) => [referenceKey(option.reference), option.label]));
  const composed = expression.node === "OPERATION" || expression.node === "MODEL";
  const linked = expression.node === "PARAMETER" ? referenceKey(expression.reference) : "";
  const unlisted = expression.node === "PARAMETER" && !matching.some((option) => referenceKey(option.reference) === linked) ? expression.reference : undefined;
  return (
    <fieldset className="uncertain-editor__slot">
      <legend>{label}</legend>
      {(matching.length > 0 || expression.node !== "VALUE") && (
        <label className="uncertain-editor__field" htmlFor={id}>
          <span>Source</span>
          <select id={id} value={composed ? COMPOSED_SOURCE : linked} disabled={disabled} onChange={(event) => {
            if (event.target.value === COMPOSED_SOURCE || event.target.value === linked) return;
            const option = matching.find((candidate) => referenceKey(candidate.reference) === event.target.value);
            onChange(option === undefined ? valueOf(unit, slotLaw(expression, unit)) : { node: "PARAMETER", reference: option.reference });
          }}>
            {composed && <option value={COMPOSED_SOURCE}>Composed</option>}
            <option value="">Typed here</option>
            {unlisted !== undefined && <option value={linked}>{labels.get(linked) ?? `${unlisted.entityId} in ${unlisted.workbookId}`}</option>}
            {matching.map((option) => <option key={referenceKey(option.reference)} value={referenceKey(option.reference)}>{option.label}</option>)}
          </select>
        </label>
      )}
      {composed && <p className="uncertain-editor__composed">Composed: {expressionText(expression, (key) => labels.get(key) ?? key)}</p>}
      {expression.node === "VALUE" && <LawEditor law={expression.value.law} unit={unit} disabled={disabled} onChange={(law) => onChange(valueOf(unit, law))} />}
    </fieldset>
  );
}

function defaultPoint(unit: UncertainUnit): number {
  return DEFAULT_CENTER[unit];
}

function defaultExpression(unit: UncertainUnit): UncertainExpression {
  return pointValue(unit, defaultPoint(unit));
}

function ExpressionEditor({ expression, unit, options = [], models = [], defaultTime, disabled, onChange }: {
  expression: UncertainExpression;
  unit: UncertainUnit;
  options?: readonly ParameterOption[];
  models?: readonly ModelForm[];
  defaultTime?: UncertainExpression;
  disabled: boolean;
  onChange: (expression: UncertainExpression) => void;
}): JSX.Element {
  const id = useId();
  const time = defaultTime ?? pointValue("HOURS", DEFAULT_CENTER.HOURS);
  const rate = pointValue("PER_HOUR", DEFAULT_CENTER.PER_HOUR);
  const mode = expression.node === "MODEL" && (expression.model.form === "MISSION" || expression.model.form === "STANDBY") ? expression.model.form : "VALUE";
  const choose = (next: string): void => {
    if (next === "MISSION") onChange({ node: "MODEL", model: { form: "MISSION", rate, missionTime: time } });
    else if (next === "STANDBY") onChange({ node: "MODEL", model: { form: "STANDBY", rate, testInterval: time } });
    else onChange(valueOf(unit, { family: "POINT", value: DEFAULT_CENTER[unit] }));
  };
  return (
    <div className="uncertain-editor">
      {models.length > 0 && (
        <label className="uncertain-editor__field" htmlFor={id}>
          <span>Form</span>
          <select id={id} value={mode} disabled={disabled} onChange={(event) => choose(event.target.value)}>
            <option value="VALUE">Value</option>
            {models.includes("MISSION") && <option value="MISSION">Failure rate over a mission</option>}
            {models.includes("STANDBY") && <option value="STANDBY">Standby rate tested periodically</option>}
          </select>
        </label>
      )}
      {expression.node === "MODEL" && expression.model.form === "MISSION" && (
        <>
          <SlotEditor label="Failure rate" expression={expression.model.rate} unit="PER_HOUR" options={options} disabled={disabled} onChange={(next) => onChange({ node: "MODEL", model: { form: "MISSION", rate: next, missionTime: expression.model.form === "MISSION" ? expression.model.missionTime : time } })} />
          <SlotEditor label="Mission time" expression={expression.model.missionTime} unit="HOURS" options={options} disabled={disabled} onChange={(next) => onChange({ node: "MODEL", model: { form: "MISSION", rate: expression.model.form === "MISSION" ? expression.model.rate : rate, missionTime: next } })} />
        </>
      )}
      {expression.node === "MODEL" && expression.model.form === "STANDBY" && (
        <>
          <SlotEditor label="Standby failure rate" expression={expression.model.rate} unit="PER_HOUR" options={options} disabled={disabled} onChange={(next) => onChange({ node: "MODEL", model: { form: "STANDBY", rate: next, testInterval: expression.model.form === "STANDBY" ? expression.model.testInterval : time } })} />
          <SlotEditor label="Test interval" expression={expression.model.testInterval} unit="HOURS" options={options} disabled={disabled} onChange={(next) => onChange({ node: "MODEL", model: { form: "STANDBY", rate: expression.model.form === "STANDBY" ? expression.model.rate : rate, testInterval: next } })} />
        </>
      )}
      {mode === "VALUE" && <SlotEditor label="Value" expression={expression} unit={unit} options={options} disabled={disabled} onChange={onChange} />}
    </div>
  );
}

function MissionTimeEditor({ expression, options, disabled, onChange }: {
  expression: UncertainExpression | undefined;
  options: readonly ParameterOption[];
  disabled: boolean;
  onChange: (expression: UncertainExpression | undefined) => void;
}): JSX.Element {
  const id = useId();
  const matching = options.filter((option) => option.unit === "HOURS");
  if (expression !== undefined) {
    return (
      <div className="uncertain-editor">
        <SlotEditor label="Mission time" expression={expression} unit="HOURS" options={matching} disabled={disabled} onChange={onChange} />
        {!disabled && <button type="button" className="uncertain-editor__link" onClick={() => onChange(undefined)}>Clear</button>}
      </div>
    );
  }
  return (
    <div className="uncertain-editor">
      {matching.length > 0 && (
        <label className="uncertain-editor__field" htmlFor={id}>
          <span>Source</span>
          <select id={id} value="" disabled={disabled} onChange={(event) => {
            const option = matching.find((candidate) => referenceKey(candidate.reference) === event.target.value);
            if (option !== undefined) onChange({ node: "PARAMETER", reference: option.reference });
          }}>
            <option value="">Typed here</option>
            {matching.map((option) => <option key={referenceKey(option.reference)} value={referenceKey(option.reference)}>{option.label}</option>)}
          </select>
        </label>
      )}
      <NumberField label="Hours" value={null} disabled={disabled} onCommit={(hours) => { if (hours !== undefined && hours > 0) onChange(pointValue("HOURS", hours)); }} />
    </div>
  );
}

interface VectorOption {
  reference: WorkbookParameterReference;
  label: string;
  length: number;
}

const DIRICHLET_STRENGTH = 10;

const MGL_LETTERS: readonly string[] = ["β", "γ", "δ"];

const CCF_MODELS: readonly CcfFactorModel["model"][] = ["BETA_FACTOR", "MGL", "ALPHA_FACTOR", "PHI_FACTOR", "BINOMIAL_FAILURE_RATE"];

const CCF_MODEL_LABELS: Record<CcfFactorModel["model"], string> = {
  BETA_FACTOR: "Beta factor",
  MGL: "Multiple Greek letter",
  ALPHA_FACTOR: "Alpha factor",
  PHI_FACTOR: "Phi factor",
  BINOMIAL_FAILURE_RATE: "Binomial failure rate",
};

type BinomialFailureRatePart = "independent" | "nonLethalShock" | "componentFailure" | "lethalShock";

const BFR_PARTS: readonly { part: BinomialFailureRatePart; label: string; unit: UncertainUnit }[] = [
  { part: "independent", label: "Independent failure", unit: "PROBABILITY" },
  { part: "nonLethalShock", label: "Non-lethal shock", unit: "PROBABILITY" },
  { part: "componentFailure", label: "Component failure given a shock", unit: "FRACTION" },
  { part: "lethalShock", label: "Lethal shock", unit: "PROBABILITY" },
];

function checkedVector(candidate: object): VectorLaw | undefined {
  const parsed = VectorLawSchema.safeParse(candidate);
  return parsed.success ? parsed.data : undefined;
}

const VECTOR_FAMILIES: readonly { family: VectorLaw["family"]; label: string }[] = [
  { family: "DIRICHLET", label: "Dirichlet" },
  { family: "WEIGHTED_DIRICHLET", label: "Weighted Dirichlet" },
  { family: "FIXED", label: "Fixed fractions" },
];

function vectorDraft(family: VectorLaw["family"], previous: VectorLaw): VectorLaw {
  const mean = vectorMean(previous);
  const concentrations = mean.map((value) => value * DIRICHLET_STRENGTH);
  switch (family) {
    case "FIXED": return { family, values: mean };
    case "DIRICHLET": return { family, concentrations };
    case "WEIGHTED_DIRICHLET": return previous.family === "WEIGHTED_DIRICHLET" ? previous : { family, concentrations, weights: mean.map(() => 1) };
  }
}

function vectorValues(law: VectorLaw): number[] {
  return law.family === "FIXED" ? law.values : law.concentrations;
}

function vectorWithValues(law: VectorLaw, values: number[]): VectorLaw | undefined {
  switch (law.family) {
    case "FIXED": return checkedVector({ family: "FIXED", values });
    case "DIRICHLET": return checkedVector({ family: "DIRICHLET", concentrations: values });
    case "WEIGHTED_DIRICHLET": return checkedVector({ family: "WEIGHTED_DIRICHLET", concentrations: values, weights: law.weights });
  }
}

function VectorLawEditor({ law, labels, disabled, onChange }: { law: VectorLaw; labels: readonly string[]; disabled: boolean; onChange: (law: VectorLaw) => void }): JSX.Element {
  const id = useId();
  const values = vectorValues(law);
  const commit = (next: number[]): void => {
    const candidate = vectorWithValues(law, next);
    if (candidate !== undefined) onChange(candidate);
  };
  const commitWeights = (weights: number[]): void => {
    if (law.family !== "WEIGHTED_DIRICHLET") return;
    const candidate = checkedVector({ ...law, weights });
    if (candidate !== undefined) onChange(candidate);
  };
  return (
    <div className="uncertain-editor">
      <label className="uncertain-editor__field" htmlFor={id}>
        <span>Law</span>
        <select id={id} value={law.family} disabled={disabled} onChange={(event) => {
          const family = VECTOR_FAMILIES.find((option) => option.family === event.target.value)?.family;
          if (family !== undefined) onChange(vectorDraft(family, law));
        }}>
          {VECTOR_FAMILIES.map((option) => <option key={option.family} value={option.family}>{option.label}</option>)}
        </select>
      </label>
      {values.map((value, index) => (
        <NumberField key={index} label={`${labels[index] ?? `Component ${index + 1}`}${law.family === "FIXED" ? "" : " concentration"}`} value={value} disabled={disabled} onCommit={(next) => { if (next !== undefined) commit(values.map((entry, at) => (at === index ? next : entry))); }} />
      ))}
      {law.family === "WEIGHTED_DIRICHLET" && law.weights.map((weight, index) => (
        <NumberField key={`weight-${index}`} label={`${labels[index] ?? `Component ${index + 1}`} weight`} value={weight} disabled={disabled} onCommit={(next) => { if (next !== undefined) commitWeights(law.weights.map((entry, at) => (at === index ? next : entry))); }} />
      ))}
    </div>
  );
}

function VectorEditor({ vector, labels, options = [], disabled, onChange }: { vector: UncertainVector; labels: readonly string[]; options?: readonly VectorOption[]; disabled: boolean; onChange: (vector: UncertainVector) => void }): JSX.Element {
  const id = useId();
  const matching = options.filter((option) => option.length === labels.length);
  const linked = vector.node === "PARAMETER" ? `${vector.reference.workbookId}:${vector.reference.entityId}` : "";
  const typed: VectorLaw = vector.node === "VALUE" ? vector.law : { family: "FIXED", values: labels.map(() => 1 / labels.length) };
  const unlisted = vector.node === "PARAMETER" && !matching.some((option) => `${option.reference.workbookId}:${option.reference.entityId}` === linked) ? vector.reference : undefined;
  return (
    <div className="uncertain-editor">
      {(matching.length > 0 || vector.node === "PARAMETER") && (
        <label className="uncertain-editor__field" htmlFor={id}>
          <span>Source</span>
          <select id={id} value={linked} disabled={disabled} onChange={(event) => {
            if (event.target.value === linked && unlisted !== undefined) return;
            const option = matching.find((candidate) => `${candidate.reference.workbookId}:${candidate.reference.entityId}` === event.target.value);
            onChange(option === undefined ? { node: "VALUE", law: typed } : { node: "PARAMETER", reference: option.reference });
          }}>
            <option value="">Typed here</option>
            {unlisted !== undefined && <option value={linked}>{options.find((option) => `${option.reference.workbookId}:${option.reference.entityId}` === linked)?.label ?? `${unlisted.entityId} in ${unlisted.workbookId}`}</option>}
            {matching.map((option) => <option key={`${option.reference.workbookId}:${option.reference.entityId}`} value={`${option.reference.workbookId}:${option.reference.entityId}`}>{option.label}</option>)}
          </select>
        </label>
      )}
      {vector.node === "VALUE" && <VectorLawEditor law={vector.law} labels={labels} disabled={disabled} onChange={(law) => onChange({ node: "VALUE", law })} />}
    </div>
  );
}

function defaultAlphas(size: number): number[] {
  const rest = size > 1 ? 0.05 / (size - 1) : 0;
  return Array.from({ length: size }, (_, index) => (index === 0 ? 0.95 : rest));
}

function mglFromAlphas(alphas: readonly number[]): number[] {
  const tails = alphas.map((_, index) => alphas.slice(index).reduce((sum, value) => sum + value, 0));
  return tails.slice(1).map((tail, index) => tail / (tails[index] ?? 1));
}

function fraction(value: number): UncertainExpression {
  return { node: "VALUE", value: { unit: "FRACTION", law: { family: "POINT", value } } };
}

function ccfFactorDraft(model: CcfFactorModel["model"], size: number, testing: CcfTesting): CcfFactorModel {
  const alphas = defaultAlphas(Math.max(size, 2));
  switch (model) {
    case "BETA_FACTOR": return { model, beta: fraction(1 - (alphas[0] ?? 1)) };
    case "MGL": return { model, factors: mglFromAlphas(alphas).map(fraction) };
    case "ALPHA_FACTOR": return { model, testing, alphas: { node: "VALUE", law: { family: "FIXED", values: alphas } } };
    case "PHI_FACTOR": return { model, phis: { node: "VALUE", law: { family: "FIXED", values: alphas } } };
    case "BINOMIAL_FAILURE_RATE": return {
      model,
      independent: pointValue("PROBABILITY", 1e-3),
      nonLethalShock: pointValue("PROBABILITY", 1e-4),
      componentFailure: fraction(0.1),
      lethalShock: pointValue("PROBABILITY", 1e-6),
    };
  }
}

function ccfLabels(prefix: string, size: number): string[] {
  return Array.from({ length: size }, (_, index) => `${prefix}${index + 1}`);
}

function CcfFactorEditor({ factors, groupSize, options = [], vectorOptions = [], disabled, onChange }: {
  factors: CcfFactorModel;
  groupSize: number;
  options?: readonly ParameterOption[];
  vectorOptions?: readonly VectorOption[];
  disabled: boolean;
  onChange: (factors: CcfFactorModel) => void;
}): JSX.Element {
  const modelId = useId();
  const testingId = useId();
  const testing = factors.model === "ALPHA_FACTOR" ? factors.testing : "NON_STAGGERED";
  return (
    <div className="uncertain-editor">
      <label className="uncertain-editor__field" htmlFor={modelId}>
        <span>Model</span>
        <select id={modelId} value={factors.model} disabled={disabled} onChange={(event) => {
          const model = CCF_MODELS.find((candidate) => candidate === event.target.value);
          if (model !== undefined && model !== factors.model) onChange(ccfFactorDraft(model, groupSize, testing));
        }}>
          {CCF_MODELS.map((model) => <option key={model} value={model}>{CCF_MODEL_LABELS[model]}</option>)}
        </select>
      </label>
      {factors.model === "ALPHA_FACTOR" && (
        <label className="uncertain-editor__field" htmlFor={testingId}>
          <span>Testing</span>
          <select id={testingId} value={factors.testing} disabled={disabled} onChange={(event) => onChange({ ...factors, testing: event.target.value === "STAGGERED" ? "STAGGERED" : "NON_STAGGERED" })}>
            <option value="NON_STAGGERED">Non-staggered</option>
            <option value="STAGGERED">Staggered</option>
          </select>
        </label>
      )}
      {factors.model === "BETA_FACTOR" && <SlotEditor label="Beta factor" expression={factors.beta} unit="FRACTION" options={options} disabled={disabled} onChange={(beta) => onChange({ model: "BETA_FACTOR", beta })} />}
      {factors.model === "MGL" && factors.factors.map((factor, index) => (
        <SlotEditor key={index} label={MGL_LETTERS[index] ?? `Factor ${index + 2}`} expression={factor} unit="FRACTION" options={options} disabled={disabled} onChange={(next) => onChange({ model: "MGL", factors: factors.factors.map((entry, at) => (at === index ? next : entry)) })} />
      ))}
      {factors.model === "ALPHA_FACTOR" && <VectorEditor vector={factors.alphas} labels={ccfLabels("α", groupSize)} options={vectorOptions} disabled={disabled} onChange={(alphas) => onChange({ ...factors, alphas })} />}
      {factors.model === "PHI_FACTOR" && <VectorEditor vector={factors.phis} labels={ccfLabels("φ", groupSize)} options={vectorOptions} disabled={disabled} onChange={(phis) => onChange({ model: "PHI_FACTOR", phis })} />}
      {factors.model === "BINOMIAL_FAILURE_RATE" && BFR_PARTS.map(({ part, label, unit }) => (
        <SlotEditor key={part} label={label} expression={factors[part]} unit={unit} options={options} disabled={disabled} onChange={(next) => onChange({ ...factors, [part]: next })} />
      ))}
    </div>
  );
}

export {
  CcfFactorEditor,
  ExpressionEditor,
  LawEditor,
  MissionTimeEditor,
  VectorEditor,
  VectorLawEditor,
  ccfFactorDraft,
  defaultExpression,
  defaultPoint,
  draftFor,
  updatedFamily,
  type ModelForm,
  type ParameterOption,
  type VectorOption,
};
