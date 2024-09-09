/**
 * Represents an invalid quantification report.
 * This object contains the configuration options and parameters for the quantification,
 * but the results field is a single string instead of an array of strings.
 */
export const InvalidReport = {
  configuration: {
    bdd: true,
    zbdd: false,
    mocus: true,
    "prime-implicants": true,
    probability: true,
    importance: true,
    uncertainty: true,
    ccf: true,
    sil: true,
    "rare-event": true,
    mcub: true,
    "limit-order": 10,
    "cut-off": 0.01,
    "mission-time": 1000,
    "time-step": 10,
    "num-trials": 1000,
    "num-quantiles": 10,
    "num-bins": 10,
    seed: 12345,
    "no-indent": true,
    verbosity: 2,
    "no-report": true,
    output: "output.xml",
    models: ["input1.xml", "input2.xml"],
  },
  results: "This should be an array of strings, but it's a single string.",
};
