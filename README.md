# blancomuzzo.github.io

Personal portfolio. Plain HTML, CSS and JS, served by GitHub Pages. No build step.

- `index.html`: content (English is the base text). The `data-*` attributes listed in its comments mark what moves
- `styles.css`: layout and resting states. The tokens at the top set colors, type and where the vertical axis sits; alternative palettes are right below them
- `script/script.js`: all motion. Motion tokens (`M`) at the top of the main block; one function per scene
- `favicon.svg`

Motion libraries load from CDNs: GSAP 3.12.5 and ScrollTrigger (cdnjs), Lenis 1.1.20 (jsDelivr). If they fail to load, or the visitor prefers reduced motion, the page shows everything in place without animation.

Run locally: `python -m http.server` and open http://localhost:8000

Preview a palette with `?theme=navy` (or `graphite`, `oxblood`, `forest`). To keep one, add `data-theme="navy"` to the `<html>` tag.
