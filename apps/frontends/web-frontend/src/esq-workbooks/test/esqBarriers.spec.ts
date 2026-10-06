import type { EsqCell, EventSequenceQuantification } from "interfaces-mef-types/esq/event-sequence-quantification";
import { DistributionType } from "interfaces-mef-types/core/events";
import { cellInputsKey, cellValueOfRecord, resolveCell, resolveSide } from "interfaces-mef-types/esq/esq-barrier-inputs";
import { modelViewOf, withFunctionLink, withModelImported } from "../esqModel";
import {
  barriersComplete,
  barriersViewOf,
  withBarrierEntry,
  withCell,
  withCellRun,
  withCredit,
  withMechanism,
} from "../esqBarriers";
import { stepsFromMef } from "../esqSelectors";
import { NOW, barrierEsq, barrierUpstream, modeledEsq, windowCell } from "./esqBarrierFixtures";

function checks(esq: EventSequenceQuantification): string[] {
  return (barriersViewOf(esq)?.findings ?? []).map((finding) => `${finding.severity}:${finding.check}:${finding.item}`);
}

function cellOfView(esq: EventSequenceQuantification, id: string): EsqCell {
  const cell = esq.barrierWork?.cells?.find((candidate) => candidate.id === id);
  if (cell === undefined) throw new Error(`no cell ${id}`);
  return cell;
}

function completeEsq(): EventSequenceQuantification {
  let esq = modeledEsq();
  for (const name of ["Primary boundary", "Building"]) {
    esq = withBarrierEntry(esq, name, {
      barrierId: name,
      modes: [
        { id: `${name}-G`, name: `${name} rupture`, kind: "GROSS", location: name },
        { id: `${name}-L`, name: `${name} leak`, kind: "LOCALIZED", location: `${name} penetrations` },
      ],
    });
    esq = withMechanism(esq, `PH-${name}`, { id: `PH-${name}`, barrierId: name, modeIds: [`${name}-G`], kind: "PHENOMENON", name: `${name} overpressure`, familyIds: [], basis: "Pressure analysis." });
  }
  const cell = cellOfView(esq, "BC-1");
  return withCell(esq, "BC-1", { ...cell, typed: { value: 0.99, basis: "Window runs." }, ofRecord: "TYPED", use: "END_STATE_ATTRIBUTE" });
}

