# MVP: HTML-authored animated SVG README assets

## Purpose

This repository is a GitHub profile README system.

The MVP is to let editable visual source files generate the final animated SVG assets embedded in `README.md`.

The goal is not to build a full website, design system, React app, Astro app, JSON card engine, or general portfolio framework.

The goal is:

```text
editable visual source files
        ↓
GitHub Actions render/validate workflow
        ↓
generated animated SVG assets
        ↓
README.md embeds those SVG assets
```

## Core product requirement

The source files must be the visual source of truth.

When I edit a hero banner, divider, project card, activity card, or other README asset, I should edit the source file for that asset. The generated SVG should reflect that source visually.

The render script must not secretly redesign the asset, choose new text, manually position unrelated elements, or rebuild the layout from a separate JSON/data model.

The render script exists only to extract, validate, clean, and publish the final SVG assets.

## Source structure

Each README visual asset should have one editable source file.

Required MVP structure:

```text
README.md

assets-src/
  hero-banner.html
  section-divider.html
  active-projects-card.html
  github-activity.html

assets/
  hero-banner.svg
  section-divider.svg
  active-projects-card.svg
  github-activity.svg

scripts/
  render-readme-assets.mjs

.github/workflows/
  render-readme-assets.yml

package.json
```

`assets-src/` is the editable source folder.

`assets/` is the generated output folder.

`README.md` embeds only generated files from `assets/`.

## Source file rule

Each file in `assets-src/` may use an `.html` extension for easy editing and previewing in a browser.

However, because the final README asset must be an animated SVG, the actual visual inside each source file must be SVG-native.

Allowed source pattern:

```html
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  /* Optional preview-only page styles */
</style>
</head>
<body>
  <svg
    id="readme-asset"
    xmlns="http://www.w3.org/2000/svg"
    width="1200"
    height="360"
    viewBox="0 0 1200 360"
    role="img"
    aria-labelledby="title"
  >
    <title id="title">Asset title</title>

    <style>
      /* SVG-safe CSS animation lives here */
    </style>

    <!-- The real visual lives here -->
  </svg>
</body>
</html>
```

The final visual should be the inline `<svg>`.

The HTML wrapper is only for previewing and editing.

## Animation rule

Animations must survive inside GitHub README SVG rendering.

Allowed animation methods:

- SVG elements
- SVG gradients
- SVG filters that GitHub renders safely
- CSS animation inside the SVG
- `@keyframes`
- opacity, transform, stroke-dashoffset, gradient movement, pulsing, drifting, scanning, glowing
- declarative SVG animation when appropriate

Not allowed for final README SVG assets:

- `<canvas>`
- JavaScript-drawn visuals
- `requestAnimationFrame`
- browser-only DOM animation logic
- React/Vue/Svelte runtime rendering
- HTML layout that only works as a webpage
- iframe-based embeds
- video embeds

## Important clarification

Normal HTML cannot be embedded into a GitHub README as a live webpage.

GitHub README can display images, SVG files, Markdown, and limited sanitized HTML. It cannot run a normal HTML page with scripts and canvas as an interactive webpage.

Therefore, if the final README asset must be SVG with animation, the source asset must be designed as SVG-native animation.

## Current hero-banner visual target

The current hero banner concept is accepted as the visual target:

- dark navy/black biomedical engineering banner
- 1200 × 360 layout
- rounded rectangle background
- blue/coral glowing network animation
- left-side text block
- orange eyebrow text
- large white headline
- smaller supporting paragraph
- subtle vertical accent line
- soft glow elements

However, the earlier implementation used:

```html
<canvas id="net"></canvas>
<script>
  requestAnimationFrame(draw)
</script>
```

That implementation is not compatible with an animated SVG README MVP.

The hero banner must be translated into SVG-native animation.

The animated network should become SVG circles, lines, gradients, opacity pulses, drift animations, and CSS/SVG keyframes.

The source file can still be named:

```text
assets-src/hero-banner.html
```

but the real visual inside it must be an inline SVG.

## Render script responsibility

