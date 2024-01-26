/* eslint-disable */
export default {
  displayName: 'frontend-web-editor',
  // preset: '../../../jest.preset.js',
  preset: 'ts-jest',
  testEnvironment: 'jest-environment-jsdom',
  transform: {
    "^(?!.*\\.(js|jsx|ts|tsx|css|json)$)": "@nx/react/plugins/jest",
    "^.+\\.[tj]sx?$": ["babel-jest", { presets: ["@nx/react/babel"] }],
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx'],
  moduleNameMapper: {
    "^uuid$": require.resolve("uuid"),
  },
  setupFiles: [ '<rootDir>/src/tests/mocks.js' ]
};
