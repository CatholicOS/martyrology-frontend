# The app icon

`good-shepherd.svg` is the master of the site's icons: the Good Shepherd after the statue of the Catacombs of
Domitilla (Vatican Museums), the young shepherd carrying the lamb across his shoulders, in wine red `#7A1F2B`
on a white disc `#FFFDFE`, on a parchment field `#E8DCC3`. It was generated with Recraft from text prompts.

## Regenerating the icons

The icons are generated, not drawn: replace `good-shepherd.svg` and run `npm run icons`. The script
(`scripts/build-icons.mjs`) writes `public/icons/icon-{192,512}.png`, `public/icons/maskable-{192,512}.png`,
`app/apple-icon.png`, `app/icon.png` and `app/favicon.ico`; commit them. `lib/__tests__/icons.test.ts`
checks their sizes, transparency and the maskable safe zone.
