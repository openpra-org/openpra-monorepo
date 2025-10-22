export default {
  displayName: "mef-types",
  preset: "../../jest.preset.js",
  testEnvironment: "node",
  transform: {
    "^.+\\.(t|j)sx?$": [
      "@swc/jest",
      {
        jsc: {
          parser: { syntax: "typescript", tsx: false, decorators: false },
          target: "es2022",
        },
        module: { type: "commonjs" },
        sourceMaps: "inline",
      },
    ],
  },
  moduleFileExtensions: ["ts", "js", "html"],
};
