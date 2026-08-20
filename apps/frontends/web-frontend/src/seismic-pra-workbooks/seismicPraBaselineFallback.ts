import {
  type BaselinePraDefinition,
  type BaselinePraRecordTreatment,
  type SeismicPraEvidenceRecord,
} from "interfaces-mef-types/seismic/seismic-pra";
import { type SeismicPraVariant } from "./seismicPraWorkbookContext";

function exampleBaselinePra(
  variant: SeismicPraVariant,
  evidenceRegister: SeismicPraEvidenceRecord[],
): BaselinePraDefinition {
  const isSfr = variant === "sfr";
  const prefix = variant.toUpperCase();
  const modelReference = isSfr
    ? "PRA-SFR-BASELINE-2026.1"
    : "DOE-HTGR-86-011";
  const sourceEvidenceRef =
    evidenceRegister.find(
      (evidence) => evidence.sourceReference.includes(modelReference),
    )?.uuid ?? "";
  const status = (
    openForHtgr = false,
  ): BaselinePraRecordTreatment["status"] =>
    !isSfr && openForHtgr ? "OPEN" : "CONFIRMED";
  const treatment = (
    suffix: string,
    value: Omit<BaselinePraRecordTreatment, "uuid">,
  ): BaselinePraRecordTreatment => ({
    uuid: `BASELINE-${prefix}-${suffix}`,
    ...value,
  });

  return {
    modelName: isSfr
      ? "Generic SFR baseline internal-events PRA"
      : "MHTGR PRA model basis",
    modelReference,
    sourceEvidenceRef,
    revision: isSfr ? "2026.1" : "3",
    freezeDate: isSfr ? "2026-01-15" : "1987-01-01",
    freezeStatus: isSfr ? "FROZEN" : "REFERENCE_ONLY",
    modelBoundary:
      "Retain applicable baseline operating states, random initiators, event sequences, success criteria, systems, data, and human actions; add only the seismic initiators, failures, dependencies, and quantification logic needed for Seismic PRA.",
    nonSeismicHazardModelRefs: isSfr
      ? [
        "FIRE-PRA-SFR-2026.1",
        "INTERNAL-FLOOD-PRA-SFR-2026.1",
        "EXTERNAL-HAZARDS-PRA-SFR-2026.1",
        "RI-SFR-2026.1",
      ]
      : [
        "MHTGR internal-fire model — version not available",
        "MHTGR internal-flood model — version not available",
        "MHTGR external-hazards model — version not available",
        "MHTGR risk-integration model — version not available",
      ],
    recordTreatments: [
      treatment("POS", {
        name: "Plant operating states",
        technicalArea: "PLANT_OPERATING_STATES",
        sourceRecordRefs: ["POS"],
        treatment: "REUSED",
        seismicChange:
          "Use the retained baseline operating states and radioactive-material-source scope without redefining them.",
        owner: "PRA integration",
        status: "CONFIRMED",
      }),
      treatment("IE", {
        name: "Random initiating events",
        technicalArea: "INITIATING_EVENTS",
        sourceRecordRefs: ["IE"],
        treatment: "MODIFIED",
        seismicChange:
          "Retain applicable random initiators and identify direct seismic and retained secondary-hazard initiators separately.",
        owner: "Plant response",
        status: "CONFIRMED",
      }),
      treatment("ES", {
        name: "Event sequences and end states",
        technicalArea: "EVENT_SEQUENCES",
        sourceRecordRefs: ["ES"],
        treatment: "MODIFIED",
        seismicChange:
          "Preserve applicable sequence logic and add branches for seismic failures, dependencies, and secondary hazards.",
        owner: "Plant response",
        status: "CONFIRMED",
      }),
      treatment("SC", {
        name: "Success criteria and mission times",
        technicalArea: "SUCCESS_CRITERIA",
        sourceRecordRefs: ["SC"],
        treatment: "MODIFIED",
        seismicChange:
          "Reconfirm success criteria and mission times for post-earthquake equipment, access, and support conditions.",
        owner: "Systems engineering",
        status: "CONFIRMED",
      }),
      treatment("SY", {
        name: "Systems and support functions",
        technicalArea: "SYSTEMS",
        sourceRecordRefs: ["SY"],
        treatment: "MODIFIED",
        seismicChange:
          "Retain applicable random failures and add seismic failure modes, correlated failures, and lost support functions.",
        owner: "Systems engineering",
        status: "CONFIRMED",
      }),
      treatment("DA", {
        name: "Reliability data",
        technicalArea: "DATA",
        sourceRecordRefs: ["DA"],
        treatment: "MODIFIED",
        seismicChange:
          "Retain applicable random-failure data and add hazard, response, fragility, and seismic-correlation parameters.",
        owner: "PRA data",
        status: "CONFIRMED",
      }),
      treatment("HR", {
        name: "Human failure events",
        technicalArea: "HUMAN_RELIABILITY",
        sourceRecordRefs: ["HR"],
        treatment: "MODIFIED",
        seismicChange:
          "Retain applicable actions but reassess cues, timing, workload, access, communications, and dependencies after an earthquake.",
        owner: "Human reliability",
        status: "CONFIRMED",
      }),
      treatment("FIRE", {
        name: "Internal-fire model",
        technicalArea: "INTERNAL_FIRE",
        sourceRecordRefs: ["F"],
        treatment: "MODIFIED",
        seismicChange:
          "Use the baseline fire model only for retained earthquake-induced ignition sources and affected fire areas.",
        owner: "Fire PRA",
        status: status(true),
      }),
      treatment("FLOOD", {
        name: "Internal-flood model",
        technicalArea: "INTERNAL_FLOOD",
        sourceRecordRefs: ["FL"],
        treatment: "MODIFIED",
        seismicChange:
          "Use the baseline flood model only for retained seismically failed sources, propagation paths, and affected equipment.",
        owner: "Internal-flood PRA",
        status: status(true),
      }),
      treatment("EXTERNAL", {
        name: "External-hazards model",
        technicalArea: "EXTERNAL_HAZARDS",
        sourceRecordRefs: ["XF", "O"],
        treatment: "MODIFIED",
        seismicChange:
          "Transfer retained earthquake-induced external hazards through controlled interfaces without duplicating their risk.",
        owner: "External hazards",
        status: status(true),
      }),
      treatment("RI", {
        name: "Risk-integration model",
        technicalArea: "RISK_INTEGRATION",
        sourceRecordRefs: ["RI"],
        treatment: "MODIFIED",
        seismicChange:
          "Prepare non-overlapping seismic results for later integration with internal events and other hazards.",
        owner: "Risk integration",
        status: status(true),
      }),
      treatment("SEISMIC-FAILURES", {
        name: "Seismic SSC failure logic",
        technicalArea: "SEISMIC_LOGIC",
        sourceRecordRefs: [],
        treatment: "NEW",
        seismicChange:
          "Create fragility-based SSC failure events, physical failure effects, and justified correlation groups.",
        owner: "Fragility and systems",
        status: "CONFIRMED",
      }),
      treatment("SEISMIC-QUANT", {
        name: "Hazard-fragility integration",
        technicalArea: "SEISMIC_LOGIC",
        sourceRecordRefs: [],
        treatment: "NEW",
        seismicChange:
          "Create the seismic hazard-interval and numerical-integration logic used to calculate annual sequence frequencies.",
        owner: "Seismic quantification",
        status: "CONFIRMED",
      }),
    ],
    unresolvedInterfaces: isSfr
      ? []
      : [
        "Executable MHTGR PRA database, software version, and reproducible run package",
        "Controlled MHTGR internal-fire and internal-flood model versions",
        "Controlled external-hazards and risk-integration model versions",
      ],
  };
}

export { exampleBaselinePra };
