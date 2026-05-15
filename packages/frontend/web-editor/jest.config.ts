export default {
  displayName: "frontend-web-editor",
  preset: "../../../jest.preset.js",
  testEnvironment: "jest-environment-jsdom",
  transform: {
    "^(?!.*\\.(js|jsx|ts|tsx|css|json)$)": "@nx/react/plugins/jest",
    "^.+\\.[tj]sx?$": [
      "@swc/jest",
      {
        jsc: {
          parser: { syntax: "typescript", tsx: true, decorators: true },
          target: "es2020",
          transform: {
            react: { runtime: "automatic" },
            legacyDecorator: true,
            decoratorMetadata: false,
          },
        },
        module: { type: "commonjs" },
        sourceMaps: "inline",
      },
    ],
  },
  moduleFileExtensions: ["ts", "tsx", "js", "jsx"],
  moduleNameMapper: {
    "^uuid$": require.resolve("uuid"),
    "^shared-sdk/(.*)$": "<rootDir>/../../shared-sdk/src/$1",
    "^shared-sdk$": "<rootDir>/../../shared-sdk/src/index.ts",
    "^shared-types/src/(.*)$": "<rootDir>/../../shared-types/src/$1",
    "^shared-types/(.*)$": "<rootDir>/../../shared-types/src/$1",
    "^shared-types$": "<rootDir>/../../shared-types/src/index.ts",
    "^mef-types/(.*)": "<rootDir>/../../mef-types/src/$1",
    "^mef-types$": "<rootDir>/../../mef-types/src/index.ts",
  },
  setupFiles: ["<rootDir>/src/tests/mocks.js"],
  testPathIgnorePatterns: ["<rootDir>/tests/e2e/", "<rootDir>/tests/app/"],
};