`scripts/render-readme-assets.mjs` should be boring.

It should only:

1. Find source files in `assets-src/`.
2. Extract the inline SVG marked as the README asset.
3. Validate that the SVG exists.
4. Validate required width, height, and viewBox.
5. Validate that the SVG contains no `<script>` and no `<canvas>`.
6. Validate that expected animation markers exist when needed.
7. Delete old generated assets before writing new ones.
8. Write generated SVG files into `assets/`.

The script must not:

- invent layout
- manually position text
- rebuild designs from JSON
- create a separate profile-card data model
- overwrite source content
- decide copywriting
- add new visual components outside the source file
- generate PNG as the primary MVP output
- replace the SVG workflow with a website build system

## GitHub Actions responsibility

The GitHub Action should run when source or workflow files change and on a daily cron.

Required triggers:

```yaml
on:
  workflow_dispatch:
  schedule:
    - cron: "17 9 * * *"
  push:
    branches:
      - main
    paths:
      - "assets-src/**"
      - "scripts/**"
      - "package.json"
      - "package-lock.json"
      - ".github/workflows/render-readme-assets.yml"
      - "README.md"
  pull_request:
    branches:
      - main
    paths:
      - "assets-src/**"
      - "scripts/**"
      - "package.json"
      - "package-lock.json"
      - ".github/workflows/render-readme-assets.yml"
      - "README.md"
```

On pull requests, the workflow should validate that assets can be generated.

On push to `main`, manual dispatch, or cron, the workflow should regenerate assets and publish them to `assets/`.

## README responsibility

`README.md` should only embed generated SVG assets.

Example:

```md
<p align="center">
  <a href="https://burtonmakes.github.io">
    <img src="./assets/hero-banner.svg?v=profile-assets-v20" alt="Alex Burton — biomedical engineer building wearable and implantable medical sensor systems." width="100%" />
  </a>
</p>

<p align="center">
  <img src="./assets/section-divider.svg?v=profile-assets-v20" alt="" width="100%" />
</p>

<p align="center">
  <img src="./assets/active-projects-card.svg?v=profile-assets-v20" alt="Active projects" width="100%" />
</p>
```

The README should not contain the full SVG source inline.

The README should not reference old stale generated files.

## Files that are out of scope for this MVP

Do not add these unless the MVP changes:

```text
src/
profile-card.json
profile-card.js
React components
Astro pages
Vite config
Next.js app
separate portfolio site code
JSON-driven card renderer
manual SVG layout builder
PNG-first renderer
canvas-only animation system
```

## Allowed files

The MVP should stay small.

Allowed:

```text
README.md
MVP.md
package.json
package-lock.json
assets-src/*.html
assets/*.svg
scripts/render-readme-assets.mjs
.github/workflows/render-readme-assets.yml
```

Optional later:

```text
docs/
  README_ASSET_PIPELINE.md
```

Only add this if the MVP documentation grows too large for `MVP.md`.

## Definition of done

The MVP is done when:

1. I can edit `assets-src/hero-banner.html`.
2. The visual source is inline SVG inside that HTML file.
3. The animation is SVG/CSS-native.
4. GitHub Actions generates `assets/hero-banner.svg`.
5. `README.md` embeds `assets/hero-banner.svg`.
6. The generated SVG visibly changes when the source HTML/SVG changes.
7. The workflow deletes stale generated assets before publishing new ones.
8. PRs validate the render path.
9. Push/manual/cron runs publish updated SVG assets.
10. No unused JSON/card/source framework controls the visual layout.

## Non-goals

This MVP is not trying to:

- make a full portfolio website
- render arbitrary HTML into perfect SVG
- support JavaScript/canvas animation in README
- use screenshots as the main output
- generate PNG as the main README visual
- build a general design system
- create reusable profile-card data schemas
- support every browser-only HTML/CSS feature

## Guiding principle

If a visual change is needed, change the asset source file in `assets-src/`.

If the render script needs to change the design, the system is drifting from the MVP.

The source asset should own the visual.

The script should only publish it.
