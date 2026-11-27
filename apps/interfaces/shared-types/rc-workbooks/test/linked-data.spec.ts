import type { RadiologicalConsequenceAnalysis, ReleaseCategoryInputs } from "interfaces-mef-types/rc/radiological-consequence-analysis";
import {
  rcLostFamilyOverrides,
  rcSavedForm,
  rcShowsSavedCopies,
  rcSourceFingerprint,
  rcSourceIsLinked,
  rcSourceStandsIn,
  rcWithFamilyReason,
  rcWithLinkedData,
  rcWithSourceChoice,
  rcWithSourceLinked,
  type RcLinkedData,
  type RcLinkedEsAnalysis,
  type RcLinkedMsAnalysis,
  type RcLinkedRiAnalysis,
} from "../linked-data";

const sourceTerm = (uuid: string, releaseCategoryReference: string, fraction: number) => ({ uuid, releaseCategoryReference,
  releasePhases: [{ uuid: "p1", name: "Puff", startTime: 0, endTime: 2, timeUnit: "h" }],
  radionuclideReleases: [{ phaseId: "p1", quantities: [{ radionuclide: "Cs-137", quantity: fraction, unit: "fraction", expressedAsReleaseFraction: true }] }],
  releaseElevation: { quantity: 10, unit: "m" } });
const es = {
  eventSequenceFamilies: [
    { uuid: "ESF-EARLY", name: "Early release", releaseCategoryIds: ["RC-1"], memberSequenceIds: ["S-1", "S-2"] },
    { uuid: "ESF-LATE", name: "Late release", releaseCategoryIds: ["RC-2"], memberSequenceIds: ["S-3"] },
    { uuid: "ESF-OK", name: "Safe stable state", releaseCategoryIds: [], memberSequenceIds: ["S-9"] },
  ],
  releaseCategoryMappings: [{ uuid: "M-1", releaseCategoryId: "RC-1" }, { uuid: "M-2", releaseCategoryId: "RC-2" }],
} as unknown as RcLinkedEsAnalysis;
const msWith = (firstFraction: number) => ({
  releaseCategories: [{ uuid: "RC-1", name: "Early", boundingSequenceReference: "S-2", boundingSequenceJustification: "Largest release." }],
  sourceInventories: [{ uuid: "SRC-1", name: "Core", inventory: [{ radionuclide: "Cs-137", quantity: 1e17, unit: "Bq" }] }],
  transportBarrierAssessments: [],
  sourceTermDefinitions: [sourceTerm("ST-1", "RC-1", firstFraction), sourceTerm("ST-2", "RC-2", 5e-6)],
}) as unknown as RcLinkedMsAnalysis;
const ri = { uuid: "ri-1", riskIntegrationFeedbackDispatch: { dispatchDate: "2026-10-01T00:00:00.000Z",
  radiologicalConsequenceFeedback: { metricFeedback: [{ metric: "Dose", riskSignificance: "LOW", recommendations: ["Keep."] }], generalFeedback: "Nothing significant." } } } as unknown as RcLinkedRiAnalysis;
const linked: RcLinkedData = { es: { workbookId: "es-1", analysis: es }, ms: { workbookId: "ms-1", analysis: msWith(1e-4) }, ri: { workbookId: "ri-1", analysis: ri } };

const workbook = (categories: ReleaseCategoryInputs[] = [], extra: Partial<RadiologicalConsequenceAnalysis> = {}) => ({
  linkedWorkbooks: { ES: "es-1", MS: "ms-1", RI: "ri-1" }, scope: { metrics: [] },
  releaseCategoryToConsequence: { releaseCategoryInputs: categories }, consequenceQuantification: { eventSequenceConsequences: [] }, ...extra,
}) as unknown as RadiologicalConsequenceAnalysis;
const categoriesOf = (rc: RadiologicalConsequenceAnalysis) => rc.releaseCategoryToConsequence.releaseCategoryInputs;
const familiesOf = (category: ReleaseCategoryInputs) => (category.eventSequenceFamilyReferences ?? []).map((reference) => reference.entityId);
const linkedValues = () => categoriesOf(rcWithLinkedData(workbook(), linked))[0].sourceTerm!.values;
const copy = (revision: number): ReleaseCategoryInputs => ({ releaseCategory: "RC-1", sourceTermDefinitionRef: "ST-1",
  sourceTerm: { revision, values: structuredClone(linkedValues()), msSource: { workbookId: "ms-old", sourceTermId: "ST-1", inventoryIds: ["SRC-1"] } },
  eventSequenceFamilyReferences: [{ referenceType: "EVENT_SEQUENCE_FAMILY", workbookId: "es-1", entityId: "ESF-EARLY" }], releaseCharacteristics: {} });

