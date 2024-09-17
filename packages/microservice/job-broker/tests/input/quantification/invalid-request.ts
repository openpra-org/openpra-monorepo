/**
 * Represents various invalid request bodies for testing purposes.
 * Each object contains different types of invalid configurations to test validation logic.
 */
export const InvalidKeyType = {
  bdd: "true", // Wrong type, should be a boolean
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
  "limit-order": "10", // Wrong type, should be a number
  "cut-off": 0.01,
  "mission-time": 1000,
  "time-step": 10,
  "num-trials": 1000,
  "num-quantiles": 10,
  "num-bins": 10,
  seed: 12345,
  "no-indent": true,
  verbosity: 2,
  output: "output.xml",
  models: ["<xml>model1</xml>", "<xml>model2</xml>"],
};

export const MultipleInvalidKeyTypes = {
  bdd: "true", // Wrong type, should be a boolean
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
  "limit-order": "10", // Wrong type, should be a number
  "cut-off": 0.01,
  "mission-time": 1000,
  "time-step": 10,
  "num-trials": 1000,
  "num-quantiles": 10,
  "num-bins": 10,
  seed: 12345,
  "no-indent": true,
  verbosity: 2,
  output: "output.xml",
  models: "<xml>model1</xml>", // Wrong type, should be an array of strings
};

export const MissingRequiredKey = {
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
  output: "output.xml",
  // Missing 'models' key
};

export const InvalidAdditionalKey = {
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
  output: "output.xml",
  models: ["<xml>model1</xml>", "<xml>model2</xml>"],
  extraKey: "extraValue", // Additional key not in the interface
};

export const InvalidCombination1 = {
  bdd: true,
  zbdd: true, // BDD and ZBDD algorithm cannot be used at the same time
  mocus: false,
  "prime-implicants": true,
  probability: true,
  importance: true,
  uncertainty: true,
  ccf: true,
  sil: true,
  "rare-event": false,
  mcub: false,
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
  output: "output.xml",
  models: ["<xml>model1</xml>", "<xml>model2</xml>"],
};

export const InvalidCombination2 = {
  bdd: false,
  zbdd: false,
  mocus: true,
  "prime-implicants": true,
  probability: true,
  importance: true,
  uncertainty: true,
  ccf: true,
  sil: true,
  "rare-event": true,
  mcub: true, // Rare-event and MCUB approximation cannot be used at the same time
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
  output: "output.xml",
  models: ["<xml>model1</xml>", "<xml>model2</xml>"],
};

export const InvalidLimits1 = {
  bdd: true,
  zbdd: false,
  mocus: false,
  "prime-implicants": true,
  probability: true,
  importance: true,
  uncertainty: true,
  ccf: true,
  sil: true,
  "rare-event": false,
  mcub: false,
  "limit-order": -1, // Invalid: must be 0 or greater
  "cut-off": 0.01,
  "mission-time": 1000,
  "time-step": 10,
  "num-trials": 1000,
  "num-quantiles": 10,
  "num-bins": 10,
  seed: 12345,
  "no-indent": true,
  verbosity: 2,
  output: "output.xml",
  models: ["<xml>model1</xml>", "<xml>model2</xml>"],
};

export const InvalidLimits2 = {
  bdd: true,
  zbdd: false,
  mocus: false,
  "prime-implicants": true,
  probability: true,
  importance: true,
  uncertainty: true,
  ccf: true,
  sil: true,
  "rare-event": false,
  mcub: false,
  "limit-order": 10,
  "cut-off": 1.5, // Invalid: must be between 0 and 1
  "mission-time": 1000,
  "time-step": 10,
  "num-trials": 1000,
  "num-quantiles": 10,
  "num-bins": 10,
  seed: 12345,
  "no-indent": true,
  verbosity: 2,
  output: "output.xml",
  models: ["<xml>model1</xml>", "<xml>model2</xml>"],
};

export const InvalidLimits3 = {
  bdd: true,
  zbdd: false,
  mocus: false,
  "prime-implicants": true,
  probability: true,
  importance: true,
  uncertainty: true,
  ccf: true,
  sil: true,
  "rare-event": false,
  mcub: false,
  "limit-order": 10,
  "cut-off": 0.01,
  "mission-time": 1000,
  "time-step": 10,
  "num-trials": 0, // Invalid: must be 1 or greater
  "num-quantiles": 10,
  "num-bins": 10,
  seed: 12345,
  "no-indent": true,
  verbosity: 2,
  output: "output.xml",
  models: ["<xml>model1</xml>", "<xml>model2</xml>"],
};

