import type { UncertainExpression } from "interfaces-mef-types/core/uncertainty";
import type { SuccessCriteriaDevelopment } from "interfaces-mef-types/sc/success-criteria-development";
import type { SystemsAnalysis } from "interfaces-mef-types/sy/systems-analysis";
import { fetchJson } from "../../api/client";
import { evaluateUncertainty } from "../../newly-developed-methods/shared/uncertaintyApi";
import { pointsOf } from "../../newly-developed-methods/shared/uncertaintyPoints";
import { praxisUncertainty } from "../../newly-developed-methods/shared/test/praxisUncertainty";
import { buildLinkedInputs, exampleScIds, loadExampleScMissionTimes } from "../syLinks";
import { syValueSources } from "../syMissionTimes";
import { SY_ANALYSIS } from "../../../../../backends/web-backend/src/example-workbooks/seeds/sy-seed";
import { SY_ANALYSIS_HTGR } from "../../../../../backends/web-backend/src/example-workbooks/seeds/sy-seed-htgr";
import { SC_ANALYSIS } from "../../../../../backends/web-backend/src/example-workbooks/seeds/sc-seed";
import { SC_ANALYSIS_HTGR } from "../../../../../backends/web-backend/src/example-workbooks/seeds/sc-seed-htgr";

jest.mock("../../api/client", () => ({ fetchJson: jest.fn() }));
jest.mock("../../newly-developed-methods/shared/uncertaintyApi", () => ({ evaluateUncertainty: jest.fn() }));

const EXAMPLE_SC = "example-sc-htgr";

function link(workbookId: string, entityId: string): UncertainExpression {
  return { node: "PARAMETER", reference: { referenceType: "WORKBOOK_PARAMETER", workbookId, entityId } };
}

function hours(value: number): UncertainExpression {
  return { node: "VALUE", value: { unit: "HOURS", law: { family: "POINT", value } } };
}

const SC_BUNDLE = {
  sc: {
    mef: {
      missionTimes: [{ uuid: "MT-DLOFC", eventSequenceReference: "ES-DLOFC-1", missionTime: hours(72), basis: "", safeStableStateAchievedWithinMissionTime: true, analysisReferences: [], implementsSrs: [] }],
      componentMissionTimes: [{ uuid: "CMT-1", componentId: "Battery", missionTime: hours(24), eventSequenceReference: "ES-DLOFC-1", analysisReferences: [], implementsSrs: [] }],
    } as Partial<SuccessCriteriaDevelopment>,
  },
};

const SY: Pick<SystemsAnalysis, "systemDefinitions" | "systemBasicEvents" | "commonCauseFailureGroups"> = {
  systemDefinitions: [
    { uuid: "SYS-RCCS", name: "RCCS", boundaries: [], successCriteriaIds: [], missionTime: link(EXAMPLE_SC, "MT-DLOFC"), modeledComponentsAndFailures: {}, informationBasis: "as-designed-as-intended", implementsSrs: [] },
  ],
  systemBasicEvents: [
    { uuid: "BE-BAT", code: "BAT", name: "Battery", eventType: "BASIC", failureMode: "FAILURE_TO_RUN", expression: { node: "MODEL", model: { form: "MISSION", rate: link("example-da-htgr", "DA-BE-241"), missionTime: link(EXAMPLE_SC, "CMT-1") } }, implementsSrs: [] },
  ],
  commonCauseFailureGroups: [],
};

describe("SY example SC mission time links", () => {
  beforeEach(() => {
    jest.mocked(evaluateUncertainty).mockImplementation(praxisUncertainty);
    jest.mocked(fetchJson).mockReset();
  });

  it("finds the example SC workbooks the systems and events link", () => {
    expect(exampleScIds(SY)).toEqual([EXAMPLE_SC]);
    expect(exampleScIds({ ...SY, systemDefinitions: [], systemBasicEvents: [] })).toEqual([]);
  });

  it("loads the example SC bundle and feeds its mission times to the options and the PRAXIS table", async () => {
    jest.mocked(fetchJson).mockResolvedValue(SC_BUNDLE);
    const examples = await loadExampleScMissionTimes(exampleScIds(SY));
    expect(fetchJson).toHaveBeenCalledWith("/api/example-workbooks/sc-bundle?example=htgr");

    const links = buildLinkedInputs({ ES: [], SC: [], POS: [], DA: [], HRA: [] }, {}, undefined, undefined, undefined, examples);
    expect(links?.scMissionTimeOptions.map((option) => option.label)).toEqual(["MT-DLOFC · sequence ES-DLOFC-1", "CMT-1 · Battery"]);
    expect(links?.scMissionTimeOptions.every((option) => option.reference.workbookId === EXAMPLE_SC && option.unit === "HOURS")).toBe(true);

    const sources = syValueSources([], links);
    expect(sources.label(`${EXAMPLE_SC}:MT-DLOFC`)).toBe("MT-DLOFC · sequence ES-DLOFC-1");
    const points = await pointsOf(
      SY.systemDefinitions.flatMap((system) => (system.missionTime === undefined ? [] : [{ key: system.uuid, expression: system.missionTime, unit: "HOURS" as const }])),
      sources.table,
    );
    expect(points.get("SYS-RCCS")).toBe(72);
  });

  it.each([
    ["sfr", SY_ANALYSIS, SC_ANALYSIS],
    ["htgr", SY_ANALYSIS_HTGR, SC_ANALYSIS_HTGR],
  ] as const)("resolves every %s example system mission time through PRAXIS", async (variant, sy, sc) => {
    expect(exampleScIds(sy)).toEqual([`example-sc-${variant}`]);
    jest.mocked(fetchJson).mockResolvedValue({ sc: { mef: sc } });
    const links = buildLinkedInputs({ ES: [], SC: [], POS: [], DA: [], HRA: [] }, {}, undefined, undefined, undefined, await loadExampleScMissionTimes(exampleScIds(sy)));
    const linked = sy.systemDefinitions.flatMap((system) => (system.missionTime === undefined ? [] : [{ key: system.uuid, expression: system.missionTime, unit: "HOURS" as const }]));
    expect(linked).toHaveLength(sy.systemDefinitions.length);
    const points = await pointsOf(linked, syValueSources([], links).table);
    expect(linked.filter((entry) => !points.has(entry.key)).map((entry) => entry.key)).toEqual([]);
  });

  it("keeps a missing example bundle out of the links", async () => {
    jest.mocked(fetchJson).mockRejectedValue(new Error("Not found"));
    expect(await loadExampleScMissionTimes([EXAMPLE_SC])).toEqual([]);
    expect(buildLinkedInputs({ ES: [], SC: [], POS: [], DA: [], HRA: [] }, {}, undefined, undefined, undefined, [])).toBeNull();
  });
});
