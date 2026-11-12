import type { SpecMapping } from "../core/spec-values";

const recoveryDgPhaseR1: SpecMapping = {
  schema_version: "0.1.0",
  dataset_id: "recovery_dg_edg_2022_phaseR1",
  description: "Curated EDG Weibull repair-time parameters for DG non-recovery factors in Recovery Phase R1.",
  source: {
    type: "report_extract",
    path: "https://nrcoe.inl.gov/publicdocs/CompPerf/edg-2022.pdf",
    table: "Table 6 / This Update",
    notes: [
      "Alpha and beta are for the pooled EDG repair-time Weibull model in the 2022 update.",
      "Builder emits non-recovery factors P(T_repair > t) for random/recoverable DG failure modes.",
    ],
  },
  curves: {
    edg_2022_pooled: {
      alpha: 0.656,
      beta_hours: 27.46,
      description: "Pooled EDG repair-time Weibull from NRC/INL EDG 1998-2022 update.",
    },
  },
  default_curve_id: "edg_2022_pooled",
  metadata: {
    phase: "R1",
    use_case: "DG recovery baseline for BN recovery layer",
  },
};

export { recoveryDgPhaseR1 };
