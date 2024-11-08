/**
 * Represents various invalid request bodies for testing purposes.
 * Each object contains different types of invalid configurations to test validation logic.
 */
export const InvalidKeyType = {
  executable: "scram", // Wrong value, should be "scram-cli"
  arguments: ["--bdd", "--probability", "--mcub", "input1.xml"],
  env_vars: ["DEBUG=true"],
  stdin: "Some input data for the program",
  tty: false,
};

export const MultipleInvalidKeyTypes = {
  executable: "scram-cli",
  arguments: ["--bdd", "--probability", "--mcub", "input1.xml"],
  env_vars: "DEBUG=true", // Wrong type, should be an array of string
  stdin: ["Some input data for the program"], // Wrong type, should be a string
  tty: "true", // Wrong type, should be a boolean
};

export const MissingRequiredKey = {
  // Missing 'executable' key
  arguments: ["--bdd", "--probability", "--mcub", "input1.xml"],
  env_vars: ["DEBUG=true"],
  stdin: "Some input data for the program",
  tty: false,
};

export const InvalidAdditionalKey = {
  executable: "scram-cli",
  arguments: ["--bdd", "--probability", "--mcub", "input1.xml"],
  env_vars: ["DEBUG=true"],
  stdin: "Some input data for the program",
  tty: false,
  cwd: "/home/user/project", // Additional key not in the interface
};
