# JASP Quality Guide

**[Open the guide](https://jasp-stats.github.io/quality-guide/)**

An interactive guide to choosing and preparing analyses in JASP, with 54 analysis
guides and 42 practical example datasets. Videos and annotated JASP files are
being added.

**Maintainer:** [Henrik Godmann (@hrgodmann)](https://github.com/hrgodmann)

## Development

Requires Python 3.9+ and Node.js 18+. No additional packages are needed.

```sh
node validate.mjs
python3 build.py
node validate-media.mjs
node validate-brand.mjs
node validate-interface.mjs
```

The build produces two versions from the same content and application code:

- `dist/index.html` is the online guide. Videos and JASP files have separate,
  content-hashed URLs under `dist/media/`, so opening the guide does not download
  every tutorial. The media validator keeps its initial HTML below 2 MB and checks
  that it contains no embedded video or JASP payloads.
- `dist/JASP-Quality-Guide.html` is the complete standalone copy. It embeds all
  available videos, JASP files, examples, and branding, and works without a server
  or network connection. It is intentionally much larger. The online guide's
  **Save complete offline guide** action downloads this file.

To preview the online guide, run `python3 -m http.server --directory dist 8000`
and open `http://localhost:8000/`. Open `dist/JASP-Quality-Guide.html` directly to
check the offline version. CSV downloads, saved analysis plans, and printing are
available in both versions. Generated files in `dist/` are excluded from Git.

Both versions retain the original media bytes, captions, and JASP download
filenames. The build removes obsolete generated content-hashed files from
`dist/media/`; it leaves unrelated files and `assets-source/` untouched.

## Contributing

Suggestions and corrections are welcome through
[issues](https://github.com/jasp-stats/quality-guide/issues) or pull requests.
Guide text and examples live in the JSON files; videos and annotated JASP files
are configured in `media.json`. Run the checks above after making changes.

## Publishing

Checks run automatically on pull requests and pushes to `main`. To publish,
set **Settings → Pages → Source** to **GitHub Actions**, then manually run
**Actions → Validate and publish guide** on `main`.
The existing workflow publishes the complete `dist/` directory, including the
online media files and optional standalone download; no deployment setting needs
to change. Publish these outputs together so every media URL and the offline
download resolve to the matching build.
