# The app icon

`good-shepherd.svg` is the master of the site's icons: the Good Shepherd after the statue of the Catacombs of
Domitilla (Vatican Museums), the young shepherd carrying the lamb across his shoulders. The shepherd is wine red
`#800000` (outlined in `#550000`), the lamb white with black line work so that it stands apart from him, on a white
disc `#FFFFFF`, on a parchment field `#E8DCC3`. It is an Inkscape file, traced by hand: the field and the disc, the
lamb and the shepherd are each on a layer of their own (Background, Lamb, Shepherd), as closed shapes.

## Regenerating the icons

The icons are generated, not drawn: replace `good-shepherd.svg` (saved from Inkscape as it is) and run
`npm run icons`. The script (`scripts/build-icons.mjs`) first makes the master plain: it drops Inkscape's metadata
and hidden elements, and paints the field (the rectangle filled with `#E8DCC3`, which must stay one) as a plain
parchment square, without any stroke along the page's edge. It then writes `public/app-icons/icon-{192,512}.png`,
`public/app-icons/maskable-{192,512}.png`, `app/apple-icon.png`, `app/icon.png`, `app/favicon.ico` and the header's
emblem, `public/app-icons/emblem.svg` (the disc without the field); commit them. `lib/__tests__/icons.test.ts`
checks their sizes, transparency and the maskable safe zone.
