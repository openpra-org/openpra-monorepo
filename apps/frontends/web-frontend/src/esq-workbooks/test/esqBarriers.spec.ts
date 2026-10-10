import type { EsqCell, EventSequenceQuantification } from "interfaces-mef-types/esq/event-sequence-quantification";
import type { Law, UncertainExpression } from "interfaces-mef-types/core/uncertainty";
import { cellExpressionOfRecord, cellInputsKey, lawFieldNames, resolveCell } from "interfaces-mef-types/esq/esq-barrier-inputs";
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
import { NOW, barrierEsq, barrierStored, barrierUpstream, modeledEsq, windowCell } from "./esqBarrierFixtures";

function probability(value: number): UncertainExpression {
  return { node: "VALUE", value: { unit: "PROBABILITY", law: { family: "POINT", value } } };
}

function quantity(law: Law): UncertainExpression {
  return { node: "VALUE", value: { unit: "QUANTITY", law } };
}

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
  return withCell(esq, "BC-1", { ...cell, typed: { expression: probability(0.99), basis: "Window runs." }, ofRecord: "TYPED", use: "END_STATE_ATTRIBUTE" });
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
      hep: { node: "VALUE", value: { unit: "PROBABILITY", law: { family: "POINT", value: 1.5e-2 } } },
      cue: "High building activity",
      cueMinutes: 15,
      availableMinutes: 120,
      requiredMinutes: 30,
      recoveryId: "REC-1",
      feasibilityNote: "Access during the event is under review.",
    })]);
    expect(model?.actions?.[0]?.feasibility?.access).toBe(false);
    expect(model?.parameters.find((parameter) => parameter.id === "P-WIN")?.estimate).toEqual(quantity({ family: "LOGNORMAL", mean: 33.74468539677077, errorFactor: 1.287, level: 0.95 }));
    const again = withModelImported(barrierStored(), barrierUpstream(), NOW);
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
    const typed = withCell(esq, "BC-1", { ...cellOfView(esq, "BC-1"), typed: { expression: probability(0.99), basis: "" }, ofRecord: "TYPED" });
    expect(checks(typed)).toContain("error:Typed without a basis:BC-1");
    expect(checks(typed)).not.toContain("error:No value of record:BC-1");
    expect(cellExpressionOfRecord(cellOfView(typed, "BC-1"))).toEqual(probability(0.99));
    const { load: _load, capacity: _capacity, ...bare } = cellOfView(typed, "BC-1");
    const typedOnly = withCell(typed, "BC-1", bare);
    expect(checks(typedOnly)).toContain("note:Cannot run:BC-1");
    expect(checks(withCell(typedOnly, "BC-1", { ...bare, ofRecord: undefined }))).toContain("error:Cannot run:BC-1");
  });

  it("feeds a Step 04 cell to a Step 02 split fraction", () => {
    const esq = withFunctionLink(modeledEsq(), "COOL", { functionId: "COOL", target: { kind: "SPLIT_FRACTION", cellId: "BC-1" }, reason: "The barrier result decides the branch." });
    expect(barriersViewOf(esq)?.cells[0]?.usedBy).toEqual(["COOL"]);
    expect(checks(esq)).not.toContain("warning:Not used:BC-1");
    const model = modelViewOf(esq);
    expect(model?.findings.map((finding) => `${finding.check}:${finding.item}`)).toContain("No Step 04 value:COOL");
    const valued = withCell(esq, "BC-1", { ...cellOfView(esq, "BC-1"), typed: { expression: probability(0.99), basis: "Window runs." }, ofRecord: "TYPED" });
    expect(modelViewOf(valued)?.findings.map((finding) => finding.check)).not.toContain("No Step 04 value");
    const gone = withCell(valued, "BC-1", undefined);
    expect(modelViewOf(gone)?.findings.map((finding) => `${finding.check}:${finding.item}`)).toContain("Step 04 cell missing:COOL");
  });

  it("keeps a run as the value of record and marks it out of date when an input changes", () => {
    const esq = modeledEsq();
    const cell = cellOfView(esq, "BC-1");
    const run = withCellRun(esq, "BC-1", { runId: "run-1", revision: 4, at: NOW, method: "POINT_LOAD", inputs: cellInputsKey(cell), point: 0.9912 });
    expect(cellOfView(run, "BC-1").ofRecord).toBe("RUN");
    expect(cellExpressionOfRecord(cellOfView(run, "BC-1"))).toEqual(probability(0.9912));
    expect(checks(run)).not.toContain("warning:Run out of date:BC-1");
    const law: Law = { family: "TABULATED", points: [{ probability: 0, value: 0.9 }, { probability: 0.5, value: 0.99 }, { probability: 1, value: 0.999 }], scale: "LINEAR" };
    const sampled = withCellRun(esq, "BC-1", { runId: "run-2", revision: 4, at: NOW, method: "POINT_LOAD", inputs: cellInputsKey(cell), point: 0.9912, mean: 0.98, p05: 0.9, p50: 0.99, p95: 0.999, samples: 2000, sampling: "LATIN_HYPERCUBE", law });
    expect(cellExpressionOfRecord(cellOfView(sampled, "BC-1"))).toEqual({ node: "VALUE", value: { unit: "PROBABILITY", law } });
    const changed = withCell(run, "BC-1", { ...cellOfView(run, "BC-1"), capacity: { source: "TYPED", variable: { law: { family: "LOGNORMAL", mean: 30, errorFactor: 1.287, level: 0.95 }, fields: [] }, basis: "" } });
    expect(checks(changed)).toContain("warning:Run out of date:BC-1");
  });

  it("names unknown fields, time units, foreign parameters and laws DA cannot give", () => {
    const esq = barrierEsq();
    const base = windowCell("BC-9");
    const variable = (fields: { field: string; value: UncertainExpression }[]) => ({ source: "TYPED" as const, variable: { law: { family: "LOGNORMAL" as const, mean: 33.7, errorFactor: 1.287, level: 0.95 }, fields }, basis: "" });
    expect(lawFieldNames({ family: "TRUNCATED", law: { family: "NORMAL", mean: 1, standardDeviation: 2 }, lower: 0, upper: null })).toEqual(["lower", "law.mean", "law.standardDeviation"]);
    expect(resolveCell({ ...base, capacity: variable([{ field: "median", value: quantity({ family: "POINT", value: 30 }) }]) }, esq).problem).toBe("The capacity law has no field median to make uncertain.");
    expect(resolveCell({ ...base, capacity: variable([{ field: "mean", value: quantity({ family: "POINT", value: 30 }) }, { field: "mean", value: quantity({ family: "POINT", value: 31 }) }]) }, esq).problem).toBe("The capacity makes mean uncertain twice.");
    expect(resolveCell({ ...base, capacity: variable([{ field: "mean", value: { node: "VALUE", value: { unit: "HOURS", law: { family: "POINT", value: 30 } } } }]) }, esq).problem).toBe("The capacity field mean is typed per time or in time units. Type it as a quantity in the cell unit.");
    expect(resolveCell({ ...base, capacity: variable([{ field: "mean", value: { node: "PARAMETER", reference: { referenceType: "WORKBOOK_PARAMETER", workbookId: "da-other", entityId: "P-WIN" } } }]) }, esq).problem).toBe("The capacity reads P-WIN from a workbook that Step 01 does not link as DA.");
    const linked = resolveCell({ ...base, capacity: variable([{ field: "mean", value: { node: "PARAMETER", reference: { referenceType: "WORKBOOK_PARAMETER", workbookId: "da-1", entityId: "P-WIN" } } }]) }, esq);
    expect(linked.cell?.parameters.map((parameter) => parameter.reference.entityId)).toEqual(["P-WIN"]);
    expect(resolveCell({ ...base, capacity: { source: "DA", parameterId: "P-WIN", basis: "" } }, esq).cell?.capacity).toEqual({ kind: "VARIABLE", variable: { law: { family: "LOGNORMAL", mean: 33.74468539677077, errorFactor: 1.287, level: 0.95 }, fields: [] } });
    expect(resolveCell({ ...base, capacity: { source: "DA", parameterId: "P-SF", basis: "" } }, esq).problem).toBe("The capacity takes Shutdown cooling demand, which has no estimate in DA.");
    expect(resolveCell({ ...base, capacity: { source: "DA", parameterId: "P-MIX", basis: "" } }, esq).problem).toBe("The capacity takes Scaled window, whose DA estimate is not one law.");
    const { load: _load, ...noLoad } = base;
    expect(resolveCell(noLoad, esq).problem).toBe("The cell has no load.");
  });

  it("keeps a fragility as median and betas and names a median that is not above zero", () => {
    const esq = barrierEsq();
    const base = windowCell("BC-9");
    expect(resolveCell({ ...base, capacity: { source: "FRAGILITY", fragility: { median: 2.08, betaR: 0.23, betaU: 0.3 }, basis: "Vessel fragility." } }, esq).cell?.capacity).toEqual({ kind: "FRAGILITY", fragility: { median: 2.08, betaR: 0.23, betaU: 0.3 } });
    expect(resolveCell({ ...base, capacity: { source: "FRAGILITY", fragility: { median: 0, betaR: 0.23, betaU: 0.3 }, basis: "" } }, esq).problem).toBe("The capacity fragility needs a median above zero.");
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
    const cell: EsqCell = { ...windowCell("BC-2"), hazardGroup: "Seismic events", familyId: undefined, capacity: { source: "FRAGILITY", fragility: { median: 2.08, betaR: 0.23, betaU: 0.3 }, basis: "Vessel fragility." }, load: { source: "TYPED", variable: { law: { family: "UNIFORM", lower: 0.5, upper: 1 }, fields: [] }, basis: "Ground motion bin." } };
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