export const InvalidLimits4 = {
  bdd: true,
  zbdd: false,
  mocus: false,
  "prime-implicants": true,
  probability: true,
  importance: true,
  uncertainty: true,
  ccf: true,
  sil: true,
  "rare-event": false,
  mcub: false,
  "limit-order": 10,
  "cut-off": 0.01,
  "mission-time": 1000,
  "time-step": 10,
  "num-trials": 1000,
  "num-quantiles": 0, // Invalid: must be 1 or greater
  "num-bins": 10,
  seed: 12345,
  "no-indent": true,
  verbosity: 2,
  output: "output.xml",
  models: ["<xml>model1</xml>", "<xml>model2</xml>"],
};

export const InvalidLimits5 = {
  bdd: true,
  zbdd: false,
  mocus: false,
  "prime-implicants": true,
  probability: true,
  importance: true,
  uncertainty: true,
  ccf: true,
  sil: true,
  "rare-event": false,
  mcub: false,
  "limit-order": 10,
  "cut-off": 0.01,
  "mission-time": 1000,
  "time-step": 10,
  "num-trials": 1000,
  "num-quantiles": 10,
  "num-bins": 0, // Invalid: must be 1 or greater
  seed: 12345,
  "no-indent": true,
  verbosity: 2,
  output: "output.xml",
  models: ["<xml>model1</xml>", "<xml>model2</xml>"],
};

export const InvalidLimits6 = {
  bdd: true,
  zbdd: false,
  mocus: false,
  "prime-implicants": true,
  probability: true,
  importance: true,
  uncertainty: true,
  ccf: true,
  sil: true,
  "rare-event": false,
  mcub: false,
  "limit-order": 10,
  "cut-off": 0.01,
  "mission-time": 1000,
  "time-step": 10,
  "num-trials": 1000,
  "num-quantiles": 10,
  "num-bins": 10,
  seed: -1, // Invalid: must be 0 or greater
  "no-indent": true,
  verbosity: 2,
  output: "output.xml",
  models: ["<xml>model1</xml>", "<xml>model2</xml>"],
};

export const InvalidLimits7 = {
  bdd: true,
  zbdd: false,
  mocus: false,
  "prime-implicants": true,
  probability: true,
  importance: true,
  uncertainty: true,
  ccf: true,
  sil: true,
  "rare-event": false,
  mcub: false,
  "limit-order": 10,
  "cut-off": 0.01,
  "mission-time": -1, // Invalid: must be 0 or greater
  "time-step": 10,
  "num-trials": 1000,
  "num-quantiles": 10,
  "num-bins": 10,
  seed: 12345,
  "no-indent": true,
  verbosity: 2,
  output: "output.xml",
  models: ["<xml>model1</xml>", "<xml>model2</xml>"],
};

export const InvalidLimits8 = {
  bdd: true,
  zbdd: false,
  mocus: false,
  "prime-implicants": true,
  probability: true,
  importance: true,
  uncertainty: true,
  ccf: true,
  sil: true,
  "rare-event": false,
  mcub: false,
  "limit-order": 10,
  "cut-off": 0.01,
  "mission-time": 1000,
  "time-step": -1, // Invalid: must be 0 or greater
  "num-trials": 1000,
  "num-quantiles": 10,
  "num-bins": 10,
  seed: 12345,
  "no-indent": true,
  verbosity: 2,
  output: "output.xml",
  models: ["<xml>model1</xml>", "<xml>model2</xml>"],
};

export const InvalidLimits9 = {
  bdd: true,
  zbdd: false,
  mocus: false,
  "prime-implicants": true,
  probability: true,
  importance: true,
  uncertainty: true,
  ccf: true,
  sil: true,
  "rare-event": false,
  mcub: false,
  "limit-order": 10,
  "cut-off": 0.01,
  "mission-time": 1000,
  "time-step": 10,
  "num-trials": 1000,
  "num-quantiles": 10,
  "num-bins": 10,
  seed: 12345,
  "no-indent": true,
  verbosity: 8, // Invalid: must be between 0 and 7
  output: "output.xml",
  models: ["<xml>model1</xml>", "<xml>model2</xml>"],
};
