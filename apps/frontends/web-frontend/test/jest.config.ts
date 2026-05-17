export default {
  displayName: "frontends-web-frontend",
  rootDir: "..",
  preset: "../../../jest.preset.js",
  testEnvironment: "jest-environment-jsdom",
  setupFiles: ["<rootDir>/test/jest.preEnv.js"],
  setupFilesAfterEnv: ["<rootDir>/test/jest.setup.ts"],
  transform: {
    "^.+\\.[tj]sx?$": [
      "@swc/jest",
      {
        jsc: {
          parser: { syntax: "typescript", tsx: true, decorators: true },
          target: "es2020",
          transform: { legacyDecorator: true, decoratorMetadata: false, react: { runtime: "automatic" } },
        },
        module: { type: "commonjs" },
        sourceMaps: "inline",
      },
    ],
  },
  moduleFileExtensions: ["ts", "tsx", "js", "jsx"],
  testMatch: ["<rootDir>/src/**/test/*.spec.(ts|tsx)"],
  moduleNameMapper: {
    "\\.(css|png|jpg|jpeg|svg|gif|webp)$": "<rootDir>/test/jest.asset-stub.js",
    "^react$": "<rootDir>/node_modules/react",
    "^react-dom$": "<rootDir>/node_modules/react-dom",
    "^react-dom/(.*)$": "<rootDir>/node_modules/react-dom/$1",
    "^react/(.*)$": "<rootDir>/node_modules/react/$1",
    "^interfaces-shared-types$": "<rootDir>/../../interfaces/shared-types/src/index.ts",
    "^interfaces-shared-types/(.*)$": "<rootDir>/../../interfaces/shared-types/src/$1",
    "^mef-types$": "<rootDir>/../../../packages/mef-types/src/index.ts",
    "^mef-types/lib/(.*)$": "<rootDir>/../../../packages/mef-types/src/lib/$1",
  },
  collectCoverage: false,
};
