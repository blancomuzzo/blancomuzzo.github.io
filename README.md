# blancomuzzo.github.io

Personal portfolio. Plain HTML, CSS and JS, served by GitHub Pages. No build step.

One page, driven by scroll alone: no navigation, no buttons, nothing that needs a click to reveal content. The contact links at the end are the only links.

- `index.html`: the whole site. Hero, About (statement, stack, certifications), Projects, Experience, Contact. The `data-*` attributes listed in its comments mark what moves
- `styles.css`: layout and resting states. The tokens at the top set colors, type and where the vertical axis sits; alternative palettes are right below them
- `script/script.js`: all motion, one block per scene in page order. Motion tokens (`M`) at the top
- `fonts/`: Necto Mono Regular by Marco Condello / [Collletttivo](https://www.collletttivo.it/typefaces/necto-mono), self-hosted under the SIL Open Font License (`fonts/OFL.txt`)
- `favicon.svg`

Motion libraries load from CDNs: GSAP 3.12.5 and ScrollTrigger (cdnjs). If they fail to load, or the visitor prefers reduced motion, the page shows everything in place, top to bottom, without animation.

Run locally: `python -m http.server` and open http://localhost:8000

Preview a palette with `?theme=navy` (or `graphite`, `oxblood`, `forest`, `black`). To keep one, add `data-theme="navy"` to the `<html>` tag.

GitHub Pages lets browsers keep each file for 10 minutes. `index.html` links `styles.css` and `script/script.js` with a version (`?v=9.0`): when either file changes, bump that number, or a visitor can get the new HTML with the old CSS.
