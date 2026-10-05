import { JSX, useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import type { DataAnalysisParameter } from "interfaces-mef-types/da/data-analysis";
import type { HumanReliabilityAnalysis } from "interfaces-mef-types/hr/human-reliability-analysis";
import type { PRAConfigurationControl } from "interfaces-mef-types/cross-cutting/pra-configuration-control";
import { HR_ANALYSIS } from "../../../../../backends/web-backend/src/example-workbooks/seeds/hr-seed";
import { daHepOptions, withImportedHep, withRecoveryHep, type HrDaHepOption } from "../hrDaLinks";
import { DrawerContent } from "../hrScreens2";
import { HrWorkbookProvider, type HrWorkbookData } from "../hrWorkbookContext";

function parameter(fields: Partial<DataAnalysisParameter> & Pick<DataAnalysisParameter, "uuid" | "parameterType">): DataAnalysisParameter {
  return { name: fields.uuid, valueType: "MEAN", implementsSrs: [], ...fields };
}

const OPTION: HrDaHepOption = { workbookId: "da-1", workbookName: "Plant DA", parameterId: "DA-RC-02", parameterName: "Decay heat removal not restored in time", value: 0.0496, valueType: "MEAN" };

let latest: HumanReliabilityAnalysis = HR_ANALYSIS;

function Harness({ hr, kind, id }: { hr: HumanReliabilityAnalysis; kind: "respquant" | "recovery"; id: string }): JSX.Element {
  const [data, setData] = useState<HrWorkbookData>({ hr, cc: {} as PRAConfigurationControl, nms: [], links: null, daHeps: [OPTION] });
  return (
    <HrWorkbookProvider data={data} editable={true} mutateHr={(mutator) => setData((previous) => {
      latest = mutator(previous.hr);
      return { ...previous, hr: latest };
    })}>
      <DrawerContent context={{ kind, id }} onClose={jest.fn()} />
    </HrWorkbookProvider>
  );
}

describe("HR links to DA probabilities", () => {
  it("offers HEPs and non-recovery probabilities, not the ones DA takes from HR", () => {
    const options = daHepOptions([{
      id: "da-1",
      name: "Plant DA",
      mef: {
        name: "Plant DA",
        parameters: [
          parameter({ uuid: "DA-HEP-01", parameterType: "HUMAN_ERROR_PROBABILITY", value: 3e-3, valueMode: "LINKED", valueLink: { element: "HRA", needId: "HR-POST-005" } }),
          parameter({ uuid: "DA-RC-02", parameterType: "PROBABILITY", value: 0.0496, quantificationModel: "NON_RECOVERY" }),
          parameter({ uuid: "DA-BE-01", parameterType: "PROBABILITY", value: 2e-3, quantificationModel: "DEMAND" }),
          parameter({ uuid: "DA-HEP-02", parameterType: "HUMAN_ERROR_PROBABILITY", value: 1e-2, valueType: "POINT_ESTIMATE" }),
        ],
      },
    }]);
    expect(options.map((option) => [option.parameterId, option.valueType])).toEqual([["DA-HEP-02", "POINT_ESTIMATE"], ["DA-RC-02", "MEAN"]]);
  });

  it("imports a mean or a point estimate and keeps the value when typing again", () => {
    const target = HR_ANALYSIS.hepQuantifications[0]!;
    const imported = withImportedHep(HR_ANALYSIS, target.uuid, OPTION).hepQuantifications.find((quantification) => quantification.uuid === target.uuid);
    expect(imported).toMatchObject({ meanHep: 0.0496, controlledDataSource: { referenceType: "WORKBOOK_PARAMETER", workbookId: "da-1", entityId: "DA-RC-02" } });
    const point = withImportedHep(HR_ANALYSIS, target.uuid, { ...OPTION, valueType: "POINT_ESTIMATE" }).hepQuantifications.find((quantification) => quantification.uuid === target.uuid);
    expect(point?.pointEstimateHep).toBe(0.0496);
    expect(point?.meanHep).toBeUndefined();
    const typed = withImportedHep({ ...HR_ANALYSIS, hepQuantifications: HR_ANALYSIS.hepQuantifications.map((quantification) => (quantification.uuid === target.uuid ? imported! : quantification)) }, target.uuid, undefined);
    expect(typed.hepQuantifications.find((quantification) => quantification.uuid === target.uuid)).toMatchObject({ meanHep: 0.0496, controlledDataSource: undefined });
  });

  it("adds the recovery HEP a recovery action names", () => {
    const recovery = HR_ANALYSIS.recoveryActions![0]!;
    const without = { ...HR_ANALYSIS, hepQuantifications: HR_ANALYSIS.hepQuantifications.filter((quantification) => quantification.uuid !== recovery.hepQuantificationId) };
    const added = withRecoveryHep(without, recovery.uuid);
    expect(added.hepQuantifications.find((quantification) => quantification.uuid === recovery.hepQuantificationId)).toMatchObject({ hfeId: recovery.hfeId, assessmentType: "DETAILED_ASSESSMENT" });
    expect(withRecoveryHep(added, recovery.uuid)).toBe(added);
  });

  it("lets a recovery HEP be typed or imported from DA", () => {
    const recovery = HR_ANALYSIS.recoveryActions![0]!;
    render(<Harness hr={HR_ANALYSIS} kind="recovery" id={recovery.uuid} />);
    expect(screen.getByRole("textbox", { name: "Recovery HEP basis" })).toBeInTheDocument();
    expect(screen.getByRole("spinbutton", { name: "Mean HEP" })).toBeInTheDocument();

    fireEvent.change(screen.getByRole("combobox", { name: "Value from" }), { target: { value: JSON.stringify(["da-1", "DA-RC-02"]) } });
    expect(latest.hepQuantifications.find((quantification) => quantification.uuid === recovery.hepQuantificationId)).toMatchObject({ meanHep: 0.0496, controlledDataSource: { entityId: "DA-RC-02" } });
    expect(screen.queryByRole("spinbutton", { name: "Mean HEP" })).toBeNull();
  });

  it("flags a DA value that changed under an imported response HEP", () => {
    const target = HR_ANALYSIS.hepQuantifications.find((quantification) => !(HR_ANALYSIS.recoveryActions ?? []).some((action) => action.hepQuantificationId === quantification.uuid))!;
    const held = { ...HR_ANALYSIS, hepQuantifications: HR_ANALYSIS.hepQuantifications.map((quantification) => (quantification.uuid === target.uuid ? { ...quantification, meanHep: 0.04, controlledDataSource: { referenceType: "WORKBOOK_PARAMETER" as const, workbookId: "da-1", entityId: "DA-RC-02" } } : quantification)) };
    render(<Harness hr={held} kind="respquant" id={target.uuid} />);
    expect(screen.getByRole("status")).toHaveTextContent("DA now gives");
    fireEvent.click(screen.getByRole("button", { name: "Apply DA value" }));
    expect(latest.hepQuantifications.find((quantification) => quantification.uuid === target.uuid)?.meanHep).toBe(0.0496);
  });
});
