import { render, screen } from "@testing-library/react";
import type { RadiologicalConsequenceAnalysis } from "interfaces-mef-types/rc/radiological-consequence-analysis";
import { rcWithLinkedData, type RcLinkedData } from "interfaces-shared-types/rc-workbooks/linked-data";
import {
  ES_ANALYSIS_HCL,
  RC_ANALYSIS_HCL,
} from "../../../../../backends/web-backend/src/example-workbooks/seeds/hcl-case-study-seed";
import { RcInterfaces } from "../../rc-workbooks/rcScreens";
import { RcWorkbookProvider } from "../../rc-workbooks/rcWorkbookContext";

describe("controlled ES to RC connection", () => {
  it("maps a controlled ES family into an RC release category from the link alone", () => {
    const source = JSON.parse(JSON.stringify(RC_ANALYSIS_HCL)) as RadiologicalConsequenceAnalysis;
    const saved: RadiologicalConsequenceAnalysis = {
      ...source,
      linkedWorkbooks: { ES: "es-workbook" },
      releaseCategoryToConsequence: {
        ...source.releaseCategoryToConsequence,
        releaseCategoryInputs: source.releaseCategoryToConsequence.releaseCategoryInputs.map((input) => ({ releaseCategory: input.releaseCategory, releaseCharacteristics: input.releaseCharacteristics })),
      },
    };
    const linked: RcLinkedData = { es: { workbookId: "es-workbook", analysis: ES_ANALYSIS_HCL } };
    const rc = rcWithLinkedData(saved, linked);
    render(
      <RcWorkbookProvider
        data={{ rc, cc: {} as never, nms: [] }}
        editable
        links={{ options: { ES: [], MS: [], RI: [] }, es: ES_ANALYSIS_HCL }}
        linked={linked}
        mutateRc={jest.fn()}
      >
        <RcInterfaces openDrawer={jest.fn()} />
      </RcWorkbookProvider>,
    );

    expect(screen.getByLabelText("Release category for ESF-HCL-CD")).toHaveValue("RC-CORE-DAMAGE");
    expect(rc.releaseCategoryToConsequence.releaseCategoryInputs.find((input) => input.releaseCategory === "RC-CORE-DAMAGE")?.eventSequenceFamilyReferences).toEqual([{
      referenceType: "EVENT_SEQUENCE_FAMILY",
      workbookId: "es-workbook",
      entityId: "ESF-HCL-CD",
    }]);
  });
});
