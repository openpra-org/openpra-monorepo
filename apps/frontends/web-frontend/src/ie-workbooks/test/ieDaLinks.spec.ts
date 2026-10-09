import { FrequencyUnit } from "interfaces-mef-types/core/events";
import type { UncertainExpression } from "interfaces-mef-types/core/uncertainty";
import type { DataAnalysisParameter } from "interfaces-mef-types/da/data-analysis";
import type { InitiatingEventsAnalysis } from "interfaces-mef-types/ie/initiating-event-analysis";
import { IE_ANALYSIS } from "../../../../../backends/web-backend/src/example-workbooks/seeds/ie-seed";
import { evaluateUncertainty } from "../../newly-developed-methods/shared/uncertaintyApi";
import { peekExpression, requestExpression } from "../../newly-developed-methods/shared/useUncertainty";
import { praxisUncertainty, settledWithPraxis } from "../../newly-developed-methods/shared/test/praxisUncertainty";
import { frequencyQuery } from "../../newly-developed-methods/ie-frequency-quantification/frequencyValues";
import { daFrequencyOptions, daParameterTable, heldDiffers, withImportedFrequency, withTypedGroupFrequency, type IeDaFrequencyOption } from "../ieDaLinks";

jest.mock("../../newly-developed-methods/shared/uncertaintyApi", () => ({ evaluateUncertainty: jest.fn() }));

beforeEach(() => {
  jest.mocked(evaluateUncertainty).mockImplementation(praxisUncertainty);
});

function perYear(law: Extract<UncertainExpression, { node: "VALUE" }>["value"]["law"]): UncertainExpression {
  return { node: "VALUE", value: { unit: "PER_YEAR", law } };
}

const LOGNORMAL = perYear({ family: "LOGNORMAL", mean: 0.042, errorFactor: 3, level: 0.95 });

const OPTION: IeDaFrequencyOption = { workbookId: "example-da-htgr", workbookName: "Generic HTGR DA", parameterId: "DA-IE-01", parameterName: "Loss of offsite power", estimate: LOGNORMAL };

function parameter(fields: Partial<DataAnalysisParameter> & Pick<DataAnalysisParameter, "uuid" | "parameterType">): DataAnalysisParameter {
  return { name: fields.uuid, implementsSrs: [], ...fields };
}

function typedFixture(): { ie: InitiatingEventsAnalysis; groupId: string } {
  const quantified = new Set(IE_ANALYSIS.quantifications.map((quantification) => quantification.initiatorOrGroupId));
  const group = IE_ANALYSIS.initiatingEventGroups.find((candidate) => quantified.has(candidate.uuid));
  if (group === undefined) throw new Error("The IE example has no quantified group.");
  const typed = { expression: perYear({ family: "LOGNORMAL", mean: 0.03, errorFactor: 5, level: 0.95 }), basis: FrequencyUnit.PER_PLANT_YEAR };
  return {
    ie: {
      ...IE_ANALYSIS,
      initiatingEventGroups: IE_ANALYSIS.initiatingEventGroups.map((candidate) => {
        const { controlledDataSource: _link, ...rest } = candidate;
        return { ...rest, frequency: typed };
      }),
      quantifications: IE_ANALYSIS.quantifications.map((quantification) => ({ ...quantification, frequency: typed })),
    },
    groupId: group.uuid,
  };
}

async function praxisMean(expression: UncertainExpression, options: readonly IeDaFrequencyOption[]): Promise<number> {
  const query = frequencyQuery(expression, daParameterTable(options));
  requestExpression(query);
  const state = await settledWithPraxis(() => peekExpression(query));
  if (state.status !== "ready") throw new Error(state.status === "failed" ? state.error : "PRAXIS gave no answer.");
  return state.value.point;
}

