import { JSX, useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import type { UncertainExpression } from "interfaces-mef-types/core/uncertainty";
import type { DataAnalysisParameter } from "interfaces-mef-types/da/data-analysis";
import type { HumanReliabilityAnalysis } from "interfaces-mef-types/hr/human-reliability-analysis";
import type { PRAConfigurationControl } from "interfaces-mef-types/cross-cutting/pra-configuration-control";
import { HR_ANALYSIS } from "../../../../../backends/web-backend/src/example-workbooks/seeds/hr-seed";
import { daHepOptions, withRecoveryHep, type HrDaHepOption } from "../hrDaLinks";
import { DrawerContent } from "../hrScreens2";
import { HrWorkbookProvider, type HrWorkbookData } from "../hrWorkbookContext";

const NON_RECOVERY: UncertainExpression = { node: "VALUE", value: { unit: "PROBABILITY", law: { family: "BETA", alpha: 2.5, beta: 47.9, lower: 0, upper: 1 } } };

function parameter(fields: Partial<DataAnalysisParameter> & Pick<DataAnalysisParameter, "uuid" | "parameterType">): DataAnalysisParameter {
  return { name: fields.uuid, valueType: "MEAN", implementsSrs: [], ...fields };
}

const OPTION: HrDaHepOption = { workbookId: "da-1", workbookName: "Plant DA", parameterId: "DA-RC-02", parameterName: "Decay heat removal not restored in time", law: NON_RECOVERY };

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

describe("HR HEPs as laws", () => {
  it("offers the DA laws of HEPs and non-recovery estimates, not the ones DA takes from HR", () => {
    const options = daHepOptions([{
      id: "da-1",
      name: "Plant DA",
      mef: {
        name: "Plant DA",
        parameters: [
          parameter({ uuid: "DA-HEP-01", parameterType: "HUMAN_ERROR_PROBABILITY", value: 3e-3, valueMode: "LINKED", valueLink: { element: "HRA", needId: "HR-POST-005" } }),
          parameter({ uuid: "DA-RC-02", parameterType: "PROBABILITY", quantificationModel: "NON_RECOVERY", estimate: NON_RECOVERY }),
          parameter({ uuid: "DA-BE-01", parameterType: "PROBABILITY", value: 2e-3, quantificationModel: "DEMAND_PROBABILITY" }),
          parameter({ uuid: "DA-HEP-02", parameterType: "HUMAN_ERROR_PROBABILITY", value: 1e-2, valueType: "POINT_ESTIMATE" }),
        ],
      },
    }]);
    expect(options.map((option) => [option.parameterId, option.law])).toEqual([
      ["DA-HEP-02", { node: "VALUE", value: { unit: "PROBABILITY", law: { family: "POINT", value: 1e-2 } } }],
      ["DA-RC-02", NON_RECOVERY],
    ]);
  });

  it("adds the recovery HEP a recovery action names", () => {
    const recovery = HR_ANALYSIS.recoveryActions![0]!;
    const without = { ...HR_ANALYSIS, hepQuantifications: HR_ANALYSIS.hepQuantifications.filter((quantification) => quantification.uuid !== recovery.hepQuantificationId) };
    const added = withRecoveryHep(without, recovery.uuid);
    expect(added.hepQuantifications.find((quantification) => quantification.uuid === recovery.hepQuantificationId)).toMatchObject({ hfeId: recovery.hfeId, assessmentType: "DETAILED_ASSESSMENT" });
    expect(withRecoveryHep(added, recovery.uuid)).toBe(added);
  });

  it("links a recovery HEP to the DA law and keeps the law, not a copied mean", () => {
    const recovery = HR_ANALYSIS.recoveryActions![0]!;
    render(<Harness hr={HR_ANALYSIS} kind="recovery" id={recovery.uuid} />);
    expect(screen.getByRole("textbox", { name: "Recovery HEP basis" })).toBeInTheDocument();
    fireEvent.change(screen.getByRole("combobox", { name: "Source" }), { target: { value: "da-1:DA-RC-02" } });
    expect(latest.hepQuantifications.find((quantification) => quantification.uuid === recovery.hepQuantificationId)?.hep).toEqual({ node: "PARAMETER", reference: { referenceType: "WORKBOOK_PARAMETER", workbookId: "da-1", entityId: "DA-RC-02" } });
    expect(screen.getByRole("status")).toHaveTextContent("DA gives Beta");
  });
});
