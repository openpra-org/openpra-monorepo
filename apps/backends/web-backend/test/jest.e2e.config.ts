export default {
  displayName: "backends-web-backend-e2e",
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
  testMatch: ["<rootDir>/src/**/test/*.e2e-spec.ts"],
  transformIgnorePatterns: ["node_modules/(?!.*(?:otplib|@otplib|@scure|@noble))"],
  testTimeout: 60000,
  maxWorkers: 1,
  moduleNameMapper: {
    "^@nestjs/(.+)$": "<rootDir>/node_modules/@nestjs/$1",
    "^interfaces-shared-types$": "<rootDir>/../../interfaces/shared-types/index.ts",
    "^interfaces-shared-types/(.*)$": "<rootDir>/../../interfaces/shared-types/$1",
    "^interfaces-mef-types$": "<rootDir>/../../interfaces/mef-types/index.ts",
    "^interfaces-mef-types/(.*)$": "<rootDir>/../../interfaces/mef-types/$1",
  },
  collectCoverage: false,
};
