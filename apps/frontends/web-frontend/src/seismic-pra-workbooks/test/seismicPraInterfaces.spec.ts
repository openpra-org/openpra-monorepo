import { createSeismicPraExample } from "../../../../../backends/web-backend/src/example-workbooks/seeds/seismic-pra-seed-factory";
import { seismicPraInterfaceLanes } from "../seismicPraInterfaces";
import { type SeismicPraLinkedInputs, type SeismicPraVariant } from "../seismicPraWorkbookContext";

function linkedInputs(variant: SeismicPraVariant): SeismicPraLinkedInputs {
  const isSfr = variant === "sfr";
  return {
    variant,
    posStates: [{
      id: "POS-01",
      name: isSfr ? "SFR full power" : "HTGR full power",
      mode: "POWER",
      durationHours: isSfr ? 6000 : 7300,
      materialSources: [isSfr ? "Metallic driver fuel" : "TRISO fuel"],
    }, {
      id: "POS-02",
      name: "Shutdown",
      mode: "SHUTDOWN",
      durationHours: isSfr ? 2000 : 1000,
      materialSources: ["Spent fuel"],
    }],
    ieGroups: [{
      id: "IEG-01",
      name: isSfr ? "Loss of primary flow" : "Loss of forced cooling",
      meanFrequency: isSfr ? 0.79 : 2.943,
      applicableStates: ["POS-01", "POS-02"],
      riskImportance: "HIGH",
    }],
    esFamilies: [{
      id: "ESF-OK",
      name: "Protected safe state",
      endState: "SUCCESSFUL_MITIGATION",
      memberCount: isSfr ? 114 : 208,
    }],
    scMissionTimes: [{
      id: "MT-01",
      eventSequence: "ES-01",
      hours: isSfr ? 96 : 72,
      riskSignificant: true,
    }],
    sySystems: [{
      id: isSfr ? "SYS-DRACS" : "SYS-RCCS",
      name: isSfr ? "Direct reactor auxiliary cooling system" : "Reactor cavity cooling system",
      missionTimeHours: 24,
      applicableStates: ["POS-01", "POS-02"],
      basicEventCount: isSfr ? 14 : 8,
    }],
    hrActions: [{
      id: "HR-01",
      name: isSfr ? "Align DRACS" : "Confirm RCCS alignment",
      timing: "POST_INITIATOR",
      affectedSystems: [isSfr ? "SYS-DRACS" : "SYS-RCCS"],
      humanErrorProbability: isSfr ? 0.08 : 0.045,
    }],
    daParameters: [{
      id: "DA-01",
      name: isSfr ? "DRACS loop fails" : "RCCS duct blocked",
      parameterType: "PROBABILITY",
      value: isSfr ? 0.008 : 0.002,
      basicEvent: isSfr ? "DRC-LP1-FR" : "RCC-DUCT1-BLK",
      system: isSfr ? "SYS-DRACS" : "SYS-RCCS",
    }],
  };
}

const expectedColumns: Record<string, string[]> = {
  POS: ["Operating state", "Mode", "Time fraction", "Radioactive-material sources"],
  IE: ["Initiating-event group", "Mean frequency", "Applicable states", "Risk importance"],
  ES: ["Event-sequence family", "End state", "Member-sequence count"],
  SC: ["Mission-time record", "Event sequence", "Mission hours", "Risk significance"],
  SY: ["System", "Mission hours", "Applicable states", "Basic-event count"],
  HR: ["Human failure event", "Timing", "Affected systems", "HEP"],
  DA: ["Parameter", "Basic event", "System", "Estimate with parameter type"],
  FL: ["Stored internal-flood model/source", "Input type"],
  F: ["Stored internal-fire model/source", "Input type"],
  XF: ["Earthquake-induced flooding hazard", "Mechanism", "Hazard-result references", "Fragility-mechanism references"],
  O: ["Retained secondary hazard", "Hazard parameter", "Affected SSCs", "Failure mechanisms"],
  ESQ: ["Seismic event-sequence family", "Point estimate", "Mean frequency", "Release category"],
  RI: ["Risk contributor", "Contributor type", "Contribution", "Importance"],
};

