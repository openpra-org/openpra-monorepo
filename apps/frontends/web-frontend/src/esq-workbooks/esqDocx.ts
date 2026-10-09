import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
} from "docx";
import { type EventSequenceQuantification } from "interfaces-mef-types/esq/event-sequence-quantification";
import { logicViewOf } from "./esqLogic";
import { barriersViewOf, cellRecordText, modeLabel, sideSourceText, MECHANISM_KIND_LABELS, MODE_KIND_LABELS } from "./esqBarriers";
import { parameterLabelOf } from "./esqModel";
import { BASIS_LABELS, CALCULATION_LABELS, QUANTIFIER_LABELS, SOURCE_LABELS, pctText, solveViewOf } from "./esqSolve";
import { runLogicText } from "./esqLogic";
import { JOINT_SOURCE_LABELS, LEVEL_LABELS, postViewOf } from "./esqPost";
import { FEASIBILITY_LABELS } from "./esqBarriers";
import { CONSISTENCY_LABELS, CONSISTENCY_TOPICS, IMPORTANCE_KIND_LABELS, fourDigits } from "./esqResults";
import { METHOD_LABELS } from "./esqUncertainty";

function heading(text: string, level: (typeof HeadingLevel)[keyof typeof HeadingLevel]): Paragraph {
  return new Paragraph({ text, heading: level, spacing: { before: 240, after: 120 }, pageBreakBefore: level === HeadingLevel.HEADING_1 });
}

function para(text: string): Paragraph {
  return new Paragraph({ children: [new TextRun(text)], spacing: { after: 120 } });
}

function bullet(text: string): Paragraph {
  return new Paragraph({ children: [new TextRun(text)], bullet: { level: 0 } });
}

function cell(text: string, header: boolean): TableCell {
  return new TableCell({
    children: [new Paragraph({ children: [new TextRun({ text, bold: header, size: 18 })] })],
    shading: header ? { fill: "F0E8FF" } : undefined,
  });
}

function dataTable(headers: string[], rows: string[][]): Table {
  const headerRow = new TableRow({ tableHeader: true, children: headers.map((h) => cell(h, true)) });
  const bodyRows = rows.map((r) => new TableRow({ children: r.map((c) => cell(c, false)) }));
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [headerRow, ...bodyRows],
    borders: {
      top: { style: BorderStyle.SINGLE, size: 1, color: "D9CEE2" },
      bottom: { style: BorderStyle.SINGLE, size: 1, color: "D9CEE2" },
      left: { style: BorderStyle.SINGLE, size: 1, color: "D9CEE2" },
      right: { style: BorderStyle.SINGLE, size: 1, color: "D9CEE2" },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: "EDE6F2" },
      insideVertical: { style: BorderStyle.SINGLE, size: 1, color: "EDE6F2" },
    },
  });
}

function val(v: number | undefined): string {
  return v === undefined ? "—" : v.toExponential(1).replace("e", "E");
}

function differenceText(compared: number, base: number | undefined): string {
  if (base === undefined || base === 0) return "—";
  return pctText((100 * (compared - base)) / base);
}

