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

Open `dist/index.html` to preview the guide. Generated files in `dist/` are
excluded from Git.

## Contributing

Suggestions and corrections are welcome through
[issues](https://github.com/jasp-stats/quality-guide/issues) or pull requests.
Guide text and examples live in the JSON files; videos and annotated JASP files
are configured in `media.json`. Run the checks above after making changes.

## Publishing

Checks run automatically on pull requests and pushes to `main`. To publish,
set **Settings → Pages → Source** to **GitHub Actions**, then manually run
**Actions → Validate and publish guide** on `main`.
