export const InvalidResult = {
  task: {
    executable: "scram-cli",
    arguments: ["--bdd", "--probability", "--mcub", "input1.xml"],
    env_vars: ["DEBUG=true"],
    stdin: "",
    tty: true,
  },
  exit_code: 0,
  //stderr: "", stderr is missing
  stdout: "SCRAM quantification successful",
};
