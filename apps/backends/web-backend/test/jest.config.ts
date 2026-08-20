export default {
  displayName: "backends-web-backend",
  rootDir: "..",
  preset: "../../../jest.preset.js",
  testEnvironment: "node",
  transform: {
    "^.+\\.[tj]s$": [
      "@swc/jest",
      {
        jsc: {
          parser: { syntax: "typescript", tsx: false, decorators: true },
          target: "es2020",
          transform: { legacyDecorator: true, decoratorMetadata: true },
        },
        module: { type: "commonjs" },
        sourceMaps: "inline",
      },
    ],
  },
  moduleFileExtensions: ["ts", "js"],
  testMatch: ["<rootDir>/src/**/test/*.spec.ts"],
  transformIgnorePatterns: ["node_modules/(?!.*(?:otplib|@otplib|@scure|@noble))"],
  moduleNameMapper: {
    "^interfaces-shared-types$": "<rootDir>/../../interfaces/shared-types/index.ts",
    "^interfaces-shared-types/(.*)$": "<rootDir>/../../interfaces/shared-types/$1",
    "^interfaces-mef-types$": "<rootDir>/../../interfaces/mef-types/index.ts",
    "^interfaces-mef-types/(.*)$": "<rootDir>/../../interfaces/mef-types/$1",
  },
  collectCoverage: false,
};
