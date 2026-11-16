# blancomuzzo.github.io

Personal portfolio. Plain HTML, CSS and JS, served by GitHub Pages. No build step.

- `index.html`: home page, one title card per section
- `about/`, `projects/`, `experience/`, `contact/`: one page per section (`index.html` in each, so the URLs are `/about/` and so on). Top bar, hero and footer are repeated in every page: change them in all five. The `data-*` attributes listed in their comments mark what moves
- `styles.css`: layout and resting states. The tokens at the top set colors, type and where the vertical axis sits; alternative palettes are right below them
- `script/script.js`: all motion. Motion tokens (`M`) at the top of the main block; one function per scene
- `fonts/`: Necto Mono Regular by Marco Condello / [Collletttivo](https://www.collletttivo.it/typefaces/necto-mono), self-hosted under the SIL Open Font License (`fonts/OFL.txt`)
- `favicon.svg`

Motion libraries load from CDNs: GSAP 3.12.5 and ScrollTrigger (cdnjs). If they fail to load, or the visitor prefers reduced motion, the page shows everything in place without animation.

Run locally: `python -m http.server` and open http://localhost:8000

Preview a palette with `?theme=navy` (or `graphite`, `oxblood`, `forest`). To keep one, add `data-theme="navy"` to the `<html>` tag.

GitHub Pages lets browsers keep each file for 10 minutes. Every page links `styles.css` and `script/script.js` with a version (`?v=8.4`): when either file changes, bump that number in all five pages, or a visitor can get the new HTML with the old CSS.
