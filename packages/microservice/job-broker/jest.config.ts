export default {
  displayName: "microservice-job-broker",
  preset: "../../../jest.preset.js",
  testEnvironment: "node",
  transform: {
    "^.+\\.[tj]s$": [
      "@swc/jest",
      {
        jsc: {
          parser: { syntax: "typescript", decorators: true },
          target: "es2020",
          transform: { decoratorMetadata: true },
        },
        module: { type: "commonjs" },
        sourceMaps: "inline",
      },
    ],
  },
  moduleFileExtensions: ["ts", "js", "html"],
  snapshotFormat: { escapeString: true, printBasicPrototype: true },
  globalSetup: "<rootDir>/tests/unitTestSetup.ts",
  globalTeardown: "<rootDir>/tests/unitTestTeardown.ts",
  maxWorkers: 1,
  moduleNameMapper: {
    "^shared-types/src/(.*)$": "<rootDir>/../../shared-types/src/$1",
    "^shared-types/(.*)$": "<rootDir>/../../shared-types/src/$1",
    "^shared-types$": "<rootDir>/../../shared-types/src/index.ts",
    "^mef-types/(.*)$": "<rootDir>/../../mef-types/src/$1",
    "^mef-types$": "<rootDir>/../../mef-types/src/index.ts",
  },
};
