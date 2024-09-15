const nxPreset = require("@nx/jest/preset").default;

module.exports = {
  ...nxPreset,
  testMatch: ["**/+(*.)+(spec|test|e2e).+(ts|js)?(x)"],
  transform: {
    "^.+\\.(ts|js|html)$": "ts-jest",
  },
  resolver: "@nx/jest/plugins/resolver",
  moduleFileExtensions: ["ts", "js", "html"],
  coverageReporters: ["html", "json", "text"],
  collectCoverage: true,
};
