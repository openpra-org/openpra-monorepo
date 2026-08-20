# Branding Guidelines

Use these rules across the OpenPRA site, application, documentation, presentations, and published material. The official assets are supplied in the OpenPRA Brand Package; use those files instead of redrawing or modifying the mark.

![OpenPRA primary tagline lockup](/brand/lockup-primary-tagline.svg)

**Current identity:** Version 1.2, August 2026

**Tagline:** Risk, in the open.

## Core rule

**Use the open mark wherever there is a page. Use the tile wherever there is a container.**

A website header, document, slide, poster, or banner is a page and uses an open-mark lockup. An avatar, favicon, app icon, or repository badge is a fixed container and uses a tile.

The mark represents an analytical instrument, not a certification seal. Never use it to imply approval, certification, or a risk verdict.

## Choose the correct logo

| Context                                               | Official asset                                                   |
| ----------------------------------------------------- | ---------------------------------------------------------------- |
| Website header on a light background                  | `OpenPRA Lockup Primary.svg`                                     |
| Website header on a dark background                   | `OpenPRA Lockup Dark.svg`                                        |
| Homepage hero, cover, banner, or first impression     | `OpenPRA Lockup Primary Tagline.svg`                             |
| Grant, agency, or press material that must decode PRA | `OpenPRA Lockup Primary Descriptor.svg`                          |
| Photography or a busy background                      | `OpenPRA Lockup Reversed.svg`                                    |
| Narrow or square page layout                          | `OpenPRA Lockup Stacked.svg`                                     |
| Avatar, repository icon, or app icon                  | `OpenPRA Icon Tile Violet`                                       |
| Browser favicon                                       | `favicon.ico` and `favicon.svg`                                  |
| Open Graph or social preview                          | `OpenPRA Social Card Light.png` or the dark variant              |
| Single-color print or engraving                       | `OpenPRA Lockup Mono Ink.svg` or `OpenPRA Lockup Mono White.svg` |

Do not use the square icon tile as a page logo or homepage hero.

## Clear space and minimum size

- Keep one channel width of clear space around every side of the mark. No text, rules, partner logos, or page edges may enter this area.
- Use the regular mark at 40 px or larger.
- Below 40 px, use the heavy aperture-only small tile supplied for that purpose.
- Never stretch, rotate, skew, outline, or reconstruct an official asset.
- Place partner and funder logos in a separate strip with at least two channel widths of separation. Never create a combined lockup.

## Color

The default background for the OpenPRA site, application, and documentation canvas is **white**. Use mist only for sunken panels and grouped secondary surfaces.

| Token        | Hex       | Use                                          |
| ------------ | --------- | -------------------------------------------- |
| `violet-500` | `#8F4EC7` | Canonical mark, fills, and buttons           |
| `violet-600` | `#7639AA` | Violet body text and links on white          |
| `violet-300` | `#C5A0E4` | Violet elements on dark surfaces             |
| `ink`        | `#1B1226` | Primary body text                            |
| `ink-tile`   | `#150E1E` | Dark surfaces                                |
| `mist`       | `#F5F0FA` | Sunken panels and grouped secondary surfaces |
| `line`       | `#E3D8F0` | Borders and hairlines                        |

Do not recolor the mark outside the approved palette or apply gradients, shadows, glows, or bevels.

## PRA quantity colors

Use one consistent hue for each quantity everywhere in the application, documentation, and diagrams.

| Quantity         | Fill      | Text on white | On dark   |
| ---------------- | --------- | ------------- | --------- |
| Scenario, `s`    | `#8F4EC7` | `#5B2C84`     | `#C5A0E4` |
| Probability, `p` | `#12C5B9` | `#0B7E77`     | `#69F2E9` |
| Consequence, `x` | `#DE6A2B` | `#9F4819`     | `#E99C72` |

Never encode a quantity by color alone. Pair color with a label, position, or shape. Probability is never orange, consequence is never teal, and these quantity colors are not decorative accents.

## Typography

| Role                                           | Typeface      |
| ---------------------------------------------- | ------------- |
| Display headings and document titles           | STIX Two Text |
| Equations and notation                         | STIX Two Math |
| Interface and body copy                        | IBM Plex Sans |
| Data, schema fields, code, and numeric results | IBM Plex Mono |
| Letters inside the mark only                   | Jost Regular  |

Self-host the supplied fonts. Do not load them from a third-party CDN. Jost is reserved for the three letters inside the mark and must not be used for headings, body copy, or the wordmark.

## Voice

- State scope, assumptions, exclusions, and uncertainty directly.
- Cite standards, papers, datasets, releases, and numerical claims.
- Give numbers their units and uncertainty; do not present unsupported point estimates.
- Describe openness as a method: public repositories, reviewable models, and portable formats.
- Prefer plain verbs and active voice for an engineering and regulatory audience.
- Avoid unsupported marketing language such as "revolutionary," "seamless," "industry-leading," or "trusted by."

Write the name as **OpenPRA**: one word, capital O, capital PRA. Use **OpenPRA ORG Inc.** only in legal and financial contexts. Do not write "Open PRA," "OpenPra," or "openPRA."

## Before publishing

- Confirm that the logo variant matches its background and context.
- Confirm that the page or application canvas remains white.
- Check clear space and minimum-size requirements.
- Verify color contrast and pair every color encoding with another cue.
- Confirm that fonts are self-hosted and used only for their assigned roles.
- Check naming, citations, units, uncertainty, and entity separation.
