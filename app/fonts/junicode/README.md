# Junicode (text font of the editions)

Junicode 2.226 by Peter S. Baker, under the SIL Open Font License 1.1 (`OFL.txt`):
https://github.com/psb1558/Junicode-font. An old-style face made for early-modern and
medieval texts. It covers every character the editions print, including those Georgia
lacks: caron and breve letters (ǎ ǐ ǒ ŏ), free-standing combining marks, polytonic Greek,
medieval abbreviations (ꝙ ꝓ ꝑ ꝛ ꝰ), ℟ and Vietnamese letters (Đỗ Mai Năm).

The two files here are the release's variable fonts (`JunicodeVF-Roman.ttf`,
`JunicodeVF-Italic.ttf`), fixed at the regular weight and width and subset to the scripts
the editions use, with the default OpenType layout features (kerning, ligatures, mark
positioning):

```sh
pip install fonttools brotli
for s in Roman Italic; do
  fonttools varLib.instancer JunicodeVF-$s.ttf wght=400 wdth=100 ENLA=0 -o Junicode-$s-static.ttf
  pyftsubset Junicode-$s-static.ttf --flavor=woff2 --output-file=Junicode-$s.woff2 \
    --unicodes="U+0000-024F,U+0250-02FF,U+0300-036F,U+0370-03FF,U+1E00-1EFF,U+1F00-1FFF,U+2000-206F,U+20AC,U+2100-214F,U+2190-2193,U+A720-A7FF,U+FB00-FB06"
done
```

Loaded with `next/font/local` in `app/layout.tsx` as `--font-text`.
