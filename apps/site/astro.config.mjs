import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://site-app.openpra.org',
  devToolbar: { enabled: false },
  build: { format: 'directory' },
  compressHTML: true,
  // the WordPress site's URLs, kept alive
  redirects: {
    '/projects': '/platform/',
    '/projects/': '/platform/',
    '/contacts': '/about/#contact',
    '/contacts/': '/about/#contact',
  },
});
