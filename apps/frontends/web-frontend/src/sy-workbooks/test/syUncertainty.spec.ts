import type { UncertainExpression, UncertainParameter } from "interfaces-mef-types/core/uncertainty";
import type { SystemsAnalysis } from "interfaces-mef-types/sy/systems-analysis";
import type { SyControlledParameterOption } from "../syWorkbookContext";
import { modelInputs, runReadiness } from "../syUncertainty";

const NO_SC: ReadonlyMap<string, UncertainParameter> = new Map();

const linked: UncertainExpression = { node: "PARAMETER", reference: { referenceType: "WORKBOOK_PARAMETER", workbookId: "da-1", entityId: "p-a" } };
const typed: UncertainExpression = { node: "VALUE", value: { unit: "PROBABILITY", law: { family: "POINT", value: 0.01 } } };
const sampledRate: UncertainExpression = { node: "MODEL", model: { form: "MISSION",
  rate: { node: "VALUE", value: { unit: "PER_HOUR", law: { family: "LOGNORMAL", mean: 1e-5, errorFactor: 3, level: 0.95 } } },
  missionTime: { node: "VALUE", value: { unit: "HOURS", law: { family: "POINT", value: 24 } } } } };

const sy = {
  systemDefinitions: [{ uuid: "system-1", name: "Cooling", boundaries: [], successCriteriaIds: [], modeledComponentsAndFailures: {}, informationBasis: "as-built-as-operated", implementsSrs: [] }],
  systemLogicModels: [{ uuid: "model-1", systemReference: "system-1", topGate: { gateId: "top" },
    leafNodes: [
      { id: "leaf-a", kind: "BASIC_EVENT_REFERENCE", basicEventId: "event-a" },
      { id: "leaf-b", kind: "BASIC_EVENT_REFERENCE", basicEventId: "event-b" },
      { id: "leaf-h", kind: "BASIC_EVENT_REFERENCE", basicEventId: "event-h" },
    ] }],
  systemBasicEvents: [
    { uuid: "event-a", code: "PUMP-A", failureMode: "FAILURE_TO_START", expression: linked },
    { uuid: "event-b", code: "PUMP-B", failureMode: "FAILURE_TO_START", expression: typed },
    { uuid: "event-h", code: "OP-HFE", failureMode: "HUMAN_ERROR", probability: 0.1 },
  ],
  commonCauseFailureGroups: [],
} as unknown as SystemsAnalysis;

const parameters: SyControlledParameterOption[] = [{ workbookId: "da-1", workbookName: "DA", parameterId: "p-a", parameterName: "Pump A", unit: "PROBABILITY",
  estimate: { node: "VALUE", value: { unit: "PROBABILITY", law: { family: "BETA", alpha: 2, beta: 98, lower: 0, upper: 1 } } } }];

function model(analysis: SystemsAnalysis): SystemsAnalysis["systemLogicModels"][number] {
  const found = analysis.systemLogicModels[0];
  if (found === undefined) throw new Error("missing model");
  return found;
}

