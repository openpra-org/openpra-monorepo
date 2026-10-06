import { EventSequenceQuantificationSchema } from "interfaces-mef-types/zod/esq/event-sequence-quantification";
import { applySensitivityCase, registerEntryId } from "interfaces-mef-types/esq/esq-sensitivity-inputs";
import { esqRecoveryEventId, THERP_CONDITIONAL } from "interfaces-mef-types/esq/esq-post-inputs";
import { ESQ_ANALYSIS } from "../../example-workbooks/seeds/esq-seed";
import { ESQ_ANALYSIS_HTGR } from "../../example-workbooks/seeds/esq-seed-htgr";
import { SY_ANALYSIS } from "../../example-workbooks/seeds/sy-seed";
import { SY_ANALYSIS_HTGR } from "../../example-workbooks/seeds/sy-seed-htgr";
import { POS_ANALYSIS } from "../../example-workbooks/seeds/pos-seed";
import { POS_ANALYSIS_SFR } from "../../example-workbooks/seeds/pos-seed-sfr";
import { HR_ANALYSIS } from "../../example-workbooks/seeds/hr-seed";
import { HR_ANALYSIS_HTGR } from "../../example-workbooks/seeds/hr-seed-htgr";
import { RI_ANALYSIS } from "../../example-workbooks/seeds/ri-seed";
import { RI_ANALYSIS_HTGR } from "../../example-workbooks/seeds/ri-seed-htgr";
import { normalizeEsqMef } from "../esq-mef-normalize";

const variants = [
  { name: "HTGR", esq: ESQ_ANALYSIS_HTGR, sy: SY_ANALYSIS_HTGR, pos: POS_ANALYSIS, hr: HR_ANALYSIS_HTGR, ri: RI_ANALYSIS_HTGR, hs: "example-hs-htgr" },
  { name: "SFR", esq: ESQ_ANALYSIS, sy: SY_ANALYSIS, pos: POS_ANALYSIS_SFR, hr: HR_ANALYSIS, ri: RI_ANALYSIS, hs: "example-hs-sfr" },
] as const;

