export default {
  displayName: "interfaces-shared-types",
  rootDir: "..",
  preset: "../../../jest.preset.js",
  testEnvironment: "node",
  transform: {
    "^.+\\.[tj]sx?$": [
      "@swc/jest",
      {
        jsc: {
          parser: { syntax: "typescript", decorators: true },
          target: "es2020",
          transform: { legacyDecorator: true, decoratorMetadata: false },
        },
        module: { type: "commonjs" },
        sourceMaps: "inline",
      },
    ],
  },
  moduleNameMapper: {
    "^interfaces-mef-types$": "<rootDir>/../mef-types/index.ts",
    "^interfaces-mef-types/(.*)$": "<rootDir>/../mef-types/$1",
  },
  moduleFileExtensions: ["ts", "tsx", "js", "jsx"],
  testMatch: ["<rootDir>/**/test/*.spec.ts"],
  collectCoverage: false,
};
