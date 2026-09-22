import { DistributionType } from "interfaces-mef-types/core/events";
import type { SystemsAnalysis } from "interfaces-mef-types/sy/systems-analysis";
import type { SyControlledParameterOption } from "../syWorkbookContext";
import { distributionIssues, linkedModelInputs } from "../syUncertainty";

const sy = {
  systemLogicModels: [{ uuid: "model-1", systemReference: "system-1", topGate: { gateId: "top" },
    leafNodes: [
      { id: "leaf-a", kind: "BASIC_EVENT_REFERENCE", basicEventId: "event-a" },
      { id: "leaf-b", kind: "BASIC_EVENT_REFERENCE", basicEventId: "event-b" },
    ] }],
  systemBasicEvents: [
    { uuid: "event-a", code: "PUMP-A", failureMode: "FAILURE_TO_START", controlledDataSource: { referenceType: "WORKBOOK_PARAMETER", workbookId: "da-1", entityId: "p-a" } },
    { uuid: "event-b", code: "PUMP-B", failureMode: "FAILURE_TO_START" },
  ],
  commonCauseFailureGroups: [],
} as unknown as SystemsAnalysis;
const parameters: SyControlledParameterOption[] = [{ workbookId: "da-1", workbookName: "DA", parameterId: "p-a", parameterName: "Pump A", parameterType: "PROBABILITY", value: 0.02,
  uncertainty: { type: DistributionType.BETA, alpha: 2, betaParam: 98 } }];

describe("SY linked DA uncertainty", () => {
  it("scopes a DA distribution to the fault tree's referenced basic event", () => {
    const inputs = linkedModelInputs(sy, sy.systemLogicModels[0]!, parameters);
    expect(inputs.map(({ event }) => event.code)).toEqual(["PUMP-A"]);
    expect(inputs[0]?.issues).toEqual([]);
  });

  it("reports invalid DA parameters before a solver run", () => {
    expect(distributionIssues({ type: DistributionType.BETA, alpha: 0, betaParam: 10 })).toContain("Beta alpha and beta must be positive.");
    expect(distributionIssues({ type: DistributionType.UNIFORM, lower: 0.4, upper: 0.2 })).toContain("Uniform bounds must satisfy 0 ≤ lower < upper ≤ 1.");
    expect(distributionIssues({ type: DistributionType.WEIBULL, scale: 2, shape: 2, location: 0 })).toContain("The weibull distribution is not supported for fault-tree sampling.");
  });

  it("flags a CCF member distribution that expansion would drop", () => {
    const withCcf = structuredClone(sy);
    withCcf.commonCauseFailureGroups = [{ members: { basicEvents: [{ id: "event-a" }, { id: "event-b" }] } }] as SystemsAnalysis["commonCauseFailureGroups"];
    expect(linkedModelInputs(withCcf, withCcf.systemLogicModels[0]!, parameters)[0]?.issues.join(" ")).toContain("CCF expansion cannot propagate");
  });
});
