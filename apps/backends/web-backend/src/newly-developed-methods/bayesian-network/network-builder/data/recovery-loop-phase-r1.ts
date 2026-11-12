import type { SpecMapping } from "../core/spec-values";

const recoveryLoopPhaseR1: SpecMapping = {
  schema_version: "0.1.0",
  dataset_id: "recovery_loop_inl_2023_phaseR1",
  description: "Curated INL 2023 LOOP category-level fitted lognormal recovery parameters for Recovery Phase R1.",
  source: {
    type: "report_extract",
    path: "https://nrcoe.inl.gov/publicdocs/LOSP/loop-summary-update-2023.pdf",
    table: "Table 7",
    notes: [
      "Category-level fits are used as baseline recovery distributions for LOOP.",
      "This dataset does not provide a direct hazard-intensity-to-recovery fit.",
      "Hazard effects are modeled via regime/feasibility conditioning in the BN.",
    ],
  },
  tables: {
    table_7_fitted_lognormal: {
      table_id: "7",
      title: "Fitted lognormal recovery time distributions (1997-2023)",
      rows: {
        PC: {
          event_count: 16,
          mu: 0.53,
          mu_se: 0.55,
          sigma: 2.19,
          sigma_se: 0.39,
          fitted_median_hour: 1.69,
          fitted_mean_hour: 18.61,
          fitted_p95_hour: 62.07,
          error_factor: 36.71,
        },
        SC: {
          event_count: 32,
          mu: 0.33,
          mu_se: 0.3,
          sigma: 1.69,
          sigma_se: 0.21,
          fitted_median_hour: 1.39,
          fitted_mean_hour: 5.78,
          fitted_p95_hour: 22.35,
          error_factor: 16.14,
        },
        GR: {
          event_count: 17,
          mu: 0.35,
          mu_se: 0.33,
          sigma: 1.36,
          sigma_se: 0.23,
          fitted_median_hour: 1.42,
          fitted_mean_hour: 3.57,
          fitted_p95_hour: 13.26,
          error_factor: 9.35,
        },
        WR: {
          event_count: 20,
          mu: 1.83,
          mu_se: 0.44,
          sigma: 1.99,
          sigma_se: 0.31,
          fitted_median_hour: 6.2,
          fitted_mean_hour: 44.49,
          fitted_p95_hour: 162.47,
          error_factor: 26.19,
        },
      },
    },
  },
  metadata: {
    phase: "R1",
    use_case: "LOOP recovery baseline for BN recovery layer",
  },
};

export { recoveryLoopPhaseR1 };
