/* eslint-disable */
export default {
  displayName: "frontend-web-editor",
  preset: "../../../jest.preset.js",
  testEnvironment: "jest-environment-jsdom",
  transform: {
    "^(?!.*\\.(js|jsx|ts|tsx|css|json)$)": "@nx/react/plugins/jest",
    "^.+\\.[tj]sx?$": ["babel-jest", { presets: ["@nx/react/babel"] }],
  },
  moduleFileExtensions: ["ts", "tsx", "js", "jsx"],
  moduleNameMapper: {
    "^uuid$": require.resolve("uuid"),
    // Map internal workspace packages for Jest resolution
    "^shared-sdk/(.*)$": "<rootDir>/../../shared-sdk/src/$1",
    "^shared-sdk$": "<rootDir>/../../shared-sdk/src/index.ts",
    // Specific mapping for deep src paths must come first to avoid duplicating 'src'
    "^shared-types/src/(.*)$": "<rootDir>/../../shared-types/src/$1",
    "^shared-types/(.*)$": "<rootDir>/../../shared-types/src/$1",
    "^shared-types$": "<rootDir>/../../shared-types/src/index.ts",
    "^mef-types/(.*)": "<rootDir>/../../mef-types/src/$1",
    "^mef-types$": "<rootDir>/../../mef-types/src/index.ts",
  },
  setupFiles: ["<rootDir>/src/tests/mocks.js"],
  testPathIgnorePatterns: [
    "<rootDir>/tests/e2e/",
    // Exclude any accidental Playwright tests colocated under app tests
    "<rootDir>/tests/app/",
  ],
};