function buildChildren(a: EventSequenceQuantification, final: boolean): (Paragraph | Table)[] {
  const out: (Paragraph | Table)[] = [];
  const stageLabel = a.plantStage === "PRE_OPERATIONAL" ? "Pre-operational" : "Operational";
  const ccLabel = a.capabilityCategory ?? "N/A";
  const doc = a.documentation;
  const families = a.familyQuantifications;
  const solve = solveViewOf(a);
  const run = solve?.run;

  out.push(
    new Paragraph({ children: [new TextRun({ text: `${a.name} — ${stageLabel} PRA Model`, bold: true, size: 48 })], spacing: { after: 60 } }),
    new Paragraph({ children: [new TextRun({ text: "Preliminary Event Sequence Quantification", size: 28, color: "4C4452" })], spacing: { after: 120 } }),
    para(`Capability category target: ${ccLabel}. Scope: ${a.praScope}`),
    para(final ? "Status: final — all required items satisfied." : "Status: draft — open items flagged inline."),
  );

  out.push(heading("Executive summary", HeadingLevel.HEADING_1));
  const barriers = barriersViewOf(a);
  out.push(para(`This document presents the preliminary Event Sequence Quantification (ESQ) for ${a.name}, prepared during the ${stageLabel.toLowerCase()} stage. ${solve?.families.length ?? families.length} event-sequence families, ${barriers?.barriers.length ?? 0} radionuclide barriers and ${a.riskSignificantContributors.length} risk-significant contributors have been recorded against the ${ccLabel} capability target.`));

  out.push(heading("Introduction", HeadingLevel.HEADING_1));
  out.push(heading("Purpose, scope & relationship", HeadingLevel.HEADING_2));
  out.push(para(doc.processDescription));
  out.push(para(a.praScope));
  out.push(para(doc.praTaskInterfaces));
  out.push(heading("Quality assurance & freeze date", HeadingLevel.HEADING_2));
  out.push(para(doc.codeVerificationProcess));
  out.push(para(`Model version ${a.version}. Analysis date: ${a.metadata.analysisDate}.`));

  out.push(heading("Assumptions & limitations", HeadingLevel.HEADING_1));
  out.push(para(doc.asBuiltLimitations));
  for (const l of a.metadata.limitations) out.push(bullet(l));

  out.push(heading("Methodologies", HeadingLevel.HEADING_1));
  out.push(heading("Integration & quantification approach", HeadingLevel.HEADING_2));
  out.push(para(doc.quantificationProcessDescription));
  out.push(heading("Truncation & convergence", HeadingLevel.HEADING_2));
  out.push(para(doc.truncationConvergenceProcess));
  out.push(heading("Solution & approximation", HeadingLevel.HEADING_2));
  out.push(para(doc.appliedMethods));
  out.push(heading("Uncertainty propagation", HeadingLevel.HEADING_2));
  out.push(para(doc.uncertaintySensitivityResults));

  out.push(heading("Model integration & inputs", HeadingLevel.HEADING_1));
  out.push(para(doc.inputsDescription));
  out.push(para(a.modelIntegration.integrationMethod));

  out.push(heading("Event sequence family frequencies", HeadingLevel.HEADING_1));
  out.push(para(doc.familyFrequenciesAndContributions));
  out.push(dataTable(
    ["Family", "Name", "Value (/yr)", "From", "Sequences", "Converged at"],
    (solve?.families ?? []).map((f) => [f.id, f.name, val(f.value), f.source === undefined ? "Not chosen" : SOURCE_LABELS[f.source], String(f.family.members.length), f.convergence === undefined ? "—" : f.convergence.convergedAt === undefined ? "Not converged" : val(f.convergence.convergedAt)]),
  ));

  out.push(heading("Contribution breakdown", HeadingLevel.HEADING_1));
  out.push(dataTable(
    ["Family", "Contributor", "Type", "Fraction"],
    families.flatMap((f) => (f.contributionBreakdown ?? []).map((c) => [f.name, c.contributorRef, c.contributorType, `${Math.round(c.fractionalContribution * 100)}%`])),
  ));

  out.push(heading("Quantification configuration", HeadingLevel.HEADING_1));
  out.push(para(run === undefined
    ? "No PRAXIS run is kept as the values of record."
    : `PRAXIS run ${run.runId} of ${run.at}, workbook revision ${String(run.revision)}${solve?.stale === true ? ", older than its inputs" : ""}. ${CALCULATION_LABELS[run.calculation]}${run.quantifier === undefined ? "" : `, ${QUANTIFIER_LABELS[run.quantifier].toLowerCase()}`}${run.basis === undefined ? "" : `, cutoff on ${BASIS_LABELS[run.basis].toLowerCase()}`}${run.limitOrder === undefined ? "" : `, order limit ${String(run.limitOrder)}`}. ${runLogicText(run.logic)}.`));
  if (solve?.work.rareEventReason !== undefined) out.push(para(`Rare event: ${solve.work.rareEventReason}`));

  out.push(heading("Truncation convergence records", HeadingLevel.HEADING_1));
  out.push(para(`A family converges where a one-decade step changes it less than the step before and by less than ${String(solve?.stepPercent ?? 5)}%.`));
  out.push(dataTable(
    ["Family", "Cutoff", "Cut sets", "Frequency (/yr)", "Change"],
    (solve?.families ?? []).flatMap((f) => {
      const convergence = f.convergence;
      if (convergence === undefined) return [];
      return (f.solve?.run?.sweep ?? []).map((point, index) => [f.id, val(point.cutOff), String(point.count), val(point.annualFrequency), pctText(convergence.changes[index])]);
    }),
  ));

  out.push(heading("Code verification", HeadingLevel.HEADING_1));
  out.push(dataTable(
    ["Family", "PRAXIS (/yr)", "Compared (/yr)", "From", "Difference"],
    (solve?.families ?? []).flatMap((f) => {
      const base = f.solve?.run?.annualFrequency;
      const rows: string[][] = [];
      if (f.solve?.typed !== undefined) rows.push([f.id, val(base), val(f.solve.typed.annualFrequency), f.solve.typed.source, differenceText(f.solve.typed.annualFrequency, base)]);
      if (f.solve?.imported !== undefined) rows.push([f.id, val(base), val(f.solve.imported.annualFrequency), "ES workbook", differenceText(f.solve.imported.annualFrequency, base)]);
      return rows;
    }),
  ));

  out.push(heading("Cutset review records", HeadingLevel.HEADING_1));
  out.push(para(doc.cutsetReviewProcess));
  const reviewWork = a.review ?? {};
  const eventCode = new Map((a.model?.events ?? []).map((event) => [event.id, event.code]));
  out.push(dataTable(
    ["Family", "Cut set", "Frequency (/yr)", "Significant", "Logic", "Note"],
    (reviewWork.cutSetReviews ?? []).filter((c) => c.verdict !== undefined).map((c) => [c.familyId, c.eventIds.map((id) => eventCode.get(id) ?? id).join(" · "), val(c.annualFrequency), c.significant ? "Yes" : "No", c.verdict === "CORRECT" ? "Correct" : "Issue", c.note]),
  ));
  out.push(heading("Consistency of the results", HeadingLevel.HEADING_2));
  out.push(dataTable(
    ["Checked against", "Result", "Note"],
    CONSISTENCY_TOPICS.map((topic) => {
      const entry = reviewWork.consistency?.find((item) => item.topic === topic);
      return [CONSISTENCY_LABELS[topic], entry?.consistent === undefined ? "Not checked" : entry.consistent ? "Consistent" : "Inconsistent", entry?.note ?? ""];
    }),
  ));
  const comparison = reviewWork.comparison;
  if (comparison !== undefined && !comparison.possible) out.push(para(`No similar plant is compared. ${comparison.reason}`));
  if (comparison !== undefined && comparison.possible) {
    out.push(dataTable(["Plant", "Source", "Family", "Value (/yr)", "Differences"], comparison.plants.map((plant) => [plant.name, plant.source, plant.familyId ?? "Release total", val(plant.value), plant.note])));
  }

  out.push(heading("Flag, mutex & recovery treatment", HeadingLevel.HEADING_1));
  out.push(para(doc.mutuallyExclusiveEventsEliminated));
  const logic = logicViewOf(a);
  out.push(dataTable(
    ["Flag", "Sets", "State", "Applies to", "Basis"],
    (logic?.flags ?? []).map((f) => [f.flag.name.trim().length > 0 ? f.flag.name : f.flag.id, f.target, f.flag.state ? "TRUE" : "FALSE", f.trees.map((tree) => tree.code).join(", "), f.flag.basis]),
  ));
  out.push(dataTable(
    ["Support loop", "Cut at", "State", "Basis"],
    (logic?.loops ?? []).flatMap((loop) => loop.edges.flatMap((edge) => (edge.cut === undefined ? [] : [[loop.codes.join(", "), `${edge.fromCode} to ${edge.toCode}`, edge.cut.state ? "TRUE" : "FALSE", edge.cut.basis]]))),
  ));
  const post = postViewOf(a);
  const deletions = post?.work.deletions;
  out.push(dataTable(
    ["Exclusion", "Events", "Basis", "Cut sets deleted", "Frequency (/yr)"],
    (post?.exclusions ?? []).map((x) => [x.exclusion.id, x.codes.join(", "), x.exclusion.basis, deletions === undefined || !x.checkable ? "—" : String(x.finding?.cutSetCount ?? 0), val(x.finding?.nominalFrequency)]),
  ));
  if (deletions !== undefined) out.push(para(`Deleted combinations listed by PRAXIS run ${deletions.runId} of ${deletions.at} at a cutoff of ${val(deletions.cutOff)} per year${post?.deletionsStale === true ? ", older than its inputs" : ""}.`));
  out.push(dataTable(
    ["Recovery", "Recovers", "Non-recovery HEP", "From", "Credited", "Feasibility not shown", "Basis"],
    (post?.recoveries ?? []).map((r) => [r.recovery.id, r.codes.join(", "), val(r.recovery.value), r.recovery.source === undefined ? "Not chosen" : r.recovery.source === "HRA" ? "HR" : r.recovery.rule?.typed?.source ?? "Typed", r.recovery.credited ? "Yes" : "No", r.recovery.missing.length === 0 ? "None" : r.recovery.missing.map((key) => FEASIBILITY_LABELS[key]).join(", "), r.recovery.rule?.basis ?? ""]),
  ));

  out.push(heading("Dependency treatment", HeadingLevel.HEADING_1));
  out.push(para(doc.intermediateStateDependencyTreatment));
  out.push(para(a.dependencyTreatment.postInitiatorHfeDependencyBasis));
  const search = post?.work.search;
  out.push(para(search === undefined
    ? "No PRAXIS search for cut sets with several human failure events is kept."
    : `PRAXIS run ${search.runId} of ${search.at} found the cut sets with two or more human failure events, with each HEP at ${String(search.raisedHep)} and a cutoff of ${val(search.cutOff)} per year${post?.searchStale === true ? ". It is older than its inputs" : ""}.`));
  out.push(para(post?.floor === undefined ? "No joint HEP floor is set." : `Joint HEP floor ${val(post.floor)}${post.work.floor === undefined ? " from HR" : `, typed from ${post.work.floor.source}`}. No joint HEP goes below it unless a waiver gives the reason.`));
  out.push(dataTable(
    ["Combination", "Events", "Joint HEP", "From", "Level", "Nominal (/yr)", "Basis"],
    (post?.combinations ?? []).map((c) => [c.entry?.combination.id ?? "Not assessed", c.codes.join(", "), val(c.entry?.joint), c.entry?.source === undefined ? "—" : JOINT_SOURCE_LABELS[c.entry.source], c.entry?.level === undefined ? "—" : LEVEL_LABELS[c.entry.level], val(c.finding?.nominalFrequency), c.entry?.combination.basis ?? ""]),
  ));

  out.push(heading("Post-processing results", HeadingLevel.HEADING_1));
  out.push(para(post?.work.comparison === undefined
    ? "No run without the post-processing rules is kept."
    : `PRAXIS run ${post.work.comparison.runId} of ${post.work.comparison.at} repeats the run of record with recovery and HFE dependency off${post.comparisonStale ? ". It is older than its inputs" : ""}.`));
  out.push(dataTable(
    ["Family", "Without the rules (/yr)", "With the rules (/yr)", "Change"],
    (post?.results ?? []).map((r) => [r.familyId, val(r.without), val(r.withRules), r.withRules === undefined ? "—" : differenceText(r.withRules, r.without)]),
  ));

  out.push(heading("Barrier challenge & capacity", HeadingLevel.HEADING_1));
  out.push(para(doc.barrierChallengeTreatment));
  out.push(para(doc.barrierCapacityBasis));
  out.push(dataTable(
    ["Barrier", "Failure mode", "Kind", "Location"],
    (barriers?.barriers ?? []).flatMap((b) => (b.modes.length === 0 ? [[b.name, "—", "—", "—"]] : b.modes.map((m) => [b.name, modeLabel(m), MODE_KIND_LABELS[m.kind], m.location]))),
  ));
  out.push(dataTable(
    ["Mechanism", "Kind", "Barrier", "Status", "Basis"],
    (barriers?.mechanisms ?? []).map((m) => [m.mechanism.name, MECHANISM_KIND_LABELS[m.mechanism.kind], m.barrier?.name ?? m.mechanism.barrierId, m.mechanism.screening === undefined ? "Retained" : `Screened ${m.mechanism.screening.criterion}`, m.mechanism.screening?.basis ?? m.mechanism.basis]),
  ));
  out.push(dataTable(
    ["Cell", "Barrier mode", "Family or hazard", "Load", "Capacity", "P(fail)"],
    [...(barriers?.cells ?? []), ...(barriers?.hazardCells ?? [])].map((c) => [c.cell.id, `${c.barrier?.name ?? c.cell.barrierId} · ${modeLabel(c.mode)}`, c.cell.hazardGroup ?? c.cell.familyId ?? "—", sideSourceText(c.cell.load, c.cell.unit), sideSourceText(c.cell.capacity, c.cell.unit), cellRecordText(c.cell, parameterLabelOf(a))]),
  ));
  out.push(dataTable(
    ["Credit", "Kind", "Families", "Decision", "Basis"],
    (barriers?.credits ?? []).map((c) => [c.credit.name, c.credit.kind === "EQUIPMENT" ? "Equipment" : "Action", c.credit.familyIds.join(", "), c.credit.credited ? "Credited" : "Not credited", c.credit.basis]),
  ));

  out.push(heading("Risk-significant contributors & importance", HeadingLevel.HEADING_1));
  out.push(para(doc.riskSignificantContributorsDocumentation));
  const ranking = reviewWork.importance;
  out.push(para(ranking === undefined
    ? "No importance ranking is kept."
    : `PRAXIS run ${ranking.runId} of ${ranking.at} sets each event and group to failure and to success on the exact sequence diagrams. Items are significant above FV ${fourDigits(ranking.thresholds?.fussellVesely ?? 0.005)} or RAW ${fourDigits(ranking.thresholds?.riskAchievementWorth ?? 2)} over the release families.`));
  out.push(dataTable(
    ["Item", "Kind", "Largest FV", "Largest RAW"],
    (ranking?.significant ?? []).map((entry) => [entry.label, IMPORTANCE_KIND_LABELS[entry.kind], fourDigits(entry.fussellVesely), fourDigits(entry.riskAchievementWorth)]),
  ));
  out.push(dataTable(
    ["Contributor", "Type", "Fraction", "Basis"],
    a.riskSignificantContributors.map((c) => [c.entityRef, c.contributorType, c.fractionalContribution !== undefined ? `${Math.round(c.fractionalContribution * 100)}%` : "—", c.riskSignificanceCriteriaBasis]),
  ));
  out.push(para(doc.importanceResults));

  out.push(heading("Screening audit", HeadingLevel.HEADING_1));
  out.push(para(a.screenedEventCumulativeAssessment?.cumulativeImpactAssessment ?? "No screened-event assessment recorded."));
  out.push(dataTable(
    ["Initiator", "Frequency (/yr)", "Conditional bound", "Family joined", "Basis"],
    (reviewWork.screened ?? []).map((bound) => [bound.groupId, val(bound.frequency), val(bound.conditional), bound.familyId ?? "Release total", bound.basis]),
  ));

  out.push(heading("Uncertainty results", HeadingLevel.HEADING_1));
  const sampled = a.uncertaintyWork?.run;
  out.push(para(sampled === undefined
    ? "No sampling run is kept."
    : `PRAXIS run ${sampled.runId} of ${sampled.at}: ${String(sampled.trials)} trials, seed ${String(sampled.seed)}, ${METHOD_LABELS[sampled.method].toLowerCase()} sampling, one draw per input shared by every event bound to it. Each family sums its sequences trial by trial.`));
  out.push(dataTable(
    ["Family", "Point (/yr)", "Mean (/yr)", "5th", "Median", "95th"],
    [
      ...(sampled?.families ?? []).map((f) => [f.familyId, val(f.point), val(f.mean), val(f.p05), val(f.p50), val(f.p95)]),
      ...(sampled?.total === undefined ? [] : [["Release total", val(sampled.total.point), val(sampled.total.mean), val(sampled.total.p05), val(sampled.total.p50), val(sampled.total.p95)]]),
    ],
  ));
  const independent = a.uncertaintyWork?.independent;
  if (independent?.total !== undefined && sampled?.total !== undefined) out.push(para(`With independent draws the release total mean is ${val(independent.total.mean)} per year, against ${val(sampled.total.mean)} with shared draws.`));

  out.push(heading("Model uncertainty & sensitivity", HeadingLevel.HEADING_1));
  out.push(para(doc.uncertaintySourcesDocumentation));
  out.push(dataTable(
    ["Source", "From", "Evaluation", "Effect on the families"],
    (a.modelUncertaintySourceAssessments ?? []).map((m) => [m.uncertaintySource, m.sourceElementCode, m.evaluationType === "QUANTITATIVE" ? "Case run" : "Qualitative", m.effectOnFamilyFrequencies]),
  ));
  out.push(dataTable(
    ["Case", "Changes", "Result"],
    (a.sensitivityStudies ?? []).map((study) => [study.name ?? study.uuid, study.description, study.results ?? "Not run"]),
  ));

  out.push(heading("Pre-operational assumptions", HeadingLevel.HEADING_1));
  out.push(dataTable(
    ["Assumption", "From", "Status", "Impact", "Closure"],
    (a.preOperationalAssumptions ?? []).map((item) => [item.description, (item.affectedTechnicalElementCodes ?? []).join(", "), item.status, item.riskImpact, item.closureBasis]),
  ));

  out.push(heading("Hand-offs", HeadingLevel.HEADING_1));
  const published = a.handoffWork?.published;
  out.push(para(published === undefined
    ? "The family package is not published."
    : `Published ${published.at} from revision ${String(published.revision)}: ${String(published.families)} families and ${String(published.measures)} importance measures.`));
  out.push(dataTable(
    ["RI item", "Response", "Status", "Sent to"],
    (a.handoffWork?.responses ?? []).map((response) => [response.ref, response.response, response.status, response.sentTo ?? "Kept in ESQ"]),
  ));

  out.push(heading("Limitations for applications", HeadingLevel.HEADING_1));
  out.push(para(doc.limitationsForApplications));

  out.push(heading("Conformance summary", HeadingLevel.HEADING_1));
  out.push(dataTable(
    ["SR", "HLR", "Category", "Status", "Evidence"],
    a.conformanceMatrix.map((c) => [c.sr, c.hlr, c.capabilityCategory, c.status, c.evidence]),
  ));

  out.push(heading("References", HeadingLevel.HEADING_1));
  out.push(bullet("Event sequence delineation and end states"));
  out.push(bullet("Linked fault-tree and event-tree model"));
  out.push(bullet("Basic-event and common-cause parameter set"));
  out.push(bullet("Truncation convergence study"));
  out.push(bullet("Barrier challenge and capacity analyses"));
  out.push(bullet("Uncertainty propagation method basis"));
  return out;
}

async function generateEsqReport(esq: EventSequenceQuantification, final: boolean): Promise<void> {
  const doc = new Document({ sections: [{ children: buildChildren(esq, final) }] });
  const blob = await Packer.toBlob(doc);
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${esq.name} — ESQ Analysis${final ? "" : " (draft)"}.docx`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export { generateEsqReport };
