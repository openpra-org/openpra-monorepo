export default {
  displayName: "shared-sdk",
  preset: "../../jest.preset.js",
  testEnvironment: "node",
  transform: {
    "^.+\\.[tj]s$": [
      "@swc/jest",
      {
        jsc: {
          parser: { syntax: "typescript", decorators: false },
          target: "es2020",
          transform: { decoratorMetadata: false },
        },
        module: { type: "commonjs" },
        sourceMaps: "inline",
      },
    ],
  },
  moduleFileExtensions: ["ts", "js", "html"],
  moduleNameMapper: {
    "^shared-types/src/(.*)$": "<rootDir>/../shared-types/src/$1",
    "^shared-types/(.*)$": "<rootDir>/../shared-types/src/$1",
    "^shared-types$": "<rootDir>/../shared-types/src/index.ts",
  },
};