describe("ESQ Step 04 barriers and phenomena", () => {
  it("imports the barrier records with the model", () => {
    const esq = barrierEsq();
    const model = esq.model;
    expect(model?.sources.map((source) => source.element)).toContain("SC");
    expect(model?.barriers?.map((record) => record.id)).toEqual(["Fuel coating", "Primary boundary", "Building"]);
    expect(model?.barriers?.[0]?.sourceNames).toEqual(["In-core fuel", "In-core fuel (decay)"]);
    expect(model?.barriers?.[1]?.states).toEqual([{ stateId: "POS-01", status: "INTACT" }, { stateId: "POS-02", status: "OPEN" }]);
    expect(model?.barriers?.[0]?.breachCriteria).toEqual(["Activity above limit"]);
    expect(model?.criteria?.[0]).toMatchObject({ id: "BAR-FUEL", method: "REALISTIC", capacityParameters: ["1600 C limit"], loads: [{ sequenceId: "A-2", attributes: ["Temperature", "Heat-up window"] }] });
    expect(model?.impacts?.map((impact) => `${impact.initiatorId}:${impact.groupId ?? ""}:${impact.barrierRef}:${impact.state}`)).toEqual(["I-1:IEG-01:RCB:INTACT", "I-2:IEG-01:RCB:DEGRADED"]);
    expect(model?.qualifications?.map((record) => `${record.id}:${record.kind}:${String(record.beyondQualification)}`)).toEqual(["SPC-1:ENVIRONMENT:true", "OC-1:CAPACITY:false"]);
    expect(model?.actions).toEqual([expect.objectContaining({
      id: "HR-POST-1",
      timing: "POST_INITIATOR",
      hep: 1.5e-2,
      cue: "High building activity",
      cueMinutes: 15,
      availableMinutes: 120,
      requiredMinutes: 30,
      recoveryId: "REC-1",
      feasibilityNote: "Access during the event is under review.",
    })]);
    expect(model?.actions?.[0]?.feasibility?.access).toBe(false);
    expect(model?.parameters.find((parameter) => parameter.id === "P-WIN")?.distribution).toEqual({ type: DistributionType.LOGNORMAL, median: 33.35, errorFactor: 1.287 });
    const again = withModelImported(esq, barrierUpstream(), NOW);
    expect(again.model?.changes).toEqual([]);
  });

  it("flags each barrier until it has gross and localized modes and a challenge", () => {
    const found = checks(barrierEsq());
    for (const name of ["Fuel coating", "Primary boundary", "Building"]) {
      expect(found).toContain(`error:No failure mode:${name}`);
      expect(found).toContain(`error:No challenge:${name}`);
    }
    expect(found).toContain("note:No source:Building");
    expect(found).toContain("note:SC criterion not used:BAR-FUEL");
    expect(found).toContain("note:IE barrier not mapped:RCB");
    expect(found).toContain("warning:No credit decision:SPC-1");
    expect(found).toContain("warning:Model logic not recorded:Phenomena logic");
    expect(barriersComplete(barrierEsq())).toBe(false);
    const view = barriersViewOf(modeledEsq());
    expect(view?.barriers[0]).toMatchObject({ criterion: { id: "BAR-FUEL" }, modes: [{ kind: "GROSS" }, { kind: "LOCALIZED" }] });
    expect(checks(modeledEsq()).filter((check) => check.endsWith(":Fuel coating"))).toEqual([]);
  });

  it("asks for a probability for each challenged mode and family", () => {
    const esq = modeledEsq();
    expect(checks(esq)).toContain("error:No value of record:BC-1");
    expect(checks(esq)).toContain("warning:Not used:BC-1");
    const removed = withCell(esq, "BC-1", undefined);
    expect(checks(removed)).toContain("warning:No probability:Fuel coating · F-REL");
    const typed = withCell(esq, "BC-1", { ...cellOfView(esq, "BC-1"), typed: { value: 0.99, basis: "" }, ofRecord: "TYPED" });
    expect(checks(typed)).toContain("error:Typed without a basis:BC-1");
    expect(checks(typed)).not.toContain("error:No value of record:BC-1");
    expect(cellValueOfRecord(cellOfView(typed, "BC-1"))).toBe(0.99);
  });

  it("feeds a Step 04 cell to a Step 02 split fraction", () => {
    const esq = withFunctionLink(modeledEsq(), "COOL", { functionId: "COOL", target: { kind: "SPLIT_FRACTION", cellId: "BC-1" }, reason: "The barrier result decides the branch." });
    expect(barriersViewOf(esq)?.cells[0]?.usedBy).toEqual(["COOL"]);
    expect(checks(esq)).not.toContain("warning:Not used:BC-1");
    const model = modelViewOf(esq);
    expect(model?.findings.map((finding) => `${finding.check}:${finding.item}`)).toContain("No Step 04 value:COOL");
    const valued = withCell(esq, "BC-1", { ...cellOfView(esq, "BC-1"), typed: { value: 0.99, basis: "Window runs." }, ofRecord: "TYPED" });
    expect(modelViewOf(valued)?.findings.map((finding) => finding.check)).not.toContain("No Step 04 value");
    const gone = withCell(valued, "BC-1", undefined);
    expect(modelViewOf(gone)?.findings.map((finding) => `${finding.check}:${finding.item}`)).toContain("Step 04 cell missing:COOL");
  });

  it("keeps a run as the value of record and marks it out of date when an input changes", () => {
    const esq = modeledEsq();
    const cell = cellOfView(esq, "BC-1");
    const run = withCellRun(esq, "BC-1", { runId: "run-1", revision: 4, at: NOW, method: "POINT_LOAD", inputs: cellInputsKey(cell), point: 0.9912 });
    expect(cellOfView(run, "BC-1").ofRecord).toBe("RUN");
    expect(cellValueOfRecord(cellOfView(run, "BC-1"))).toBe(0.9912);
    expect(checks(run)).not.toContain("warning:Run out of date:BC-1");
    const sampled = withCellRun(esq, "BC-1", { runId: "run-2", revision: 4, at: NOW, method: "POINT_LOAD", inputs: cellInputsKey(cell), point: 0.9912, mean: 0.98, p05: 0.9, p50: 0.99, p95: 0.999, samples: 2000, sampling: "LATIN_HYPERCUBE" });
    expect(cellValueOfRecord(cellOfView(sampled, "BC-1"))).toBe(0.98);
    const changed = withCell(run, "BC-1", { ...cellOfView(run, "BC-1"), capacity: { ...cell.capacity, distribution: { type: DistributionType.LOGNORMAL, median: 30, errorFactor: 1.287 } } });
    expect(checks(changed)).toContain("warning:Run out of date:BC-1");
  });

  it("refuses bad laws, foreign parameters and mixed correlation keys", () => {
    const model = barrierEsq().model;
    const base = windowCell("BC-9");
    expect(resolveCell({ ...base, capacity: { ...base.capacity, distribution: { type: DistributionType.LOGNORMAL, median: 33.35, errorFactor: 0.9 } } }, model).problem).toBe("Capacity needs an error factor of at least 1.");
    expect(resolveCell({ ...base, capacity: { ...base.capacity, uncertain: [{ parameter: "stdDev", distribution: { type: DistributionType.LOGNORMAL, median: 1, errorFactor: 2 } }] } }, model).problem).toBe("Capacity has no parameter stdDev to sample.");
    const shared = resolveCell({
      ...base,
      load: { distribution: { type: DistributionType.NORMAL, mean: 1500, stdDev: 50 }, uncertain: [{ parameter: "mean", distribution: { type: DistributionType.NORMAL, mean: 1500, stdDev: 20 }, correlationKey: "K" }], basis: "" },
      capacity: { distribution: { type: DistributionType.NORMAL, mean: 1800, stdDev: 60 }, uncertain: [{ parameter: "mean", distribution: { type: DistributionType.NORMAL, mean: 1800, stdDev: 20 }, correlationKey: "K" }], basis: "" },
    }, model);
    expect(shared.problem).toBe("Correlation key K joins parameters with different distributions.");
    expect(resolveCell({ ...base, capacity: { parameterId: "P-WIN", basis: "" } }, model).cell?.capacity.distribution).toEqual({ type: DistributionType.LOGNORMAL, median: 33.35, errorFactor: 1.287 });
    expect(resolveCell({ ...base, capacity: { parameterId: "P-IE", basis: "" } }, model).problem).toBe("Capacity takes P-IE, which has no distribution PRAXIS can integrate.");
    expect(resolveCell({ ...base, load: { basis: "" } }, model).problem).toBe("Load has no distribution.");
  });

  it("turns a fragility into a lognormal capacity with an uncertain median", () => {
    const side = resolveSide({ fragility: { median: 2.08, betaR: 0.23, betaU: 0.3 }, basis: "Vessel fragility." }, [], "Capacity").side;
    expect(side?.distribution).toEqual({ type: DistributionType.LOGNORMAL, median: 2.08, errorFactor: Math.exp(1.6448536269514722 * 0.23) });
    expect(side?.uncertainParameters).toEqual([{ parameter: "median", distribution: { type: DistributionType.LOGNORMAL, median: 2.08, errorFactor: Math.exp(1.6448536269514722 * 0.3) } }]);
    expect(resolveSide({ fragility: { median: 2.08, betaR: 0.23, betaU: 0 }, basis: "" }, [], "Capacity").side?.uncertainParameters).toEqual([]);
  });

  it("checks credits against qualification and feasibility", () => {
    let esq = modeledEsq();
    esq = withCredit(esq, "CR-1", { id: "CR-1", kind: "EQUIPMENT", qualificationId: "SPC-1", name: "DMP-A, DMP-B", familyIds: ["F-REL"], environment: "Blowdown", beyondQualification: true, credited: true, analysis: "", basis: "Damper closure is needed." });
    expect(checks({ ...esq, capabilityCategory: "CC-I" })).toContain("error:Credit beyond qualification:DMP-A, DMP-B");
    expect(checks(esq)).toContain("error:No survivability analysis:DMP-A, DMP-B");
    expect(checks(esq)).not.toContain("warning:No credit decision:SPC-1");
    const analyzed = withCredit(esq, "CR-1", { id: "CR-1", kind: "EQUIPMENT", qualificationId: "SPC-1", name: "DMP-A, DMP-B", familyIds: ["F-REL"], environment: "Blowdown", beyondQualification: true, credited: true, analysis: "Thermal analysis keeps the seals below their limit.", basis: "Damper closure is needed." });
    expect(checks(analyzed).filter((check) => check.endsWith("DMP-A, DMP-B"))).toEqual([]);
    const action = barriersViewOf(esq)?.actions[0];
    const withAction = withCredit(esq, "CR-2", { id: "CR-2", kind: "ACTION", actionId: "HR-POST-1", name: "Filtration start", familyIds: ["F-REL"], environment: "After the release starts", beyondQualification: false, credited: true, analysis: "Cue at 15 min, 120 min available.", treatment: "CONSERVATIVE", ...(action?.feasibility === undefined ? {} : { feasibility: action.feasibility }), basis: "HR feasibility record." });
    const found = barriersViewOf(withAction)?.findings.filter((finding) => finding.item === "Filtration start").map((finding) => `${finding.check}:${finding.detail}`);
    expect(found).toEqual([
      "Feasibility not shown:A credited action needs its feasibility shown before its HEP is used. Missing: access (ESQ-C7, RG 1.247).",
      "Conservative at CC-II:A risk-significant post-release action needs a detailed treatment at CC-II (ESQ-C7).",
    ]);
  });

  it("shows hazard cells only with an external hazard group in scope", () => {
    const esq = modeledEsq();
    expect(barriersViewOf(esq)?.hazards).toEqual([]);
    const seismic: EventSequenceQuantification = { ...esq, modelIntegration: { ...esq.modelIntegration, scopeCoverage: { ...esq.modelIntegration.scopeCoverage, hazardGroups: ["Internal events", "Seismic events"] } } };
    expect(barriersViewOf(seismic)?.hazards).toEqual(["Seismic events"]);
    expect(checks(seismic)).toContain("warning:No hazard mechanism:Seismic events");
    const cell: EsqCell = { ...windowCell("BC-2"), hazardGroup: "Seismic events", familyId: undefined, capacity: { fragility: { median: 2.08, betaR: 0.23, betaU: 0.3 }, basis: "Vessel fragility." }, load: { distribution: { type: DistributionType.UNIFORM, lower: 0.5, upper: 1 }, basis: "Ground motion bin." } };
    const { familyId: _family, ...hazardCell } = cell;
    const withHazard = withCell(seismic, "BC-2", hazardCell);
    expect(barriersViewOf(withHazard)?.hazardCells.map((entry) => entry.cell.id)).toEqual(["BC-2"]);
    expect(checks(withHazard)).not.toContain("error:No family:BC-2");
  });

  it("orders Barriers and phenomena as Step 04 and completes it once every error is cleared", () => {
    expect(stepsFromMef(barrierEsq(), "preparer").slice(0, 5).map((step) => `${step.num}:${step.id}`)).toEqual(["01:scope", "02:model", "03:logic", "04:barriers", "05:solve"]);
    const done = completeEsq();
    expect(checks(done).filter((check) => check.startsWith("error:"))).toEqual([]);
    expect(barriersComplete(done)).toBe(true);
    expect(stepsFromMef(done, "preparer").find((step) => step.id === "barriers")?.status).toBe("complete");
  });
});
