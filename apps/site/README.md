# openpra.org

The OpenPRA ORG Inc. website. Astro + static output, deployed to GitHub Pages.
No CMS, no database, no backend.

    pnpm install
    pnpm dev        # http://localhost:4321
    pnpm build      # -> dist/
    node tools/preview.mjs   # single-file review artefact (optional)

## Pages

| Route | File | What it does |
|---|---|---|
| `/` | `src/pages/index.astro` | The triplet as the thesis; coverage; entry points |
| `/platform/` | `platform.astro` | Every technical element, quantification, packages |
| `/models/` | `models.astro` | Reference models with provenance stated |
| `/schema/` | `schema.astro` | OpenPRA MEF, RG 1.247 mapping, HRA methods |
| `/research/` | `research.astro` | Publications and teaching |
| `/about/` | `about.astro` | The non-profit, principles, ways in |
| `/404/` | `404.astro` | |

Docs is a nav link out to `revamp-docs-dev.openpra.org`, not a page here.

## Content lives in data files

Edit these, not the markup:

- `src/data/elements.json` — technical elements, codes, and status
- `src/data/models.json` — models and their provenance
- `src/data/packages.json` — monorepo packages
- `src/data/publications.json` — papers and talks

Each carries a `note` field flagging what still needs checking against the
repositories. **Do those before launch** — codes, statuses, repo links, and DOIs
are placeholders where I could not verify them.

## Design system

`src/styles/global.css` holds the tokens from the OpenPRA brand package: the
violet ramp, the violet-tinted neutrals, and the triplet hues (`--s`, `--p`,
`--x`). Those three carry meaning — scenario, probability, consequence — and are
used consistently. Do not reach for them decoratively.

Type: STIX Two Text for display, IBM Plex Sans for interface and body, IBM Plex
Mono for data, codes, and eyebrows. All self-hosted from `public/fonts/`,
subset to latin, ~99 KB total. No third-party font CDN.

The hero equation is `public/brand/triplet.svg` — outlined STIX Two Math with
`class="s"`, `class="p"`, `class="x"` on the variables so CSS colours them. No
math font is loaded on the page.

The nav mark is the aperture-only variant because it renders below 48 px, per
the brand guidelines' minimum-size rule. Don't swap it for the full mark.

## Deploy

`.github/workflows/cd-apps.yml` builds the site on pushes to `revamp`, publishes
the nginx image to `registry.openpra.org/openpra-apps-site`, and deploys the
`openpra-site` stack through the `gaia1` self-hosted runner. Traefik serves it at
`site-app.openpra.org` with TLS from the existing `cloudflare` resolver. The
Astro site setting and `CNAME` marker use the same hostname.

The current application is at `revamp-dev.openpra.org`, current documentation
is at `revamp-docs-dev.openpra.org`, and `app.openpra.org` is the legacy
application.

## Still to do

- Reconcile every `note` field in `src/data/`
- Real repository URLs per model
- Remaining publications and Zenodo DOIs
- Analytics, if any — privacy-respecting or none
