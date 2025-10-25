// Root ESLint 9 Flat Config
// We expose repository-wide ignores and then re-export the canary flat-config.
// Packages opt into flat-config with their own eslint.config.mjs and the shared preset.

import config from './eslint.config.canary.mjs';

export default [
	{
		ignores: [
			'**/node_modules/**',
			'**/dist/**',
			'**/coverage/**',
			'/.nx',
			'pnpm-lock.yaml',
			'tmp',
			'.idea',
			'build',
			'cmake-build-*',
			'cmake'
		]
	},
	...config
];