describe("SY uncertainty inputs", () => {
  it("lists component events with their expressions and keeps HFE events out", () => {
    const inputs = modelInputs(sy, model(sy), parameters, NO_SC);
    expect(inputs.map(({ event, uncertain }) => [event.code, uncertain])).toEqual([["PUMP-A", true], ["PUMP-B", false]]);
    expect(inputs[0]?.sources.map((source) => source.parameterName)).toEqual(["Pump A"]);
    expect(runReadiness(sy, model(sy), parameters, NO_SC).state).toBe("READY");
  });

  it("treats a typed law or a rate law inside a model as uncertain", () => {
    const typedOnly = { ...sy, systemBasicEvents: sy.systemBasicEvents.map((event) => (event.uuid === "event-a" ? { ...event, expression: sampledRate } : event)) };
    expect(runReadiness(typedOnly, model(typedOnly), [], NO_SC).state).toBe("READY");
  });

  it("needs a value on every component event and an uncertain input to run", () => {
    const missing = { ...sy, systemBasicEvents: sy.systemBasicEvents.map((event) => (event.uuid === "event-b" ? { ...event, expression: undefined } : event)) };
    expect(runReadiness(missing, model(missing), parameters, NO_SC)).toMatchObject({ state: "NEEDS_FIX", message: "PUMP-B: No value yet. Set it in Step 02." });
    const fixed = { ...sy, systemBasicEvents: sy.systemBasicEvents.map((event) => (event.uuid === "event-a" ? { ...event, expression: typed } : event)) };
    expect(runReadiness(fixed, model(fixed), parameters, NO_SC).state).toBe("NO_INPUTS");
    expect(modelInputs(sy, model(sy), [], NO_SC)[0]?.issues.map((item) => item.code)).toEqual(["SOURCE_MISSING"]);
  });

  it("reads a linked SC mission time as a known source and samples its law", () => {
    const scTime: UncertainExpression = { node: "PARAMETER", reference: { referenceType: "WORKBOOK_PARAMETER", workbookId: "sc-1", entityId: "MT-1" } };
    const rate: UncertainExpression = { node: "VALUE", value: { unit: "PER_HOUR", law: { family: "POINT", value: 1e-5 } } };
    const linkedTime = { ...sy, systemBasicEvents: sy.systemBasicEvents.map((event) => (event.uuid === "event-b" ? { ...event, expression: { node: "MODEL" as const, model: { form: "MISSION" as const, rate, missionTime: scTime } } } : event)) };
    const table = (law: UncertainParameter["expression"]): ReadonlyMap<string, UncertainParameter> => new Map([["sc-1:MT-1", { reference: { referenceType: "WORKBOOK_PARAMETER", workbookId: "sc-1", entityId: "MT-1" }, expression: law }]]);
    const point = table({ node: "VALUE", value: { unit: "HOURS", law: { family: "POINT", value: 72 } } });
    const spread = table({ node: "VALUE", value: { unit: "HOURS", law: { family: "UNIFORM", lower: 48, upper: 96 } } });
    expect(modelInputs(linkedTime, model(linkedTime), parameters, NO_SC)[1]?.issues.map((item) => item.code)).toEqual(["SOURCE_MISSING"]);
    expect(modelInputs(linkedTime, model(linkedTime), parameters, point)[1]).toMatchObject({ issues: [], uncertain: false });
    expect(modelInputs(linkedTime, model(linkedTime), parameters, spread)[1]).toMatchObject({ issues: [], uncertain: true });
  });

  it("counts an uncertain common cause factor or total as an uncertain input", () => {
    const pointOnly = { ...sy, systemBasicEvents: sy.systemBasicEvents.map((event) => (event.uuid === "event-a" ? { ...event, expression: typed } : event)) };
    const group: SystemsAnalysis["commonCauseFailureGroups"][number] = {
      uuid: "ccf-1", name: "Pump group", description: "", scope: "INTRASYSTEM", affectedComponents: [], affectedSystems: ["system-1"],
      factors: { model: "ALPHA_FACTOR", testing: "NON_STAGGERED", alphas: { node: "VALUE", law: { family: "FIXED", values: [0.95, 0.05] } } },
      total: typed,
      members: { basicEvents: [{ id: "event-a" }, { id: "event-b" }] },
      groupSelectionBasis: "Same design",
      dataSources: [{ reference: "Generic", description: "Typed", dataType: "generic" }],
      implementsSrs: [],
    };
    const fixedGroup = { ...pointOnly, commonCauseFailureGroups: [group] };
    expect(runReadiness(fixedGroup, model(fixedGroup), [], NO_SC).state).toBe("NO_INPUTS");
    const dirichlet = { ...pointOnly, commonCauseFailureGroups: [{ ...group, factors: { ...group.factors, alphas: { node: "VALUE" as const, law: { family: "DIRICHLET" as const, concentrations: [47.5, 2.5] } } } }] };
    expect(runReadiness(dirichlet, model(dirichlet), [], NO_SC).state).toBe("READY");
    expect(modelInputs(dirichlet, model(dirichlet), [], NO_SC).map((input) => input.issues)).toEqual([[], []]);
    const typedLaw = { ...pointOnly, commonCauseFailureGroups: [{ ...group, total: sampledRate }] };
    expect(runReadiness(typedLaw, model(typedLaw), [], NO_SC).state).toBe("NO_INPUTS");
    const sharedLaw = { ...typedLaw, systemBasicEvents: typedLaw.systemBasicEvents.map((event) => (event.uuid === "event-a" || event.uuid === "event-b" ? { ...event, expression: sampledRate } : event)) };
    expect(runReadiness(sharedLaw, model(sharedLaw), [], NO_SC).state).toBe("READY");
  });
});
