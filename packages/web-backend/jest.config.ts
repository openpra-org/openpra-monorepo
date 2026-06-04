export default {
  displayName: "web-backend",
  preset: "../../jest.preset.js",
  testEnvironment: "node",
  transform: {
    "^.+\\.[tj]s$": [
      "@swc/jest",
      {
        jsc: {
          parser: { syntax: "typescript", tsx: false, decorators: true },
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
  moduleNameMapper: {
    "^shared-sdk$": "<rootDir>/../shared-sdk/src/index.ts",
    "^shared-types$": "<rootDir>/../shared-types/src/index.ts",
  },
  maxWorkers: 1,
};
