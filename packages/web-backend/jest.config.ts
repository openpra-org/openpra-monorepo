/* eslint-disable */
export default {
  displayName: "web-backend",
  preset: "../../jest.preset.js",
  testEnvironment: "node",
  transform: {
    "^.+\\.[tj]s$": ["ts-jest", { tsconfig: "<rootDir>/tsconfig.spec.json" }],
  },
  moduleFileExtensions: ["ts", "js", "html"],
  snapshotFormat: { escapeString: true, printBasicPrototype: true },
  globalSetup: "<rootDir>/test/unitTestSetup.ts",
  globalTeardown: "<rootDir>/test/unitTestTeardown.ts",
  maxWorkers: 1,
  collectCoverage: true,
  coverageDirectory: "../../coverage/packages/web-backend",
};
