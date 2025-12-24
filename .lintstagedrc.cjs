module.exports = {
  '*.{ts,tsx,js,jsx}': ['pnpm exec eslint --fix --quiet --cache', 'pnpm exec prettier --write'],
  '*.{json,md,yml,yaml,css,scss}': ['pnpm exec prettier --write'],
};
