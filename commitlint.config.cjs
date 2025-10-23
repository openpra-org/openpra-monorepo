module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    // Allow longer commit body lines for detailed change logs
    'body-max-line-length': [2, 'always', 500],
    // Disable header length restriction
    'header-max-length': [0],
  },
};
