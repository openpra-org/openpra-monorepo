/**
 * Represents a valid request body for quantification request.
 * This object contains the configuration options and parameters for the quantification.
 *
 * Properties:
 * - `bdd`: Boolean flag to enable Binary Decision Diagram (BDD) analysis.
 * - `zbdd`: Boolean flag to disable Zero-suppressed Binary Decision Diagram (ZBDD) analysis.
 * - `mocus`: Boolean flag to enable MOCUS analysis.
 * - `prime-implicants`: Boolean flag to enable prime implicants analysis.
 * - `probability`: Boolean flag to enable probability analysis.
 * - `importance`: Boolean flag to enable importance analysis.
 * - `uncertainty`: Boolean flag to enable uncertainty analysis.
 * - `ccf`: Boolean flag to enable Common Cause Failure (CCF) analysis.
 * - `sil`: Boolean flag to enable Safety Integrity Level (SIL) analysis.
 * - `rare-event`: Boolean flag to enable rare event approximation.
 * - `mcub`: Boolean flag to enable min-cut upper bound approximation.
 * - `limit-order`: Limit order for the analysis.
 * - `cut-off`: Cut-off value for the analysis.
 * - `mission-time`: Mission time for the analysis in seconds.
 * - `time-step`: Time step for the analysis in seconds.
 * - `num-trials`: Number of trials for the analysis.
 * - `num-quantiles`: Number of quantiles for the analysis.
 * - `num-bins`: Number of bins for the analysis.
 * - `seed`: Seed value for random number generation.
 * - `no-indent`: Boolean flag to disable indentation in the output.
 * - `verbosity`: Verbosity level for the output.
 * - `no-report`: Boolean flag to disable report generation.
 * - `output`: Output file name.
 * - `models`: Array of models in XML format.
 */
export const ValidQuantifyRequest = {
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
  models: ["<xml>model1</xml>", "<xml>model2</xml>"],
};
