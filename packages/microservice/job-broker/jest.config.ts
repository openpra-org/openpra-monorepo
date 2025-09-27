/* eslint-disable */
export default {
  displayName: "microservice-job-broker",
  preset: "../../../jest.preset.js",
  testEnvironment: "node",
  transform: {
    "^.+\\.[tj]s$": ["ts-jest", { tsconfig: "<rootDir>/tsconfig.spec.json" }],
  },
  moduleFileExtensions: ["ts", "js", "html"],
  snapshotFormat: { escapeString: true, printBasicPrototype: true },
  globalSetup: "<rootDir>/tests/unitTestSetup.ts",
  globalTeardown: "<rootDir>/tests/unitTestTeardown.ts",
  maxWorkers: 1,
  collectCoverage: true,
  coverageDirectory: "../../../coverage/packages/microservice-job-broker",
};
