import { fireEvent, render, screen } from "@testing-library/react";
import type { RadiologicalConsequenceAnalysis } from "interfaces-mef-types/rc/radiological-consequence-analysis";
import type { RiskIntegration } from "interfaces-mef-types/ri/risk-integration";
import {
  ES_ANALYSIS_HCL,
  ESQ_ANALYSIS_HCL,
  RC_ANALYSIS_HCL,
  RI_ANALYSIS_HCL,
} from "../../../../../backends/web-backend/src/example-workbooks/seeds/hcl-case-study-seed";
import { QuantifyScreen } from "../../rc-workbooks/rcScreens3";
import { RcWorkbookProvider } from "../../rc-workbooks/rcWorkbookContext";
import { IntegrateScreen } from "../../ri-workbooks/riScreens";
import { RiWorkbookProvider } from "../../ri-workbooks/riWorkbookContext";
import type {
  EventSequenceFamilySource,
  RiRiskSources,
} from "../riskWorkbookConnections";

const familySources: EventSequenceFamilySource[] = ES_ANALYSIS_HCL.eventSequenceFamilies.map((family) => ({
  workbookId: "es-workbook",
  workbookName: "Event Sequence workbook",
  family,
  reference: { referenceType: "EVENT_SEQUENCE_FAMILY", workbookId: "es-workbook", entityId: family.uuid },
}));

const riskSources: RiRiskSources = {
  eventSequenceFamilies: familySources,
  familyQuantifications: ESQ_ANALYSIS_HCL.familyQuantifications.map((quantification) => ({
    workbookId: "esq-workbook",
    workbookName: "Event Sequence Quantification workbook",
    quantification,
    reference: {
      referenceType: "EVENT_SEQUENCE_FAMILY_QUANTIFICATION",
      workbookId: "esq-workbook",
      entityId: quantification.uuid,
    },
  })),
  consequenceResults: RC_ANALYSIS_HCL.consequenceQuantification.eventSequenceConsequences.map((result) => ({
    workbookId: "rc-workbook",
    workbookName: "Radiological Consequence workbook",
    result: { ...result, uuid: result.uuid! },
    reference: {
      referenceType: "RADIOLOGICAL_CONSEQUENCE_RESULT",
      workbookId: "rc-workbook",
      entityId: result.uuid!,
    },
  })),
};

describe("controlled ES/ESQ/RC/RI connections", () => {
  it("adds an RC consequence row from a controlled ES family source", () => {
    const source = JSON.parse(JSON.stringify(RC_ANALYSIS_HCL)) as RadiologicalConsequenceAnalysis;
    let rc: RadiologicalConsequenceAnalysis = {
      ...source,
      consequenceQuantification: {
        ...source.consequenceQuantification,
        eventSequenceConsequences: [],
      },
    };
    render(
      <RcWorkbookProvider
        data={{ rc, cc: {} as never, nms: [] }}
        editable
        eventSequenceFamilySources={familySources}
        mutateRc={(mutator) => { rc = mutator(rc); }}
      >
        <QuantifyScreen openDrawer={jest.fn()} />
      </RcWorkbookProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: /add linked family/i }));

    expect(rc.consequenceQuantification.eventSequenceConsequences[0]).toEqual(expect.objectContaining({
      eventSequenceFamily: "ESF-HCL-CD",
      eventSequenceFamilyReference: {
        referenceType: "EVENT_SEQUENCE_FAMILY",
        workbookId: "es-workbook",
        entityId: "ESF-HCL-CD",
      },
      releaseCategoryReference: "RC-CORE-DAMAGE",
    }));
  });

  it("adds a fully linked RI input and recalculates the integrated result", () => {
    const source = JSON.parse(JSON.stringify(RI_ANALYSIS_HCL)) as RiskIntegration;
    let ri: RiskIntegration = {
      ...source,
      compiledRiskInputs: [],
      integratedRiskResults: {
        ...source.integratedRiskResults,
        metrics: RI_ANALYSIS_HCL.integratedRiskResults.metrics.map((metric) => ({ ...metric, value: 0 })),
      },
    };
    render(
      <RiWorkbookProvider
        data={{ ri, cc: {} as never, nms: [] }}
        editable
        riskSources={riskSources}
        mutateRi={(mutator) => { ri = mutator(ri); }}
      >
        <IntegrateScreen ccId="cc-ii" openDrawer={jest.fn()} />
      </RiWorkbookProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: /add linked input/i }));

    expect(ri.compiledRiskInputs[0]).toEqual(expect.objectContaining({
      eventSequenceFamilyRef: "ESF-HCL-CD",
      familyQuantificationReferences: [{
        referenceType: "EVENT_SEQUENCE_FAMILY_QUANTIFICATION",
        workbookId: "esq-workbook",
        entityId: "EFQ-HCL-CD",
      }],
      consequenceResultReference: {
        referenceType: "RADIOLOGICAL_CONSEQUENCE_RESULT",
        workbookId: "rc-workbook",
        entityId: "RCQ-HCL-CD",
      },
    }));
    expect(ri.integratedRiskResults.metrics[0]!.value).toBeCloseTo(2.82e-6, 12);
  });
});