describe("ESQ examples Steps 02 to 10", () => {
  it("parses the HTGR example with its review, spreads, cases and responses", () => {
    const parsed = EventSequenceQuantificationSchema.safeParse(normalizeEsqMef(ESQ_ANALYSIS_HTGR));
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    const mef = parsed.data;
    expect(mef.review?.screened?.map((bound) => bound.groupId)).toEqual(["IE-35", "IEG-DEPENDENCY-DEMO"]);
    expect(mef.review?.comparison).toMatchObject({ possible: false, plants: [] });
    expect(mef.uncertaintyWork?.spreads).toHaveLength(9);
    expect(mef.uncertaintyWork?.spreads?.find((spread) => spread.key === "HFE:HR-PRE-018")?.errorFactor).toBe(6);
    expect(mef.sensitivityWork?.cases?.map((entry) => entry.id)).toEqual(["SC-1", "SS-2-HIGH", "SS-3-LOW", "SS-3-HIGH", "SS-6-HIGH", "SC-4", "SC-5", "SC-6"]);
    expect(mef.handoffWork?.responses).toHaveLength(12);
  });

  it("parses the SFR example with its review, spreads, cases and responses", () => {
    const parsed = EventSequenceQuantificationSchema.safeParse(normalizeEsqMef(ESQ_ANALYSIS));
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    const mef = parsed.data;
    expect(mef.review?.screened?.map((bound) => bound.groupId)).toEqual(["IE-22", "IE-23", "IEG-DEPENDENCY-DEMO"]);
    expect(mef.uncertaintyWork?.spreads).toHaveLength(8);
    expect(mef.sensitivityWork?.cases?.map((entry) => entry.id)).toEqual(["SC-1", "SS-2-HIGH", "SS-3-LOW", "SS-3-HIGH", "SS-4-LOW", "SS-4-HIGH", "SS-6-HIGH", "SC-4", "SC-5", "SC-6"]);
    expect(mef.handoffWork?.responses).toHaveLength(13);
  });

  it.each(variants)("keeps the $name Step 02 to 06 entries through the MEF schema", ({ esq, hs }) => {
    const parsed = EventSequenceQuantificationSchema.safeParse(normalizeEsqMef(esq));
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    const mef = parsed.data;
    expect(mef.linkedWorkbooks?.HS).toBe(hs);
    expect(mef.modelDecisions?.familyChoices?.map((choice) => choice.familyId)).toEqual(["ESF-OK", "ESF-LEAK", "ESF-LATE", "ESF-EARLY", "ESF-ATWS"]);
    expect(mef.modelDecisions?.familyChoices?.every((choice) => (choice.groupingReason ?? "").length > 0)).toBe(true);
    expect(mef.logic?.exclusions).toHaveLength(1);
    expect(mef.barrierWork?.cells?.map((cell) => cell.id)).toEqual(["BC-1"]);
    expect(mef.postWork?.recoveries?.filter((rule) => rule.credited).map((rule) => rule.id)).toEqual(["REC-1"]);
    expect(mef.postWork?.combinations?.map((combination) => combination.id)).toEqual(["HC-1"]);
  });

  it.each(variants)("points the $name flags, exclusions and combinations at events and gates the SY example holds", ({ esq, sy }) => {
    const events = new Set(sy.systemBasicEvents.map((event) => event.uuid));
    for (const flag of esq.logic?.flags ?? []) {
      const target = flag.target;
      const model = sy.systemLogicModels.find((candidate) => candidate.uuid === target?.modelId);
      expect(target?.kind).toBe("GATE");
      expect(model?.gates.some((gate) => gate.id === target?.id)).toBe(true);
    }
    for (const exclusion of esq.logic?.exclusions ?? []) expect(exclusion.eventIds.every((id) => events.has(id))).toBe(true);
    const recoveryEvents = new Set((esq.postWork?.recoveries ?? []).map((rule) => esqRecoveryEventId(rule.id)));
    for (const combination of esq.postWork?.combinations ?? []) {
      expect(combination.eventIds.every((id) => events.has(id) || recoveryEvents.has(id))).toBe(true);
    }
  });

  it("flags normal power for every HTGR group except the loss of offsite power", () => {
    const flag = ESQ_ANALYSIS_HTGR.logic?.flags?.[0];
    const model = SY_ANALYSIS_HTGR.systemLogicModels.find((candidate) => candidate.uuid === flag?.target?.modelId);
    expect(model?.systemReference).toBe("SYS-AC");
    expect(model?.gates.find((gate) => gate.id === flag?.target?.id)?.code).toBe("AC-AND");
    expect(flag?.state).toBe(false);
    expect(flag?.groupIds).toHaveLength(20);
    expect(flag?.groupIds).not.toContain("IEG-03");
  });

  it.each(variants)("ties every $name barrier entry to a POS barrier and every cell to its mode and mechanism", ({ esq, pos }) => {
    const barriers = new Set(pos.plantOperatingStates.flatMap((state) => (state.radionuclideTransportBarriers ?? []).map((barrier) => barrier.name)));
    const work = esq.barrierWork;
    for (const entry of work?.barriers ?? []) {
      expect(barriers.has(entry.barrierId)).toBe(true);
      expect(entry.modes.some((mode) => mode.kind === "GROSS") && entry.modes.some((mode) => mode.kind === "LOCALIZED")).toBe(true);
    }
    expect([...barriers].every((name) => (work?.barriers ?? []).some((entry) => entry.barrierId === name))).toBe(true);
    for (const cell of work?.cells ?? []) {
      const entry = work?.barriers?.find((candidate) => candidate.barrierId === cell.barrierId);
      expect(entry?.modes.some((mode) => mode.id === cell.modeId)).toBe(true);
      expect(cell.mechanismIds.every((id) => (work?.mechanisms ?? []).some((mechanism) => mechanism.id === id))).toBe(true);
    }
  });

  it.each(variants)("takes the $name joint HEP of record from an HR assessment that matches THERP at its level", ({ esq, hr }) => {
    const hepOf = (quantificationId: string | undefined, hfeId: string | undefined): number | undefined => {
      const quantification = hr.hepQuantifications.find((candidate) => (quantificationId === undefined ? candidate.hfeId === hfeId : candidate.uuid === quantificationId));
      return quantification?.meanHep ?? quantification?.pointEstimateHep;
    };
    for (const combination of esq.postWork?.combinations ?? []) {
      const assessment = hr.dependencyAssessments.find((candidate) => candidate.uuid === combination.dependencyId);
      const recovery = (hr.recoveryActions ?? []).find((candidate) => candidate.dependencyAssessmentId === combination.dependencyId);
      expect(assessment).toBeDefined();
      if (assessment === undefined) continue;
      const heps = [...assessment.hfeIds.map((id) => hepOf(undefined, id)), ...(recovery === undefined ? [] : [hepOf(recovery.hepQuantificationId, undefined)])];
      const [first, ...rest] = heps;
      expect(heps.every((hep) => hep !== undefined)).toBe(true);
      const joint = rest.reduce((product: number, hep) => product * THERP_CONDITIONAL[assessment.dependenceLevel](hep ?? 0), first ?? 0);
      expect(Number(assessment.jointHep.toPrecision(2))).toBe(Number(joint.toPrecision(2)));
    }
  });

  it.each(variants)("links every $name register decision to a case the example holds", ({ esq }) => {
    const cases = new Set((esq.sensitivityWork?.cases ?? []).map((entry) => entry.id));
    for (const decision of esq.sensitivityWork?.decisions ?? []) {
      for (const caseId of decision.caseIds) expect(cases.has(caseId)).toBe(true);
      if (decision.key === true && decision.caseIds.length === 0) expect(decision.reason.length).toBeGreaterThan(0);
    }
    expect(esq.sensitivityWork?.decisions?.map((decision) => decision.id)).toContain(registerEntryId("HR", "SOURCE", "Borrowed nonnuclear human-performance data"));
  });

  it.each(variants)("answers every $name RI feedback item with a response", ({ esq, ri }) => {
    const dispatch = ri.riskIntegrationFeedbackDispatch?.eventSequenceQuantificationFeedback;
    const ids = [
      ...(dispatch?.familyFeedback ?? []).map((entry) => `FAMILY:${entry.familyRef}`),
      ...(dispatch?.contributorFeedback ?? []).map((entry) => `CONTRIBUTOR:${entry.entityRef}`),
      ...((dispatch?.generalFeedback ?? "").length > 0 ? ["GENERAL"] : []),
    ];
    const responses = esq.handoffWork?.responses ?? [];
    expect(ids.length).toBeGreaterThan(0);
    expect(responses.map((response) => response.id).sort()).toEqual([...ids].sort());
    expect(responses.every((response) => response.response.length > 0 && response.id === (response.kind === "GENERAL" ? "GENERAL" : `${response.kind}:${response.ref}`))).toBe(true);
  });

  it("keys a register entry by its text", () => {
    expect(registerEntryId("ESQ", "SOURCE", "Cavity-cooling duct blockage mode")).toBe(registerEntryId("ESQ", "SOURCE", "Cavity-cooling duct blockage mode"));
    expect(registerEntryId("ESQ", "SOURCE", "Cavity-cooling duct blockage mode")).not.toBe(registerEntryId("ESQ", "SOURCE", "Graphite-oxidation phenomena model"));
  });

  it.each(variants)("explains why each $name case cannot run before Step 02 imports the model", ({ esq }) => {
    for (const entry of esq.sensitivityWork?.cases ?? []) {
      expect(applySensitivityCase(esq, entry).problem).toBe("Import the model in Step 02 first.");
    }
  });
});
