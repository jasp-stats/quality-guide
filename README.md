# JASP Quality Guide

**[Open the guide](https://jasp-stats.github.io/quality-guide/)**

An interactive guide to choosing and preparing analyses in JASP, with 54 analysis
guides and 47 practical example datasets. Videos and annotated JASP files are
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
are configured in `media.json`. Connect each listed asset to an analysis through
its override or an effective default; validation rejects unused assets so a
finished tutorial cannot silently remain hidden behind a placeholder. Run the
checks above after making changes.

## Publishing

Checks run automatically on pull requests and pushes to `main`. To publish,
set **Settings → Pages → Source** to **GitHub Actions**, then manually run
**Actions → Validate and publish guide** on `main`.
The existing workflow publishes the complete `dist/` directory, including the
online media files and optional standalone download; no deployment setting needs
to change. Publish these outputs together so every media URL and the offline
download resolve to the matching build.

## Colleague previews — 7 November 2026

Ten new narrated MP4/annotated JASP pairs are integrated using the existing on-demand media convention. Their guides disclose the authorized data adaptations and known module limitations. Original datasets remain separately available; the eight-run factorial worksheet is distinct from the completed 16-run example. These are initial, unlistened previews for colleague feedback.

The two Bayesian sampling previews require the isolated repaired development build from `hrgodmann/jaspAcceptanceSampling`, branch `revision/mixture-state-space-model`, revision `9d08972b6b10b8d04b9650ecce4b1560f811b629`. Activate that build in the JASP process before recomputing their companions. A package version label alone does not identify the implementation.

The final three Survival pairs (`survival_accelerated`, `survival_mixture`, and `survival_recurrent`) are also integrated as colleague previews, bringing the local guide to 54 linked pairs. They use the original website examples without deleting or changing observations. The narrated clips are 74, 55 and 64 seconds respectively.

These three require the isolated development build of `jasp-stats/jaspSurvival`, revision `d3550d881f302762b35050a4c86e037378ab9179`, package version `0.98.2`, validated in JASP `0.99.0` on Apple Silicon. Activate that exact build before recomputing; stable Survival `0.96.6` lacks the advanced workflows. Independent statistical calculations, native save/reopen/recomputation, paired-data/settings/output comparisons, complete media decoding and sampled cut inspection passed. Narration transcription was compared with the scripts, but actual listening, continuously watched playback and real-browser player testing remain unperformed. Method-name pronunciation needs colleague listening, particularly Weibull, Arrhenius and Crow–AMSAA.

Accelerated B10 predictions stay at the four tested temperatures; condition numbers map to temperatures in the adjacent table. The mixture companion retains convergence/start sensitivity and a one-component comparison without claiming physical causes. Recurrent analysis retains all 24 positive-count exposure intervals; its bands concern fitted means and intensities, not future-count prediction intervals. Its wide prediction tables require horizontal scrolling. Reusable source recordings, narration, build and numerical validation evidence are retained in the development workspace for feedback; none of these additions has been published.
