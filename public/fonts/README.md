# Fonts for PDF generation

The PDF generator (`src/lib/pdf/generate.ts`) automatically embeds the first
`.ttf`/`.otf` file it finds in this folder. This is required for **non-Latin
text (e.g. Korean, Japanese)** to render in the downloaded PDF — pdf-lib's
built-in fonts only cover Latin characters.

## Add a Unicode font

Download a font that covers your languages and drop it here, for example:

- **Noto Sans KR** (Korean): https://fonts.google.com/noto/specimen/Noto+Sans+KR
- **Noto Sans JP** (Japanese): https://fonts.google.com/noto/specimen/Noto+Sans+JP
- **Noto Sans** (Latin + many scripts): https://fonts.google.com/noto/specimen/Noto+Sans

```
public/fonts/NotoSansKR-Regular.ttf
```

Without a font here, the PDF falls back to Helvetica and strips characters it
can't encode (so Korean text would be dropped from the PDF, though it still
shows in the web preview).
