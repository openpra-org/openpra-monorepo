/**
 * Represents various invalid request bodies for testing purposes.
 * Each object contains different types of invalid configurations to test validation logic.
 */
export const InvalidKeyType = {
  bdd: true, // Wrong type, should be a boolean
  probability: true,
  mcub: true,
  "limit-order": "10", // Wrong type, should be a number
  output: "output.xml",
  models: ["<xml>model1</xml>", "<xml>model2</xml>"],
};

export const MultipleInvalidKeyTypes = {
  bdd: "true", // Wrong type, should be a boolean
  "prime-implicants": true,
  "rare-event": true,
  "limit-order": "10", // Wrong type, should be a number
  output: "output.xml",
  models: "<xml>model1</xml>", // Wrong type, should be an array of strings
};

export const MissingRequiredKey = {
  mocus: true,
  probability: true,
  mcub: true,
  output: "output.xml",
  // Missing 'models' key
};

export const InvalidAdditionalKey = {
  mocus: true,
  probability: true,
  mcub: true,
  output: "output.xml",
  models: ["<xml>model1</xml>", "<xml>model2</xml>"],
  extraKey: "extraValue", // Additional key not in the interface
};

export const InvalidCombination1 = {
  bdd: true,
  zbdd: true, // BDD and ZBDD algorithm cannot be used at the same time
  probability: true,
  "rare-event": true,
  output: "/tmp/output.xml",
  models: ["<xml>model1</xml>", "<xml>model2</xml>"],
};

export const InvalidCombination2 = {
  mocus: true,
  "rare-event": true,
  mcub: true, // Rare-event and MCUB approximation cannot be used at the same time
  output: "/tmp/output.xml",
  models: ["<xml>model1</xml>", "<xml>model2</xml>"],
};

export const InvalidCombination3 = {
  bdd: true,
  mcub: true, // no approximation can be used while evaluating prime implicants
  "prime-implicants": true,
  output: "/tmp/output.xml",
  models: ["<xml>model1</xml>", "<xml>model2</xml>"],
};

export const InvalidCombination4 = {
  zbdd: true,
  mcub: true,
  "prime-implicants": true, // prime implicants can only be evaluated using BDD algorithm
  output: "/tmp/output.xml",
  models: ["<xml>model1</xml>", "<xml>model2</xml>"],
};

export const InvalidCombination5 = {
  mocus: true,
  mcub: true,
  sil: true,
  // time-step: 10, time step must be provided while evaluating safety integrity levels.
  output: "/tmp/output.xml",
  models: ["<xml>model1</xml>", "<xml>model2</xml>"],
};

export const InvalidLimits1 = {
  mocus: true,
  probability: true,
  mcub: true,
  "limit-order": -1, // Invalid: must be 0 or greater
  output: "/tmp/output.xml",
  models: ["<xml>model1</xml>", "<xml>model2</xml>"],
};

export const InvalidLimits2 = {
  mocus: true,
  probability: true,
  mcub: true,
  "cut-off": 1.5, // Invalid: must be between 0 and 1
  output: "/tmp/output.xml",
  models: ["<xml>model1</xml>", "<xml>model2</xml>"],
};

export const InvalidLimits3 = {
  mocus: true,
  probability: true,
  mcub: true,
  "num-trials": 0, // Invalid: must be 1 or greater
  output: "/tmp/output.xml",
  models: ["<xml>model1</xml>", "<xml>model2</xml>"],
};

export const InvalidLimits4 = {
  mocus: true,
  probability: true,
  mcub: true,
  "num-quantiles": 0, // Invalid: must be 1 or greater
  output: "/tmp/output.xml",
  models: ["<xml>model1</xml>", "<xml>model2</xml>"],
};

export const InvalidLimits5 = {
  mocus: true,
  probability: true,
  mcub: true,
  "num-bins": 0, // Invalid: must be 1 or greater
  output: "/tmp/output.xml",
  models: ["<xml>model1</xml>", "<xml>model2</xml>"],
};

export const InvalidLimits6 = {
  mocus: true,
  probability: true,
  mcub: true,
  seed: -1, // Invalid: must be 0 or greater
  output: "/tmp/output.xml",
  models: ["<xml>model1</xml>", "<xml>model2</xml>"],
};

export const InvalidLimits7 = {
  mocus: true,
  probability: true,
  mcub: true,
  "mission-time": -1, // Invalid: must be 0 or greater
  output: "/tmp/output.xml",
  models: ["<xml>model1</xml>", "<xml>model2</xml>"],
};

export const InvalidLimits8 = {
  mocus: true,
  probability: true,
  mcub: true,
  "time-step": -1, // Invalid: must be 0 or greater
  output: "/tmp/output.xml",
  models: ["<xml>model1</xml>", "<xml>model2</xml>"],
};

export const InvalidLimits9 = {
  mocus: true,
  probability: true,
  mcub: true,
  verbosity: 8, // Invalid: must be between 0 and 7
  output: "/tmp/output.xml",
  models: ["<xml>model1</xml>", "<xml>model2</xml>"],
};
