/* eslint-disable */
export default {
  displayName: "model-generator",
  preset: "../../jest.preset.js",
  testEnvironment: "node",
  transform: {
    "^.+\\.[tj]s$": ["ts-jest", { tsconfig: "<rootDir>/tsconfig.spec.json" }],
  },
  moduleFileExtensions: ["ts", "js", "html"],
  coverageDirectory: "../../coverage/packages/model-generator",
  globalSetup: "<rootDir>/test/GlobalSetup.ts",
  globalTeardown: "<rootDir>/test/GlobalTeardown.ts",
};
