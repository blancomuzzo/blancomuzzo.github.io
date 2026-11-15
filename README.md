# blancomuzzo.github.io

Personal portfolio. Plain HTML, CSS and JS, served by GitHub Pages. No build step.

- `index.html`: content (English is the base text). `data-r`, `data-split` and `data-k` mark the pieces each screen is assembled from
- `styles.css`: all styling. The tokens at the top set the colors, the type scale and where the vertical axis sits. Alternative palettes are right below them
- `script/script.js`: the load sequence, the scroll assembly, one-screen-per-scroll stepping on desktop, and the nav underline
- `favicon.svg`

Run locally: `python -m http.server` and open http://localhost:8000

Preview a palette with `?theme=navy` (or `graphite`, `oxblood`, `forest`). To keep one, add `data-theme="navy"` to the `<html>` tag.
