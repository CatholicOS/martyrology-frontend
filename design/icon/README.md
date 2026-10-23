# The app icon

`good-shepherd.svg` is the master of the site's icons: the Good Shepherd of the Catacombs of Domitilla
(Vatican Museums), the young shepherd carrying the lamb across his shoulders, in four flat colours
(field `#5e0f12`, deep stone `#a98d6c`, warm stone `#d8c2a2`, parchment `#f7f1e6`).

## Source and licence

It is traced from the photograph
[“Marble statue of The Good Shepherd from the Catacombs of Domitilla, Vatican Museums”](https://commons.wikimedia.org/wiki/File:Marble_statue_of_The_Good_Shepherd_from_the_Catacombs_of_Domitilla,_Vatican_Museums.jpg)
by Carole Raddato ([Flickr](https://www.flickr.com/photos/carolemage/32143459745)), licensed
[CC BY-SA 2.0](https://creativecommons.org/licenses/by-sa/2.0/). The statue itself is in the public domain.

Changes made: the photograph was cropped, reduced to four flat tones (the statue's outline filled solid, its
light and shadows in the statue's own colours), traced to vectors and cleaned; the hands were redrawn from
the photograph. This drawing and every icon generated from it are licensed **CC BY-SA 2.0**.

## Regenerating the icons

The icons are generated, not drawn: replace `good-shepherd.svg` and run `npm run icons`. The script
(`scripts/build-icons.mjs`) writes `public/icons/icon-{192,512}.png`, `public/icons/maskable-{192,512}.png`,
`app/apple-icon.png`, `app/icon.png` and `app/favicon.ico`; commit them. `lib/__tests__/icons.test.ts`
checks their sizes, transparency and the maskable safe zone.
