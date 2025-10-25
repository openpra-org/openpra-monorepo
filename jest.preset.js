const nxPreset = require("@nx/jest/preset").default;

module.exports = {
  ...nxPreset,
  testMatch: ["**/+(*.)+(spec|test).+(ts|js)?(x)"],
  transform: {
    "^.+\\.[tj]sx?$": [
      "@swc/jest",
      {
        jsc: {
          parser: { syntax: "typescript", tsx: true, decorators: true },
          target: "es2020",
          transform: { legacyDecorator: true, decoratorMetadata: true, react: { runtime: "automatic" } },
        },
        module: { type: "commonjs" },
        sourceMaps: "inline",
      },
    ],
  },
  resolver: "@nx/jest/plugins/resolver",
  moduleFileExtensions: ["ts", "tsx", "js", "jsx"],
  coverageReporters: ["html", "json", "text"],
  collectCoverage: true,
};
