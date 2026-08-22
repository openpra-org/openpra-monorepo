import { fetchJson } from "../../api/client";
import { fetchSeismicPraLinkedInputs, seismicPraVariant } from "../seismicPraWorkbookApi";

jest.mock("../../api/client", () => ({
  deleteJson: jest.fn(),
  fetchJson: jest.fn(),
  patchJson: jest.fn(),
  postJson: jest.fn(),
  postMultipart: jest.fn(),
}));

const mockFetchJson = fetchJson as jest.MockedFunction<typeof fetchJson>;

function mockLinkedBundles(variant: "htgr" | "sfr"): void {
  const isSfr = variant === "sfr";
  mockFetchJson.mockImplementation((url) => {
    const path = String(url);
    if (path.includes("/pos-bundle")) return Promise.resolve({ pos: { mef: {
      plantOperatingStates: [
        { uuid: "POS-01", name: isSfr ? "SFR full power" : "HTGR full power", operatingMode: "POWER", meanDurationHours: 7000, radioactiveMaterialSources: [{ name: isSfr ? "Metallic fuel" : "TRISO fuel" }] },
        { uuid: "POS-X", name: "Screened state", operatingMode: "SHUTDOWN", meanDurationHours: 10 },
      ],
      screeningRecords: [{ posId: "POS-X", retained: false }],
    } } });
    if (path.includes("/ie-bundle")) return Promise.resolve({ ie: { mef: {
      initiatingEventGroups: [{ uuid: "IEG-01", name: "Loss of cooling", meanFrequency: isSfr ? 0.79 : { value: 2.943 }, applicableStates: ["POS-01"], riskImportance: "HIGH" }],
    } } });
    if (path.includes("/es-bundle")) return Promise.resolve({ es: { mef: {
      eventSequenceFamilies: [{ uuid: "ESF-01", name: "Safe state", endState: "SUCCESSFUL_MITIGATION", memberSequenceIds: ["ES-1", "ES-2"] }],
    } } });
    if (path.includes("/sc-bundle")) return Promise.resolve({ sc: { mef: {
      missionTimes: [{ uuid: "MT-01", eventSequenceReference: "ES-1", missionTimeHours: isSfr ? 96 : 72, isRiskSignificant: true }],
    } } });
    if (path.includes("/sy-bundle")) return Promise.resolve({ sy: { mef: {
      systemDefinitions: [{ uuid: "SYS-01", name: isSfr ? "DRACS" : "RCCS", missionTimeHours: 24, applicablePlantOperatingStates: ["POS-01"] }],
      systemBasicEvents: [
        { uuid: "BE-01", name: "Pump failure" },
        { uuid: "BE-02", name: "Valve failure" },
        { uuid: "BE-03", name: "Power failure" },
      ],
      systemLogicModels: [{
        systemReference: "SYS-01",
        faultTree: {
          id: "GATE-01",
          type: "OR",
          name: "System unavailable",
          children: [
            { id: "REF-01", type: "BE", basicEventId: "BE-01" },
            { id: "REF-02", type: "BE", basicEventId: "BE-02" },
            { id: "REF-03", type: "BE", basicEventId: "BE-03" },
          ],
        },
      }],
    } } });
    if (path.includes("/hr-bundle")) return Promise.resolve({ hr: { mef: {
      humanFailureEvents: [{ uuid: "HFE-01", name: "Local action", hfeTiming: "POST_INITIATOR", affectedSystems: ["SYS-01"] }],
      hepQuantifications: [{ hfeId: "HFE-01", meanHep: isSfr ? 0.08 : 0.045 }],
    } } });
    if (path.includes("/da-bundle")) return Promise.resolve({ da: { mef: {
      parameters: [{ uuid: "DA-01", name: "Component failure", parameterType: "PROBABILITY", value: isSfr ? 0.008 : 0.002, basicEventRef: "BE-01", systemReference: "SYS-01" }],
    } } });
    return Promise.reject(new Error(`Unexpected URL ${path}`));
  });
}

describe("Seismic PRA linked inputs", () => {
  beforeEach(() => {
    mockFetchJson.mockReset();
  });

  it.each(["htgr", "sfr"] as const)("loads and maps the %s technical-element bundles", async (variant) => {
    mockLinkedBundles(variant);

    const links = await fetchSeismicPraLinkedInputs(variant);

    expect(mockFetchJson).toHaveBeenCalledTimes(7);
    expect(links.variant).toBe(variant);
    expect(mockFetchJson.mock.calls.every(([url]) => String(url).endsWith(`?example=${variant}`))).toBe(true);
    expect(links.posStates).toHaveLength(1);
    expect(links.posStates[0].name).toContain(variant === "sfr" ? "SFR" : "HTGR");
    expect(links.posStates[0].materialSources).toEqual([variant === "sfr" ? "Metallic fuel" : "TRISO fuel"]);
    expect(links.ieGroups[0].meanFrequency).toBe(variant === "sfr" ? 0.79 : 2.943);
    expect(links.esFamilies[0].memberCount).toBe(2);
    expect(links.scMissionTimes[0].hours).toBe(variant === "sfr" ? 96 : 72);
    expect(links.sySystems[0].basicEventCount).toBe(3);
    expect(links.hrActions[0].humanErrorProbability).toBe(variant === "sfr" ? 0.08 : 0.045);
    expect(links.daParameters[0].basicEvent).toBe("BE-01");
  });

  it("recognizes loaded examples and cloned example baselines", () => {
    expect(seismicPraVariant({ uuid: "SEISMIC-PRA-HTGR" })).toBe("htgr");
    expect(seismicPraVariant({ uuid: "SEISMIC-PRA-SFR" })).toBe("sfr");
    expect(seismicPraVariant({
      uuid: "cloned-workbook",
      baselinePra: {
        modelName: "MHTGR PRA model basis",
        modelReference: "DOE-HTGR-86-011",
        sourceEvidenceRef: "",
        revision: "3",
        freezeDate: "1987-01-01",
        freezeStatus: "REFERENCE_ONLY",
        modelBoundary: "",
        nonSeismicHazardModelRefs: [],
        recordTreatments: [],
        unresolvedInterfaces: [],
      },
    })).toBe("htgr");
    expect(seismicPraVariant({ uuid: "blank-workbook" })).toBeNull();
  });
});
