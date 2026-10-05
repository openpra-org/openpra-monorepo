import { DistributionType, FrequencyUnit } from "interfaces-mef-types/core/events";
import type { DataAnalysisParameter } from "interfaces-mef-types/da/data-analysis";
import type { InitiatingEventsAnalysis } from "interfaces-mef-types/ie/initiating-event-analysis";
import { IE_ANALYSIS } from "../../../../../backends/web-backend/src/example-workbooks/seeds/ie-seed";
import { daFrequencyOptions, withImportedFrequency, withTypedGroupFrequency } from "../ieDaLinks";

function parameter(fields: Partial<DataAnalysisParameter> & Pick<DataAnalysisParameter, "uuid" | "parameterType">): DataAnalysisParameter {
  return { name: fields.uuid, valueType: "MEAN", implementsSrs: [], ...fields };
}

function typedFixture(): { ie: InitiatingEventsAnalysis; groupId: string } {
  const quantified = new Set(IE_ANALYSIS.quantifications.map((quantification) => quantification.initiatorOrGroupId));
  const group = IE_ANALYSIS.initiatingEventGroups.find((candidate) => quantified.has(candidate.uuid));
  if (group === undefined) throw new Error("The IE example has no quantified group.");
  return {
    ie: { ...IE_ANALYSIS, initiatingEventGroups: IE_ANALYSIS.initiatingEventGroups.map((candidate) => ({ ...candidate, controlledDataSource: undefined })) },
    groupId: group.uuid,
  };
}

describe("IE links to DA frequencies", () => {
  it("offers DA frequencies except the ones DA takes from IE", () => {
    const options = daFrequencyOptions([{
      id: "da-1",
      name: "",
      mef: {
        name: "Plant DA",
        parameters: [
          parameter({ uuid: "DA-IE-01", parameterType: "FREQUENCY", value: 0.031, uncertainty: { distribution: { type: DistributionType.GAMMA, shape: 1.8, rate: 58 } } }),
          parameter({ uuid: "DA-IE-02", parameterType: "FREQUENCY", value: 2e-3, valueMode: "LINKED", valueLink: { element: "IE", needId: "IEG-02" } }),
          parameter({ uuid: "DA-BE-01", parameterType: "PROBABILITY", value: 3e-3 }),
          parameter({ uuid: "DA-IE-03", parameterType: "FREQUENCY" }),
        ],
      },
    }]);
    expect(options).toEqual([{
      workbookId: "da-1",
      workbookName: "Plant DA",
      parameterId: "DA-IE-01",
      parameterName: "DA-IE-01",
      value: 0.031,
      distribution: { type: DistributionType.GAMMA, shape: 1.8, rate: 58 },
    }]);
  });

  it("imports a DA estimate into the group and its quantification, then hands it back to typing", () => {
    const { ie, groupId } = typedFixture();
    const option = { workbookId: "example-htgr", workbookName: "Generic HTGR DA", parameterId: "DA-IE-01", parameterName: "Loss of offsite power", value: 0.042, distribution: { type: DistributionType.LOGNORMAL as const, median: 0.03, errorFactor: 3 } };
    const imported = withImportedFrequency(ie, groupId, option);
    const group = imported.initiatingEventGroups.find((candidate) => candidate.uuid === groupId);
    expect(group?.controlledDataSource).toEqual({ referenceType: "WORKBOOK_PARAMETER", workbookId: "example-htgr", entityId: "DA-IE-01" });
    expect(group?.meanFrequency).toEqual(expect.objectContaining({ value: 0.042, distribution: { type: DistributionType.LOGNORMAL, parameters: [0.03, 3] } }));
    expect(imported.quantifications.find((quantification) => quantification.initiatorOrGroupId === groupId)?.meanFrequency).toEqual(group?.meanFrequency);

    const typed = withImportedFrequency(imported, groupId, undefined);
    const released = typed.initiatingEventGroups.find((candidate) => candidate.uuid === groupId);
    expect(released?.controlledDataSource).toBeUndefined();
    expect(released?.meanFrequency).toEqual(group?.meanFrequency);
  });

  it("copies a typed quantification to the group and leaves an imported group alone", () => {
    const { ie, groupId } = typedFixture();
    const edited: InitiatingEventsAnalysis = { ...ie, quantifications: ie.quantifications.map((quantification) => (quantification.initiatorOrGroupId === groupId ? { ...quantification, meanFrequency: 0.5 } : quantification)) };
    const synced = withTypedGroupFrequency(edited, groupId).initiatingEventGroups.find((candidate) => candidate.uuid === groupId);
    expect(synced?.meanFrequency).toEqual(expect.objectContaining({ value: 0.5 }));
    expect(typeof synced?.meanFrequency).toBe("object");

    const held: InitiatingEventsAnalysis = { ...edited, initiatingEventGroups: edited.initiatingEventGroups.map((candidate) => (candidate.uuid === groupId ? { ...candidate, meanFrequency: { value: 0.042, units: FrequencyUnit.PER_PLANT_YEAR }, controlledDataSource: { referenceType: "WORKBOOK_PARAMETER", workbookId: "da-1", entityId: "DA-IE-01" } } : candidate)) };
    expect(withTypedGroupFrequency(held, groupId)).toBe(held);
  });
});
