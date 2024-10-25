import { QuantifyReport } from "shared-types/src/openpra-mef/util/quantify-report";

/**
 * Represents a collection of quantified reports.
 * Each report contains a configuration object and an array of results.
 *
 * Properties:
 * - `configuration`: An object containing various configuration options and parameters for the analysis.
 * - `results`: An array of results generated from the analysis.
 */
export const QuantifiedReports: QuantifyReport[] = [
  {
    configuration: {
      bdd: true,
      zbdd: false,
      mocus: true,
      "prime-implicants": false,
      probability: true,
      importance: false,
      uncertainty: true,
      ccf: false,
      sil: true,
      "rare-event": false,
      mcub: true,
      "limit-order": 10,
      "cut-off": 0.01,
      "mission-time": 100,
      "time-step": 1,
      "num-trials": 1000,
      "num-quantiles": 10,
      "num-bins": 20,
      seed: 12345,
      "no-indent": false,
      verbosity: 2,
      "no-report": false,
      output: "output/path1",
      models: ["model1", "model2"],
    },
    results: ["result1", "result2"],
  },
  {
    configuration: {
      bdd: false,
      zbdd: true,
      mocus: false,
      "prime-implicants": true,
      probability: false,
      importance: true,
      uncertainty: false,
      ccf: true,
      sil: false,
      "rare-event": true,
      mcub: false,
      "limit-order": 20,
      "cut-off": 0.02,
      "mission-time": 200,
      "time-step": 2,
      "num-trials": 2000,
      "num-quantiles": 20,
      "num-bins": 30,
      seed: 54321,
      "no-indent": true,
      verbosity: 3,
      "no-report": true,
      output: "output/path2",
      models: ["model3", "model4"],
    },
    results: ["result3", "result4"],
  },
  {
    configuration: {
      bdd: true,
      zbdd: true,
      mocus: true,
      "prime-implicants": true,
      probability: true,
      importance: true,
      uncertainty: true,
      ccf: true,
      sil: true,
      "rare-event": true,
      mcub: true,
      "limit-order": 30,
      "cut-off": 0.03,
      "mission-time": 300,
      "time-step": 3,
      "num-trials": 3000,
      "num-quantiles": 30,
      "num-bins": 40,
      seed: 67890,
      "no-indent": false,
      verbosity: 4,
      "no-report": false,
      output: "output/path3",
      models: ["model5", "model6"],
    },
    results: ["result5", "result6"],
  },
  {
    configuration: {
      bdd: false,
      zbdd: false,
      mocus: false,
      "prime-implicants": false,
      probability: false,
      importance: false,
      uncertainty: false,
      ccf: false,
      sil: false,
      "rare-event": false,
      mcub: false,
      "limit-order": 40,
      "cut-off": 0.04,
      "mission-time": 400,
      "time-step": 4,
      "num-trials": 4000,
      "num-quantiles": 40,
      "num-bins": 50,
      seed: 98765,
      "no-indent": true,
      verbosity: 5,
      "no-report": true,
      output: "output/path4",
      models: ["model7", "model8"],
    },
    results: ["result7", "result8"],
  },
  {
    configuration: {
      bdd: true,
      zbdd: false,
      mocus: true,
      "prime-implicants": false,
      probability: true,
      importance: false,
      uncertainty: true,
      ccf: false,
      sil: true,
      "rare-event": false,
      mcub: true,
      "limit-order": 50,
      "cut-off": 0.05,
      "mission-time": 500,
      "time-step": 5,
      "num-trials": 5000,
      "num-quantiles": 50,
      "num-bins": 60,
      seed: 11223,
      "no-indent": false,
      verbosity: 6,
      "no-report": false,
      output: "output/path5",
      models: ["model9", "model10"],
    },
    results: ["result9", "result10"],
  },
];

export const QuantifiedReport1: QuantifyReport = {
  configuration: {
    bdd: true,
    zbdd: false,
    mocus: true,
    "prime-implicants": false,
    probability: true,
    importance: false,
    uncertainty: true,
    ccf: false,
    sil: true,
    "rare-event": false,
    mcub: true,
    "limit-order": 50,
    "cut-off": 0.05,
    "mission-time": 500,
    "time-step": 5,
    "num-trials": 5000,
    "num-quantiles": 50,
    "num-bins": 60,
    seed: 11223,
    "no-indent": false,
    verbosity: 6,
    "no-report": false,
    output: "output/path5",
    models: ["model9", "model10"],
  },
  results: ["result9", "result10"],
};