describe("seismicPraInterfaceLanes", () => {
  it("uses the exact minimal technical columns and keeps every row aligned", () => {
    const lanes = seismicPraInterfaceLanes(createSeismicPraExample("htgr"), linkedInputs("htgr"));

    expect(lanes.map((lane) => lane.code)).toEqual(Object.keys(expectedColumns));
    for (const lane of lanes) {
      expect(lane.columns).toEqual(expectedColumns[lane.code]);
      expect(lane.rows.every((row) => row.values.length === lane.columns.length - 1)).toBe(true);
    }
  });

  it("uses linked upstream records instead of Seismic-derived substitutes", () => {
    const lanes = seismicPraInterfaceLanes(createSeismicPraExample("htgr"), linkedInputs("htgr"));
    const lane = (code: string) => lanes.find((item) => item.code === code)!;

    expect(lane("POS").rows[0]).toEqual({
      id: "POS-01",
      name: "POS-01 · HTGR full power",
      values: ["Power", "88.0 %", "TRISO fuel"],
    });
    expect(lane("IE").rows[0].name).toContain("Loss of forced cooling");
    expect(lane("ES").rows[0].values).toEqual(["Successful mitigation", "208"]);
    expect(lane("SC").rows[0].values).toEqual(["ES-01", "72 h", "Yes"]);
    expect(lane("SY").rows[0].name).toContain("Reactor cavity cooling system");
    expect(lane("HR").rows[0].values).toContain("4.50E-2");
    expect(lane("DA").rows[0].name).toContain("RCCS duct blocked");
  });

  it("keeps HTGR and SFR upstream and downstream technical values distinct", () => {
    const htgr = seismicPraInterfaceLanes(createSeismicPraExample("htgr"), linkedInputs("htgr"));
    const sfr = seismicPraInterfaceLanes(createSeismicPraExample("sfr"), linkedInputs("sfr"));
    const row = (lanes: typeof htgr, code: string) => lanes.find((lane) => lane.code === code)!.rows[0];

    expect(row(htgr, "POS").name).toContain("HTGR");
    expect(row(sfr, "POS").name).toContain("SFR");
    expect(row(htgr, "SY").name).toContain("cavity cooling");
    expect(row(sfr, "SY").name).toContain("auxiliary cooling");
    expect(row(htgr, "RI").name).toContain("RCCS");
    expect(row(sfr, "RI").name).toContain("air cooler");
    expect(row(htgr, "ESQ").values[1]).toBe("2.60E-5 /plant-yr");
    expect(row(sfr, "ESQ").values[1]).toBe("3.50E-5 /plant-yr");
  });

  it("shows truthful empty upstream lanes without suppressing available Seismic outputs", () => {
    const lanes = seismicPraInterfaceLanes(createSeismicPraExample("htgr"), null);
    const lane = (code: string) => lanes.find((item) => item.code === code)!;

    for (const code of ["POS", "IE", "ES", "SC", "SY", "HR", "DA"]) {
      expect(lane(code).rows).toHaveLength(0);
      expect(lane(code).empty.length).toBeGreaterThan(0);
    }
    expect(lane("FL").rows).toEqual([
      { id: "model-INTERNAL-FLOOD-REFERENCE", name: "INTERNAL-FLOOD-REFERENCE", values: ["Base PRA model"] },
      { id: "source-SEL-HTGR-SERVICE-WATER", name: "SEL-HTGR-SERVICE-WATER", values: ["SEL flood source"] },
      { id: "source-SEL-HTGR-RCCS-WATER", name: "SEL-HTGR-RCCS-WATER", values: ["SEL flood source"] },
    ]);
    expect(lane("F").rows).toEqual([
      { id: "model-INTERNAL-FIRE-REFERENCE", name: "INTERNAL-FIRE-REFERENCE", values: ["Base PRA model"] },
      { id: "source-SEL-HTGR-TRANSFORMER", name: "SEL-HTGR-TRANSFORMER", values: ["SEL ignition source"] },
      { id: "source-SEL-HTGR-BATTERY-CHARGER", name: "SEL-HTGR-BATTERY-CHARGER", values: ["SEL ignition source"] },
    ]);
    expect(lane("XF").rows).toHaveLength(0);
    expect(lane("O").rows.length).toBeGreaterThan(0);
    expect(lane("ESQ").rows.length).toBeGreaterThan(0);
    expect(lane("RI").rows.length).toBeGreaterThan(0);
  });

  it("rejects a stale linked-input snapshot from another reactor variant", () => {
    const lanes = seismicPraInterfaceLanes(createSeismicPraExample("sfr"), linkedInputs("htgr"));

    for (const code of ["POS", "IE", "ES", "SC", "SY", "HR", "DA"]) {
      expect(lanes.find((lane) => lane.code === code)!.rows).toHaveLength(0);
    }
  });

  it("does not expose hazard-bin internals or repeat ESQ frequency data in RI", () => {
    const lanes = seismicPraInterfaceLanes(createSeismicPraExample("sfr"), linkedInputs("sfr"));
    const esq = lanes.find((lane) => lane.code === "ESQ")!;
    const ri = lanes.find((lane) => lane.code === "RI")!;

    expect(esq.columns).not.toContain("Motion range");
    expect(esq.columns).not.toContain("Annual frequency");
    expect(ri.columns).not.toContain("Mean family frequency");
    expect(ri.columns).not.toContain("Sequence families");
  });
});