describe("RC data read from linked workbooks", () => {
  it("shows the linked rows by themselves and saves none of them", () => {
    const saved = workbook();
    const view = rcWithLinkedData(saved, linked);
    const [first, second] = categoriesOf(view);
    expect(categoriesOf(view).map((category) => category.releaseCategory)).toEqual(["RC-1", "RC-2"]);
    expect(first.sourceTerm!.msSource).toEqual({ workbookId: "ms-1", sourceTermId: "ST-1", inventoryIds: ["SRC-1"] });
    expect(first.sourceTerm!.revision).toBe(rcSourceFingerprint(first.sourceTerm!.values));
    expect(first.sourceTermDefinitionRef).toBe("ST-1");
    expect(first.boundingMember).toEqual({ sequenceId: "S-2", basis: "Largest release." });
    expect([familiesOf(first), familiesOf(second)]).toEqual([["ESF-EARLY"], ["ESF-LATE"]]);
    expect(view.riskIntegrationFeedback).toEqual({ analysisRef: "ri-1", feedbackDate: "2026-10-01T00:00:00.000Z",
      metricFeedback: [{ metric: "Dose", riskSignificance: "LOW", recommendations: ["Keep."] }], generalFeedback: "Nothing significant." });
    expect(rcSavedForm(view, linked)).toEqual(saved);
  });

  it("keeps a typed family assignment with its reason until the linked value is chosen again", () => {
    const moved = structuredClone(rcWithLinkedData(workbook(), linked));
    const [first, second] = categoriesOf(moved);
    first.eventSequenceFamilyReferences = [...(first.eventSequenceFamilyReferences ?? []), ...(second.eventSequenceFamilyReferences ?? [])];
    second.eventSequenceFamilyReferences = [];
    const stored = rcSavedForm(rcWithFamilyReason(moved, "ESF-LATE", "Bounded by the early release."), linked);
    const typed = [{ familyId: "ESF-LATE", releaseCategory: "RC-1", reason: "Bounded by the early release." }];
    expect(stored.releaseCategoryToConsequence.familyMapOverrides).toEqual(typed);
    expect(categoriesOf(stored)).toEqual([]);
    expect(familiesOf(categoriesOf(rcWithLinkedData(stored, linked))[0])).toEqual(["ESF-EARLY", "ESF-LATE"]);

    const regrouped: RcLinkedData = { ...linked, es: { workbookId: "es-1", analysis: { ...es, eventSequenceFamilies: es.eventSequenceFamilies.map((family) => (family.uuid === "ESF-LATE" ? { ...family, releaseCategoryIds: [] } : family)) } } };
    expect(familiesOf(categoriesOf(rcWithLinkedData(stored, regrouped))[0])).toEqual(["ESF-EARLY", "ESF-LATE"]);

    const removed: RcLinkedData = { ...linked, es: { workbookId: "es-1", analysis: { ...es, eventSequenceFamilies: es.eventSequenceFamilies.filter((family) => family.uuid !== "ESF-LATE") } } };
    const orphaned = rcWithLinkedData(stored, removed);
    expect(rcLostFamilyOverrides(orphaned, removed).map((entry) => entry.familyId)).toEqual(["ESF-LATE"]);
    expect(rcSavedForm(orphaned, removed).releaseCategoryToConsequence.familyMapOverrides).toEqual(typed);

    const back = structuredClone(rcWithLinkedData(stored, linked));
    const [early, late] = categoriesOf(back);
    late.eventSequenceFamilyReferences = (early.eventSequenceFamilyReferences ?? []).filter((reference) => reference.entityId === "ESF-LATE");
    early.eventSequenceFamilyReferences = (early.eventSequenceFamilyReferences ?? []).filter((reference) => reference.entityId !== "ESF-LATE");
    expect(rcSavedForm(back, linked).releaseCategoryToConsequence.familyMapOverrides).toBeUndefined();
  });

  it("reads an old copy as linked while MS still gives its values and keeps its revision until MS changes", () => {
    const fingerprint = rcSourceFingerprint(linkedValues());
    const view = rcWithLinkedData(workbook([copy(7)]), linked);
    expect(rcSourceIsLinked(categoriesOf(view)[0])).toBe(true);
    expect(categoriesOf(view)[0].sourceTerm!.revision).toBe(7);
    const stored = rcSavedForm(view, linked);
    expect(categoriesOf(stored)).toEqual([{ releaseCategory: "RC-1", linkedSourceTerm: { sourceTermId: "ST-1", inventoryIds: ["SRC-1"], revision: 7, fingerprint }, releaseCharacteristics: {} }]);
    expect(categoriesOf(rcWithLinkedData(stored, linked))[0].sourceTerm!.revision).toBe(7);

    const changed: RcLinkedData = { ...linked, ms: { workbookId: "ms-1", analysis: msWith(2e-4) } };
    const later = categoriesOf(rcWithLinkedData(stored, changed))[0].sourceTerm!;
    expect(later.revision).toBe(rcSourceFingerprint(later.values));
    expect(later.revision).not.toBe(7);
  });

  it("turns a copy that was changed by hand into a typed source term", () => {
    const edited = copy(7);
    edited.sourceTerm!.values.inventory[0].activityBq = 5;
    const view = rcWithLinkedData(workbook([edited]), linked);
    const shown = categoriesOf(view)[0];
    expect(rcSourceIsLinked(shown)).toBe(false);
    expect(rcSourceStandsIn(shown, linked)).toBe(true);
    expect(categoriesOf(rcSavedForm(view, linked))[0].sourceTerm).toEqual({ revision: 7, values: edited.sourceTerm!.values });
  });

  it("saves the chosen MS source term as a choice and drops a typed source term when MS is read again", () => {
    const view = rcWithLinkedData(workbook(), linked);
    const picked = rcSavedForm(rcWithSourceChoice(view, "RC-1", { sourceTermId: "ST-2", inventoryIds: ["SRC-1"] }), linked);
    expect(categoriesOf(picked)).toEqual([{ releaseCategory: "RC-1", linkedSourceTerm: { sourceTermId: "ST-2", inventoryIds: ["SRC-1"] }, releaseCharacteristics: {} }]);
    expect(categoriesOf(rcWithLinkedData(picked, linked))[0].sourceTermDefinitionRef).toBe("ST-2");

    const typed = rcWithLinkedData(workbook([{ releaseCategory: "RC-1", sourceTerm: { revision: 3, values: linkedValues() }, sourceTermOverrideReason: "Site inventory.", releaseCharacteristics: {} }]), linked);
    expect(rcSourceStandsIn(categoriesOf(typed)[0], linked)).toBe(true);
    expect(categoriesOf(rcSavedForm(typed, linked))[0].sourceTermOverrideReason).toBe("Site inventory.");
    expect(categoriesOf(rcSavedForm(rcWithSourceLinked(typed, "RC-1"), linked))).toEqual([]);
  });

  it("saves only the response to the feedback that RI sends", () => {
    const view = rcWithLinkedData(workbook(), linked);
    const answered: RadiologicalConsequenceAnalysis = { ...view, riskIntegrationFeedback: { ...view.riskIntegrationFeedback!, response: { description: "Deposition model kept under review.", status: "IN_PROGRESS" } } };
    expect(rcSavedForm(answered, linked).riskIntegrationFeedback).toEqual({ analysisRef: "ri-1", response: { description: "Deposition model kept under review.", status: "IN_PROGRESS" } });
  });

  it("shows nothing for an element whose link cannot be read and leaves the saved work alone", () => {
    const saved = workbook([], { releaseCategoryToConsequence: { releaseCategoryInputs: [], familyMapOverrides: [{ familyId: "ESF-LATE", releaseCategory: "RC-1", reason: "Typed." }] } } as unknown as Partial<RadiologicalConsequenceAnalysis>);
    const unread: RcLinkedData = { ms: linked.ms };
    const view = rcWithLinkedData(saved, unread);
    expect(categoriesOf(view)).toEqual([]);
    expect(rcSavedForm(view, unread)).toEqual(saved);
  });

  it("leaves the saved copies of a locked workbook as they are", () => {
    expect(rcShowsSavedCopies(workbook([copy(7)], { workflowState: "INTERNAL_APPROVAL" }))).toBe(true);
    expect(rcShowsSavedCopies(workbook([copy(7)], { workflowState: "DRAFT" }))).toBe(false);
    expect(rcShowsSavedCopies(workbook([], { workflowState: "INTERNAL_APPROVAL" }))).toBe(false);
  });
});