describe("IE links to DA frequencies", () => {
  it("offers DA frequency estimates except the ones DA takes from IE", () => {
    const gamma = perYear({ family: "GAMMA", shape: 1.8, rate: 58 });
    const options = daFrequencyOptions([{
      id: "da-1",
      name: "",
      mef: {
        name: "Plant DA",
        parameters: [
          parameter({ uuid: "DA-IE-01", parameterType: "FREQUENCY", quantificationModel: "FREQUENCY", estimate: gamma }),
          parameter({ uuid: "DA-IE-02", parameterType: "FREQUENCY", quantificationModel: "FREQUENCY", estimate: gamma, valueMode: "LINKED", valueLink: { element: "IE", needId: "IEG-02" } }),
          parameter({ uuid: "DA-BE-01", parameterType: "PROBABILITY", quantificationModel: "DEMAND_PROBABILITY", estimate: { node: "VALUE", value: { unit: "PROBABILITY", law: { family: "POINT", value: 3e-3 } } } }),
          parameter({ uuid: "DA-IE-03", parameterType: "FREQUENCY", quantificationModel: "FREQUENCY" }),
        ],
      },
    }]);
    expect(options).toEqual([{ workbookId: "da-1", workbookName: "Plant DA", parameterId: "DA-IE-01", parameterName: "DA-IE-01", estimate: gamma }]);
  });

  it("links a DA estimate by reference and keeps the full law when it goes back to typing", async () => {
    const { ie, groupId } = typedFixture();
    const imported = withImportedFrequency(ie, groupId, OPTION, [OPTION]);
    const group = imported.initiatingEventGroups.find((candidate) => candidate.uuid === groupId);
    const reference = { referenceType: "WORKBOOK_PARAMETER", workbookId: "example-da-htgr", entityId: "DA-IE-01" };
    expect(group?.controlledDataSource).toEqual(reference);
    expect(group?.frequency).toEqual({ expression: { node: "PARAMETER", reference }, basis: FrequencyUnit.PER_PLANT_YEAR });
    expect(imported.quantifications.find((quantification) => quantification.initiatorOrGroupId === groupId)?.frequency).toEqual(group?.frequency);
    const linked = group?.frequency?.expression;
    if (linked === undefined) throw new Error("The import gave no frequency.");
    expect(await praxisMean(linked, [OPTION])).toBeCloseTo(0.042, 12);

    const typed = withImportedFrequency(imported, groupId, undefined, [OPTION]);
    const released = typed.initiatingEventGroups.find((candidate) => candidate.uuid === groupId);
    expect(released?.controlledDataSource).toBeUndefined();
    expect(released?.frequency).toEqual({ expression: LOGNORMAL, basis: FrequencyUnit.PER_PLANT_YEAR });
    expect(typed.quantifications.find((quantification) => quantification.initiatorOrGroupId === groupId)?.frequency).toEqual(released?.frequency);
  });

  it("keeps a DA posterior law intact through import and release", async () => {
    const { ie, groupId } = typedFixture();
    const posterior = perYear({ family: "POSTERIOR", prior: { family: "GAMMA", shape: 0.5, rate: 2 }, evidence: [{ likelihood: "POISSON", failures: 3, exposure: 12 }] });
    const option: IeDaFrequencyOption = { ...OPTION, parameterId: "DA-IE-09", estimate: posterior };
    const released = withImportedFrequency(withImportedFrequency(ie, groupId, option, [option]), groupId, undefined, [option]);
    const group = released.initiatingEventGroups.find((candidate) => candidate.uuid === groupId);
    expect(group?.frequency?.expression).toEqual(posterior);
    expect(await praxisMean(posterior, [])).toBeCloseTo(3.5 / 14, 9);
  });

  it("flags a held copy that differs from the DA estimate", () => {
    const { ie, groupId } = typedFixture();
    const group = withImportedFrequency(ie, groupId, OPTION, [OPTION]).initiatingEventGroups.find((candidate) => candidate.uuid === groupId);
    expect(heldDiffers(group, OPTION)).toBe(false);
    const copy = { expression: perYear({ level: 0.95, errorFactor: 3, mean: 0.042, family: "LOGNORMAL" }), basis: FrequencyUnit.PER_PLANT_YEAR };
    expect(heldDiffers(group === undefined ? undefined : { ...group, frequency: copy }, OPTION)).toBe(false);
    const wider = { expression: perYear({ family: "LOGNORMAL", mean: 0.042, errorFactor: 10, level: 0.95 }), basis: FrequencyUnit.PER_PLANT_YEAR };
    expect(heldDiffers(group === undefined ? undefined : { ...group, frequency: wider }, OPTION)).toBe(true);
    expect(heldDiffers(undefined, OPTION)).toBe(true);
  });

  it("copies a typed quantification to the group and leaves an imported group alone", () => {
    const { ie, groupId } = typedFixture();
    const point = { expression: perYear({ family: "POINT", value: 0.5 }), basis: FrequencyUnit.PER_REACTOR_YEAR };
    const edited: InitiatingEventsAnalysis = { ...ie, quantifications: ie.quantifications.map((quantification) => (quantification.initiatorOrGroupId === groupId ? { ...quantification, frequency: point } : quantification)) };
    const synced = withTypedGroupFrequency(edited, groupId).initiatingEventGroups.find((candidate) => candidate.uuid === groupId);
    expect(synced?.frequency).toEqual(point);

    const held = withImportedFrequency(edited, groupId, OPTION, [OPTION]);
    const reedited: InitiatingEventsAnalysis = { ...held, quantifications: held.quantifications.map((quantification) => (quantification.initiatorOrGroupId === groupId ? { ...quantification, frequency: point } : quantification)) };
    expect(withTypedGroupFrequency(reedited, groupId)).toBe(reedited);
  });
});
