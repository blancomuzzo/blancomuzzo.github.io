// Load sequence: the axis grows down the hero while a counter climbs to 100 in
// the slot where the name will sit. At 100 the counter rolls out, the name rolls
// in, and the rest of the hero fades up. The states live in styles.css
// (.is-loading / .is-ready); this file only drives the counter and the axis.

(() => {
  const root = document.documentElement;
  const count = document.querySelector(".count");
  const axis = document.querySelector(".hero .axis");

  const year = document.getElementById("year");
  if (year) year.textContent = new Date().getFullYear();

  const reveal = () => {
    root.classList.remove("is-loading");
    root.classList.add("is-ready");
  };

  // The inline script in <head> only sets is-loading when motion is allowed.
  if (!root.classList.contains("is-loading")) return;
  if (!count || !axis) { reveal(); return; }

  const RUN = 1700;      // ms the counter takes when nothing holds it back
  const SETTLE = 150;    // ms time constant of the easing toward each stop
  const HOLD = 240;      // ms the finished counter stays before the reveal
  const WAIT_CAP = 0.81; // the counter parks here until the typeface is in
  const FONT_TIMEOUT = 3000;

  // The counter moves in stops, like assets arriving, rather than one smooth ramp.
  // [fraction of RUN, progress]
  const STOPS = [[0, 0.22], [0.22, 0.53], [0.46, 0.81], [0.74, 1]];

  // The page is "loaded" once the display typeface has arrived, so the name
  // never appears in a fallback font and then jumps.
  let fontsIn = false;
  const fontLoad = document.fonts && document.fonts.load
    ? document.fonts.load('700 1em "Mona Sans"', "Nicolás Blanco Muzzolon 0123456789")
    : Promise.resolve();
  const giveUp = new Promise(resolve => setTimeout(resolve, FONT_TIMEOUT));
  Promise.race([fontLoad, giveUp]).catch(() => {}).then(() => { fontsIn = true; });

  const start = performance.now();
  let last = start;
  let shown = 0;

  const frame = now => {
    const t = (now - start) / RUN;
    let target = 0;
    for (const [at, value] of STOPS) if (t >= at) target = value;
    if (!fontsIn) target = Math.min(target, WAIT_CAP);

    // Time-based easing, so it runs the same on 60 Hz and 120 Hz screens.
    shown += (target - shown) * (1 - Math.exp(-(now - last) / SETTLE));
    last = now;
    if (target === 1 && shown > 0.995) shown = 1;

    count.textContent = Math.round(shown * 100);
    axis.style.transform = `scaleY(${shown})`;

    if (shown < 1) {
      requestAnimationFrame(frame);
    } else {
      setTimeout(() => {
        reveal();
        count.addEventListener("transitionend", () => count.remove(), { once: true });
      }, HOLD);
    }
  };

  requestAnimationFrame(frame);
})();
