export default {
  displayName: "mef-schema",
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
};
// Removed unused eslint-disable directive
