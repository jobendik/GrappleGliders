# Promotional assets

Source SVGs for the CrazyGames store listing and social previews. The SVGs are the canonical truth — export to PNG/JPG at submission time using any of:

- **Inkscape**: `inkscape og-banner.svg --export-type=png --export-filename=og-banner.png`
- **rsvg-convert** (librsvg): `rsvg-convert -w 1200 -h 630 og-banner.svg -o og-banner.png`
- **ImageMagick**: `magick og-banner.svg og-banner.png`
- **Browser**: open the SVG, take a 1× screenshot at the listed size, or print to PDF.

## Required exports

| File                             | Use                                    | Export size |
| -------------------------------- | -------------------------------------- | ----------- |
| `og-banner.svg`                  | Social preview / `og:image`            | 1200×630 PNG |
| `cover.svg`                      | CrazyGames cover image                 | 800×600 PNG  |
| `screenshot-01-swing.svg`        | Store listing screenshot — in-run swing | 1280×720 PNG |
| `screenshot-02-daily.svg`        | Store listing screenshot — daily board | 1280×720 PNG |
| `screenshot-03-podium.svg`       | Store listing screenshot — race podium | 1280×720 PNG |

Once exported, the PNGs can stay in `public/promo/` and the references in `index.html` already point to `./public/promo/og-banner.png` (so just dropping the PNG next to the SVG flips the social preview on).
