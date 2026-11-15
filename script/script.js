// Two pieces of motion, both off for prefers-reduced-motion:
// 1. The load sequence: the axis grows while a counter climbs to 100, then the
//    name rolls in.
// 2. The scroll assembly: each screen's pieces move into place as the screen
//    scrolls in, and come apart again if you scroll back above it.
// The states live in styles.css; this file only drives --t and the counter.

(() => {
  const root = document.documentElement;
  const motion = root.classList.contains("js-motion");

  const year = document.getElementById("year");
  if (year) year.textContent = new Date().getFullYear();

  // Layout depends on the display typeface (line breaks, the name), so wait for
  // it, but never longer than FONT_TIMEOUT.
  const FONT_TIMEOUT = 3000;
  const fontsReady = Promise.race([
    document.fonts && document.fonts.load
      ? Promise.all([document.fonts.load('700 1em "Mona Sans"', "Nicolás 0123456789"), document.fonts.ready])
      : Promise.resolve(),
    new Promise(resolve => setTimeout(resolve, FONT_TIMEOUT)),
  ]).catch(() => {});

  setupNav();
  if (!motion) return;
  playIntro(fontsReady);
  fontsReady.then(setupAssembly);
  setupStepping();

  function docTop(el) {
    let top = 0;
    for (; el; el = el.offsetParent) top += el.offsetTop;
    return top;
  }

  // ------------------------------------------------------------------------
  // 1. Load sequence
  // ------------------------------------------------------------------------
  function playIntro(ready) {
    const count = document.querySelector(".count");
    const axis = document.querySelector(".hero .axis");
    const reveal = () => {
      root.classList.remove("is-loading");
      root.classList.add("is-ready");
    };
    if (!root.classList.contains("is-loading")) return;
    if (!count || !axis) { reveal(); return; }

    const RUN = 1700;      // ms the counter takes when nothing holds it back
    const SETTLE = 150;    // ms time constant of the easing toward each stop
    const HOLD = 240;      // ms the finished counter stays before the reveal
    const WAIT_CAP = 0.81; // the counter parks here until the typeface is in

    // The counter moves in stops, like assets arriving. [fraction of RUN, progress]
    const STOPS = [[0, 0.22], [0.22, 0.53], [0.46, 0.81], [0.74, 1]];

    let fontsIn = false;
    ready.then(() => { fontsIn = true; });

    const start = performance.now();
    let last = start;
    let shown = 0;

    const frame = now => {
      const t = (now - start) / RUN;
      let target = 0;
      for (const [at, value] of STOPS) if (t >= at) target = value;
      if (!fontsIn) target = Math.min(target, WAIT_CAP);

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
  }

  // ------------------------------------------------------------------------
  // 2. Scroll assembly
  // ------------------------------------------------------------------------
  function setupAssembly() {
    // A screen that fits the viewport is assembled as a whole: its progress runs
    // from 0 (its top at the bottom of the viewport) to 1 (its top at the top),
    // and pieces with a higher data-k start later in that run.
    const STAGGER = 0.055;   // progress delay per step of data-k
    const SPAN = 0.5;        // progress each piece needs to travel in
    const MAX_K = 8;
    // A screen taller than the viewport (phones) reveals piece by piece instead.
    const PIECE_SPAN = 0.28; // fraction of the viewport a piece travels in over
    // The pieces trail the scroll a little, so a quick snap still shows the build.
    const LAG = 110;         // ms
    const LAG_PER_K = 45;    // ms added per step of data-k

    let items = [];
    let screens = [];
    let width = innerWidth;
    let running = false;
    let lastNow = 0;

    // Wrap each rendered line of an element in its own mask.
    function split(el) {
      const text = el.dataset.text || (el.dataset.text = el.textContent.replace(/\s+/g, " ").trim());
      const words = text.split(" ");
      el.textContent = "";
      const spans = words.map((word, i) => {
        const span = document.createElement("span");
        span.style.display = "inline-block";
        span.textContent = word;
        el.append(span);
        if (i < words.length - 1) el.append(" ");
        return span;
      });

      const lines = [];
      let top = null;
      for (const span of spans) {
        if (top === null || Math.abs(span.offsetTop - top) > 2) {
          lines.push([]);
          top = span.offsetTop;
        }
        lines[lines.length - 1].push(span.textContent);
      }

      el.textContent = "";
      lines.forEach((line, i) => {
        const mask = document.createElement("span");
        mask.className = "ln";
        const inner = document.createElement("span");
        inner.className = "ln-in";
        inner.dataset.li = i;
        inner.textContent = line.join(" ");
        mask.append(inner);
        el.append(mask);
        if (i < lines.length - 1) el.append(" ");
      });
      el.classList.add("is-split");
    }

    function collect(instant) {
      document.querySelectorAll("[data-split]").forEach(split);

      screens = [...document.querySelectorAll("[data-screen]")].map(el => ({ el, top: 0, h: 0, fits: true }));
      const screenOf = el => screens.find(s => s.el === el.closest("[data-screen]"));

      items = [];
      document.querySelectorAll("[data-r], .ln-in").forEach(el => {
        const isLine = el.classList.contains("ln-in");
        const host = isLine ? el.closest("[data-split]") : el;
        const line = isLine ? +el.dataset.li : 0;
        const k = Math.min(MAX_K, (+host.dataset.k || 0) + line);
        const screen = screenOf(el);
        if (!screen) return;
        items.push({
          el, screen, k, line,
          box: isLine ? el.parentNode : el,
          top: 0, v: 0, written: -1,
          lag: LAG + k * LAG_PER_K,
        });
      });

      measure();
      if (instant) {
        const y = scrollY, vh = innerHeight;
        items.forEach(it => { it.v = target(it, y, vh); });
      }
      items.forEach(write);
      root.classList.add("reveal-on");
    }

    function measure() {
      const vh = innerHeight;
      screens.forEach(s => {
        s.top = docTop(s.el);
        s.h = s.el.offsetHeight;
        s.fits = s.h <= vh * 1.08;
      });
      items.forEach(it => { it.top = docTop(it.box); });
    }

    function target(it, y, vh) {
      const s = it.screen;
      let t = s.fits
        ? ((y + vh - s.top) / Math.min(vh, s.h) - it.k * STAGGER) / SPAN
        : (y + vh * 0.94 - it.top) / (vh * PIECE_SPAN) - it.line * 0.18;
      t = t < 0 ? 0 : t > 1 ? 1 : t;
      return 1 - (1 - t) * (1 - t);
    }

    function write(it) {
      if (Math.abs(it.v - it.written) < 0.0005) return;
      it.el.style.setProperty("--t", it.v.toFixed(4));
      it.written = it.v;
    }

    function tick(now) {
      const dt = Math.min(64, now - lastNow);
      lastNow = now;
      const y = scrollY, vh = innerHeight;
      let busy = false;
      for (const it of items) {
        const goal = target(it, y, vh);
        const diff = goal - it.v;
        if (Math.abs(diff) > 0.002) {
          it.v += diff * (1 - Math.exp(-dt / it.lag));
          busy = true;
        } else {
          it.v = goal;
        }
        write(it);
      }
      if (busy) requestAnimationFrame(tick);
      else running = false;
    }

    function kick() {
      if (running) return;
      running = true;
      lastNow = performance.now();
      requestAnimationFrame(tick);
    }

    let resizeTimer;
    addEventListener("resize", () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        if (innerWidth !== width) {
          width = innerWidth;
          collect(true);   // line breaks changed: re-split, without replaying
        } else {
          measure();       // only the height changed (e.g. a phone's URL bar)
        }
        kick();
      }, 150);
    });
    addEventListener("scroll", kick, { passive: true });

    collect(false);
    kick();
  }

  // ------------------------------------------------------------------------
  // 3. One screen per wheel notch or key press (desktop only)
  //    CSS scroll-snap alone can bounce a short wheel scroll back to the same
  //    screen, and it moves too fast to see the assembly. This takes over wheel
  //    and keys and glides to the next stop. Touch and the scrollbar keep native
  //    scrolling, with CSS snap as the fallback.
  // ------------------------------------------------------------------------
  function setupStepping() {
    const DESKTOP = matchMedia("(min-width: 53.01rem) and (min-height: 34rem)");
    const DURATION = 950;    // ms for one screen
    const THRESHOLD = 24;    // wheel delta that counts as a deliberate scroll
    const QUIET = 140;       // ms without wheel events before a new step is allowed
    const STEP = 0.85;       // a screen taller than the viewport is read in steps of this

    let animating = false;
    let locked = false;
    let acc = 0;
    let lastWheel = 0;

    // Every position the page can rest at: each screen's top, intermediate
    // stops inside screens taller than the viewport, and the very end.
    function stops() {
      const vh = innerHeight;
      const max = document.documentElement.scrollHeight - vh;
      const out = [];
      document.querySelectorAll(".hero, [data-screen]").forEach(el => {
        if (el.classList.contains("foot")) { out.push(max); return; }
        const top = docTop(el), h = el.offsetHeight;
        out.push(top);
        for (let y = top + vh * STEP; y < top + h - vh; y += vh * STEP) out.push(y);
        if (h > vh + 4) out.push(top + h - vh);
      });
      return [...new Set(out.map(v => Math.round(Math.min(max, Math.max(0, v)))))].sort((a, b) => a - b);
    }

    function step(dir) {
      const y = scrollY;
      const all = stops();
      const to = dir > 0 ? all.find(s => s > y + 2) : all.reverse().find(s => s < y - 2);
      if (to !== undefined) glide(to);
    }

    function glide(to) {
      const from = scrollY;
      if (Math.abs(to - from) < 2) return;
      animating = locked = true;
      root.style.scrollSnapType = "none";
      root.style.scrollBehavior = "auto";
      const dur = Math.min(1400, DURATION * Math.max(1, Math.abs(to - from) / innerHeight) ** 0.35);
      const start = performance.now();
      const frame = now => {
        const p = Math.min(1, (now - start) / dur);
        const e = p < 0.5 ? 4 * p * p * p : 1 - (-2 * p + 2) ** 3 / 2;
        window.scrollTo({ top: from + (to - from) * e, behavior: "instant" });
        if (p < 1) { requestAnimationFrame(frame); return; }
        animating = false;
        root.style.scrollSnapType = "";
        root.style.scrollBehavior = "";
        // A trackpad keeps sending wheel events after the gesture (inertia).
        // Wait for them to stop so one swipe moves exactly one screen.
        const release = () => {
          if (performance.now() - lastWheel > QUIET) { locked = false; acc = 0; }
          else setTimeout(release, 50);
        };
        release();
      };
      requestAnimationFrame(frame);
    }

    addEventListener("wheel", e => {
      if (!DESKTOP.matches || e.ctrlKey || Math.abs(e.deltaY) < Math.abs(e.deltaX)) return;
      e.preventDefault();
      const now = performance.now();
      if (now - lastWheel > 250) acc = 0;
      lastWheel = now;
      if (animating || locked) return;
      acc += e.deltaY;
      if (Math.abs(acc) < THRESHOLD) return;
      const dir = Math.sign(acc);
      acc = 0;
      step(dir);
    }, { passive: false });

    addEventListener("keydown", e => {
      if (!DESKTOP.matches || e.altKey || e.ctrlKey || e.metaKey || e.defaultPrevented) return;
      const down = ["ArrowDown", "PageDown"].includes(e.key) || (e.key === " " && !e.shiftKey);
      const up = ["ArrowUp", "PageUp"].includes(e.key) || (e.key === " " && e.shiftKey);
      if (!down && !up) return;
      e.preventDefault();
      if (!animating) step(down ? 1 : -1);
    });
  }

  // ------------------------------------------------------------------------
  // Nav: underline the section on screen
  // ------------------------------------------------------------------------
  function setupNav() {
    const links = [...document.querySelectorAll(".nav a")];
    const screens = [...document.querySelectorAll("[data-nav]")];
    let current;
    let queued = false;

    const update = () => {
      queued = false;
      const mid = innerHeight * 0.5;
      let id = null;
      for (const s of screens) if (s.getBoundingClientRect().top <= mid) id = s.dataset.nav;
      if (id === current) return;
      current = id;
      links.forEach(a => {
        if (a.getAttribute("href") === "#" + id) a.setAttribute("aria-current", "location");
        else a.removeAttribute("aria-current");
      });
    };

    addEventListener("scroll", () => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(update);
    }, { passive: true });
    update();
  }
})();
