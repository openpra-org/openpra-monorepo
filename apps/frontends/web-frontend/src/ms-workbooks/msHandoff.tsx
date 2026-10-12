import { type JSX, type ReactNode } from "react";
import type { MechanisticSourceTermAnalysis, SourceTermDefinition } from "interfaces-mef-types/ms/mechanistic-source-term-analysis";
import { TechnicalElementHandoff, handoffName, joinedOrNone, recordLabel, type HandoffSectionView } from "../workbooks/workbookHandoff";
import { useMsWorkbook } from "./msWorkbookContext";
import { type MsLinkedWorkbookData } from "./msLinks";
import { fracText } from "./msShared";
import { ST_BASIS_LABELS } from "./msViewData";
import { speciesTotals } from "./msSelectors";

const SOURCE_BLOCK_TEXT: Record<string, string> = {
  BARRIER_TRANSPORT_ASSESSMENT: "Barrier transport",
  SOURCE_TERM_CALCULATION: "Source-term calculation",
};

function phasesText(st: SourceTermDefinition): string {
  return joinedOrNone(st.releasePhases.map((phase) => `${phase.name} ${String(phase.startTime)} to ${String(phase.endTime)}${phase.timeUnit === undefined ? "" : ` ${phase.timeUnit}`}`));
}

function releasesText(st: SourceTermDefinition): string {
  const ranked = [...speciesTotals(st).entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);
  return joinedOrNone(ranked.map(([species, value]) => `${species} ${fracText(value)}`));
}

function sourceTermDetail(st: SourceTermDefinition): string {
  const elevation = st.releaseElevation === undefined ? [] : [`Elevation ${String(st.releaseElevation.quantity)} ${st.releaseElevation.unit}`];
  return [`Phases ${phasesText(st)}`, `Releases ${releasesText(st)}`, ...elevation].join(" · ");
}

function msHandoffSections(ms: MechanisticSourceTermAnalysis, upstream: MsLinkedWorkbookData): HandoffSectionView[] {
  const categoryName = new Map(ms.releaseCategories.map((category) => [category.uuid, category.name]));
  const category = (id: string): ReactNode => (id.length === 0 ? "None" : handoffName(id, categoryName.get(id) ?? ""));
  const sequenceName = new Map((upstream.es?.eventSequences ?? []).map((sequence) => [sequence.uuid, sequence.name]));
  const sourceName = new Map((upstream.pos?.plantOperatingStates ?? []).flatMap((state) => state.radioactiveMaterialSources.map((source) => [source.uuid, source.name] as const)));
  return [
    {
      key: "source-terms",
      columns: [{ label: "Kind" }, { label: "Item" }, { label: "Release category" }, { label: "Detail" }],
      rows: [
        ...ms.sourceTermDefinitions.map((st) => ({ id: `st-${st.uuid}`, cells: ["Source term", handoffName(st.uuid, ST_BASIS_LABELS[st.sourceTermBasis]?.label ?? st.sourceTermBasis), category(st.releaseCategoryReference), sourceTermDetail(st)] })),
        ...ms.releaseCategories.map((rc) => ({ id: `bound-${rc.uuid}`, cells: ["Bounding sequence", rc.boundingSequenceReference.length === 0 ? "None" : recordLabel(rc.boundingSequenceReference, sequenceName.get(rc.boundingSequenceReference)), category(rc.uuid), rc.boundingSequenceJustification ?? ""] })),
        ...ms.sourceInventories.map((inventory) => ({
          id: `inv-${inventory.uuid}`,
          cells: [
            "Source inventory",
            handoffName(inventory.uuid, inventory.name),
            joinedOrNone([...new Set(ms.transportBarrierAssessments.filter((barrier) => barrier.sourceInventoryRefs.includes(inventory.uuid)).map((barrier) => barrier.releaseCategoryReference))].map((id) => recordLabel(id, categoryName.get(id)))),
            `Source ${inventory.radioactiveSourceRef === undefined || inventory.radioactiveSourceRef.length === 0 ? "None" : recordLabel(inventory.radioactiveSourceRef, sourceName.get(inventory.radioactiveSourceRef))} · ${String(inventory.inventory.length)} species`,
          ],
        })),
        ...ms.transportBarrierAssessments.map((barrier) => ({ id: `bar-${barrier.uuid}`, cells: ["Transport barrier", handoffName(barrier.uuid, barrier.name), category(barrier.releaseCategoryReference), `${barrier.barrierType} · DF ${String(barrier.decontaminationFactor ?? 1)}`] })),
        ...ms.transportPhenomenaAssessments.map((assessment) => ({
          id: `tpa-${assessment.uuid}`,
          cells: ["Transport phenomena", recordLabel(assessment.uuid, "Phenomena checklist"), category(assessment.releaseCategoryReference), `${String(assessment.phenomenaChecklist.filter((item) => item.included).length)} of ${String(assessment.phenomenaChecklist.length)} phenomena included`],
        })),
      ],
    },
    {
      key: "uncertainty",
      columns: [{ label: "Kind" }, { label: "Item" }, { label: "Detail" }],
      rows: [
        ...(ms.modelUncertaintyAssessments ?? []).map((entry) => ({ id: `mu-${entry.uuid}`, cells: ["Model uncertainty", handoffName(entry.uncertaintySource, SOURCE_BLOCK_TEXT[entry.sourceBlock] ?? entry.sourceBlock), entry.consequenceEffect] })),
        ...(ms.sensitivityStudies ?? []).map((study) => ({ id: `ss-${study.uuid}`, cells: ["Sensitivity study", study.name ?? study.description, study.results ?? joinedOrNone(study.variedParameters)] })),
      ],
    },
  ];
}

function MsHandoffScreen(): JSX.Element {
  const { ms, upstream } = useMsWorkbook();
  return <TechnicalElementHandoff element="MS" sections={msHandoffSections(ms, upstream)} />;
}

export { MsHandoffScreen };
