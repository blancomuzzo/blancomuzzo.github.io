// Motion and the desktop reel. If GSAP or ScrollTrigger fail to load, or for
// prefers-reduced-motion, the page stays readable and the reel still scrolls.
//
// 1. Load sequence: the axis grows while a counter climbs to 100, the name rolls in.
//    Only on the home page, once per session; inner pages arrive already in place.
// 2. Stage (desktop): the page never scrolls. The hero is a fixed left column and
//    the reel on the right is its own scroller. The wheel, anywhere on the page,
//    moves the reel with easing.
//    Home (reel with data-tilt data-snap): one title card per page, one card on
//    screen at a time. Each wheel gesture or key press moves to the next or
//    previous card; cards tilt in perspective as they leave the middle.
//    Inner pages: the section scrolls freely.
// 3. Scenes (GSAP ScrollTrigger), desktop, inside the reel:
//    about     the statement lights up word by word once the page is in
//    stack     each line slides in from alternating sides into place
//    exp       the timeline is built job by job as it goes by
//    certs     lines rise in sequence
//    Everything else assembles as one sequence per section or card as it arrives.
//    On phones the page scrolls normally and pieces reveal as they enter.

(() => {
  const root = document.documentElement;
  const motion = root.classList.contains("js-motion");

  const DESKTOP = "(min-width: 53.01rem) and (min-height: 34rem)";   // same as the stage in styles.css
  const MOBILE = "(max-width: 53rem), (max-height: 33.99rem)";
  const stageQuery = matchMedia(DESKTOP);
  const onStage = () => stageQuery.matches;
  const reel = document.querySelector(".reel");

  const year = document.getElementById("year");
  if (year) year.textContent = new Date().getFullYear();

  // Full years of experience since the career start date (3 January 2019).
  // Runs before any text is split for motion, so the number is part of the split.
  const CAREER_START = new Date(2019, 0, 3);
  const now = new Date();
  let years = now.getFullYear() - CAREER_START.getFullYear();
  if (now < new Date(now.getFullYear(), CAREER_START.getMonth(), CAREER_START.getDate())) years--;
  document.querySelectorAll(".js-years").forEach(el => { el.textContent = years; });

  // Email link, assembled here so the address is not in the HTML.
  document.querySelectorAll(".js-email").forEach(item => {
    const address = item.dataset.u + "@" + item.dataset.d;
    const link = item.querySelector(".link");
    link.href = "mailto:" + address;
    link.querySelector(".link-handle").textContent = address;
    item.hidden = false;
  });

  // Layout depends on the display typeface (line breaks, the name), so wait for
  // it, but never longer than FONT_TIMEOUT.
  const FONT_TIMEOUT = 3000;
  const fontsReady = Promise.race([
    document.fonts && document.fonts.load
      ? Promise.all([document.fonts.load('400 1em "Necto Mono"', "Nicolás 0123456789"), document.fonts.ready])
      : Promise.resolve(),
    new Promise(resolve => setTimeout(resolve, FONT_TIMEOUT)),
  ]).catch(() => {});

  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

  // Distance from the top of the reel's content to an element in it. Unlike
  // getBoundingClientRect, it ignores the cards' tilt.
  const offsetIn = el => {
    let y = 0;
    while (el && el !== reel) { y += el.offsetTop; el = el.offsetParent; }
    return y;
  };

  const stage = setupStage();
  setupNav();
  if (!motion) return;

  const introDone = playIntro(fontsReady).then(() => root.classList.add("intro-done"));

  const { gsap, ScrollTrigger } = window;
  if (!gsap || !ScrollTrigger) {
    root.classList.remove("js-motion");
    return;
  }
  gsap.registerPlugin(ScrollTrigger);

  // Card tilt has to be off while ScrollTrigger measures, or the tilted boxes
  // would shift every start and end.
  ScrollTrigger.addEventListener("refreshInit", stage.flatten);
  ScrollTrigger.addEventListener("refresh", stage.update);

  // ------------------------------------------------------------------------
  // Motion tokens: one small set, reused everywhere
  // ------------------------------------------------------------------------
  const M = {
    ease: { out: "power3.out", mask: "power4.out", move: "power2.inOut" },
    dur: { reveal: 0.9, lines: 1.05, rule: 1.1 },
    stagger: { lines: 0.1, items: 0.08, words: 0.12 },
    offset: 24,            // px a fading block rises
    scrub: 1,              // s the scrubbed scenes trail the scroll
    start: "top 82%",      // when a reveal starts
    words: { dim: 0.16, blur: 6 },
  };
  gsap.defaults({ ease: M.ease.out, duration: M.dur.reveal });

  fontsReady.then(() => {
    if (!root.classList.contains("js-motion")) return;  // failsafe already gave up
    init();
    let width = innerWidth;
    let timer;
    addEventListener("resize", () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        if (innerWidth === width) return;
        width = innerWidth;
        mm.revert();       // line breaks changed: rebuild the scenes on the new lines
        init();
      }, 250);
    });
  });

  // ------------------------------------------------------------------------
  // Stage: the reel's scrolling, the cards' tilt
  // ------------------------------------------------------------------------
  function setupStage() {
    const none = { flatten() {}, update() {} };
    if (!reel) return none;

    const smooth = motion;
    const cards = [...reel.querySelectorAll(".card")];
    const tilts = motion && reel.hasAttribute("data-tilt");
    const snaps = reel.hasAttribute("data-snap");
    const EASE = 0.1;          // share of the remaining distance covered per frame
    const TILT = 16;           // deg a card turns at full tilt
    const FLAT = 0.12;         // within this share of the viewport from the middle, cards stay flat
    const RAMP = 0.5;          // share of the viewport over which the tilt builds up
    const DEPTH = 1.6;         // perspective distance, in card widths

    let target = 0;
    let current = 0;
    let raf = 0;
    let own = -1;              // the scrollTop this script last set
    const max = () => reel.scrollHeight - reel.clientHeight;

    const step = () => {
      raf = 0;
      current += (target - current) * EASE;
      if (Math.abs(target - current) < 0.5) current = target;
      reel.scrollTop = current;
      own = reel.scrollTop;
      if (current !== target) raf = requestAnimationFrame(step);
    };
    const go = y => {
      const from = raf ? current : reel.scrollTop;
      target = clamp(y, 0, max());
      if (!smooth) { reel.scrollTop = target; return; }
      current = from;
      if (!raf) raf = requestAnimationFrame(step);
    };
    const base = () => (raf ? target : reel.scrollTop);

    // ---- one card at a time (reel with data-snap) ----
    // Each card has a stop that centres it on screen. One wheel gesture or one
    // key press moves to the next or previous card. A gesture ends after GESTURE
    // ms without wheel events, so a trackpad still coasting after a flick does
    // not turn a second card.
    const GESTURE = 220;       // ms of wheel quiet that ends a gesture
    const NEED = 30;           // px of wheel in one gesture before it turns a card
    let stops = [];
    let sum = 0;
    let spent = false;         // this gesture already turned a card
    let quiet;
    const nearest = y => stops.reduce((best, s, i) => (Math.abs(s - y) < Math.abs(stops[best] - y) ? i : best), 0);
    const show = i => go(stops[clamp(i, 0, stops.length - 1)]);
    const turn = d => show(nearest(base()) + d);
    const paged = () => snaps && stops.length > 0;

    // The wheel anywhere on the page drives the reel.
    addEventListener("wheel", e => {
      if (!onStage() || e.ctrlKey || !e.deltaY) return;   // ctrl + wheel is zoom
      e.preventDefault();
      const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? reel.clientHeight : 1;
      const dy = e.deltaY * unit;
      if (!paged()) { go(base() + dy); return; }
      clearTimeout(quiet);
      quiet = setTimeout(() => { sum = 0; spent = false; }, GESTURE);
      if (spent) return;
      sum += dy;
      if (Math.abs(sum) < NEED) return;
      spent = true;
      turn(Math.sign(sum));
    }, { passive: false });

    // Keys work wherever the focus is.
    addEventListener("keydown", e => {
      if (!onStage() || e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return;
      if (e.target.closest && e.target.closest("input, textarea, select, [contenteditable]")) return;
      const page = reel.clientHeight * 0.85;
      const moves = {
        ArrowDown: 90, ArrowUp: -90, PageDown: page, PageUp: -page,
        " ": e.shiftKey ? -page : page,
      };
      if (e.key === "Home") { e.preventDefault(); paged() ? show(0) : go(0); return; }
      if (e.key === "End") { e.preventDefault(); paged() ? show(stops.length - 1) : go(max()); return; }
      if (!(e.key in moves)) return;
      e.preventDefault();
      if (paged()) turn(Math.sign(moves[e.key]));
      else go(base() + moves[e.key]);
    });

    // In-page links into the reel glide there instead of jumping. The skip link
    // targets the reel itself: it moves focus there and leaves the scroll alone.
    document.addEventListener("click", e => {
      const a = e.target.closest && e.target.closest('a[href^="#"]');
      if (!a || !onStage()) return;
      const id = a.getAttribute("href").slice(1);
      const el = id && document.getElementById(id);
      if (el === reel) { e.preventDefault(); reel.setAttribute("tabindex", "-1"); reel.focus({ preventScroll: true }); return; }
      if (!el || !reel.contains(el)) return;
      e.preventDefault();
      go(offsetIn(el) - reel.clientHeight * 0.12);
      if (!el.hasAttribute("tabindex")) el.setAttribute("tabindex", "-1");
      el.focus({ preventScroll: true });
    });

    // Scrolls this script did not make (focus moving with Tab, find in page,
    // the scrollbar on touch screens) become the new resting point.
    let queued = false;
    reel.addEventListener("scroll", () => {
      if (!raf && Math.abs(reel.scrollTop - own) > 1) target = current = reel.scrollTop;
      if (!queued) { queued = true; requestAnimationFrame(update); }
    }, { passive: true });

    // ---- tilt ----
    // A card is flat while it holds the middle of the screen. Leaving, it turns
    // on its vertical axis, seen from the middle of the screen: above the middle
    // its top edge flares out, below it the bottom edge does.
    let geo = [];
    const measure = () => {
      geo = cards.map(c => ({ c, top: offsetIn(c), h: c.offsetHeight, w: c.offsetWidth }));
      const vh = reel.clientHeight;
      stops = geo.map(g => clamp(Math.round(g.top + g.h / 2 - vh / 2), 0, max()));
    };
    const flatten = () => cards.forEach(c => { c.style.transform = ""; c.style.transformOrigin = ""; });
    function update() {
      queued = false;
      if (!tilts || !onStage()) { flatten(); return; }
      if (!geo.length) measure();
      const vh = reel.clientHeight;
      const mid = vh / 2;
      const s = reel.scrollTop;
      for (const g of geo) {
        const top = g.top - s;
        if (top > vh || top + g.h < 0) continue;            // off screen
        const m = Math.min(g.h / 2, vh * 0.3);              // tall cards stay flat longer
        const near = clamp(mid, top + m, top + g.h - m);
        const k = clamp((Math.abs(near - mid) / vh - FLAT) / RAMP, 0, 1);
        if (!k) { g.c.style.transform = ""; g.c.style.transformOrigin = ""; continue; }
        const eased = k * k * (3 - 2 * k);
        g.c.style.transformOrigin = `50% ${(mid - top).toFixed(1)}px`;
        g.c.style.transform = `perspective(${Math.round(g.w * DEPTH)}px) rotateY(${(-TILT * eased).toFixed(2)}deg)`;
      }
    }

    const relayout = () => { measure(); update(); };
    if (window.ResizeObserver) new ResizeObserver(relayout).observe(reel.querySelector(".spine") || reel);
    stageQuery.addEventListener("change", relayout);
    fontsReady.then(relayout);

    return { flatten, update: relayout };
  }

  // ------------------------------------------------------------------------
  // Splitting text into masked lines and words
  // ------------------------------------------------------------------------
  function splitLines(el) {
    if (!el._skills && el.querySelector(".skill")) {
      el._skills = [...el.querySelectorAll(".skill")].map(s => s.textContent.trim());
    }
    if (el._skills) { splitSkills(el, el._skills); return; }

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
      inner.textContent = line.join(" ");
      mask.append(inner);
      el.append(mask);
      if (i < lines.length - 1) el.append(" ");
    });
  }

  // Like splitLines, but each skill stays whole (and hoverable): a skill and its
  // punctuation never break apart, and lines are built from whole skills.
  function splitSkills(el, skills) {
    const unit = (name, i) => {
      const u = document.createElement("span");
      u.className = "skill-unit";
      const s = document.createElement("span");
      s.className = "skill";
      s.textContent = name;
      u.append(s, i < skills.length - 1 ? "," : ".");
      return u;
    };

    el.textContent = "";
    const units = skills.map((name, i) => {
      const u = unit(name, i);
      el.append(u);
      if (i < skills.length - 1) el.append(" ");
      return u;
    });

    const rows = [];
    let top = null;
    units.forEach((u, i) => {
      if (top === null || Math.abs(u.offsetTop - top) > 2) {
        rows.push([]);
        top = u.offsetTop;
      }
      rows[rows.length - 1].push(i);
    });

    el.textContent = "";
    rows.forEach((row, r) => {
      const mask = document.createElement("span");
      mask.className = "ln";
      const inner = document.createElement("span");
      inner.className = "ln-in";
      row.forEach((i, k) => {
        inner.append(unit(skills[i], i));
        if (k < row.length - 1) inner.append(" ");
      });
      mask.append(inner);
      el.append(mask);
      if (r < rows.length - 1) el.append(" ");
    });
  }

  function splitWords(el) {
    if (el.dataset.split) return;   // words do not depend on width: split once
    const words = el.textContent.replace(/\s+/g, " ").trim().split(" ");
    el.textContent = "";
    words.forEach((word, i) => {
      const span = document.createElement("span");
      span.className = "w";
      span.textContent = word;
      el.append(span);
      if (i < words.length - 1) el.append(" ");
    });
    el.dataset.split = "words";
  }

  // ------------------------------------------------------------------------
  // Scenes
  // ------------------------------------------------------------------------
  let mm;

  function init() {
    stage.flatten();   // split lines on the cards' real, untilted width
    document.querySelectorAll("[data-lines]").forEach(splitLines);
    document.querySelectorAll("[data-words]").forEach(splitWords);

    mm = gsap.matchMedia();
    mm.add({ desktop: DESKTOP, mobile: MOBILE }, ctx => {
      const desktop = ctx.conditions.desktop;
      const handled = new Set();
      ScrollTrigger.defaults({ scroller: desktop && reel ? reel : window });

      if (desktop) {
        aboutScene(handled, true);
        stackScene(handled);
        expScene(handled);
      } else {
        aboutScene(handled, false);
        introDone.then(() => ctx.add(heroScene));
      }
      certsScene(handled);
      reveals(handled, desktop);
    });

    root.classList.add("motion-on");
    ScrollTrigger.refresh();
  }

  const lines = scope => scope.querySelectorAll(".ln-in");

  // Words light up through the accent: the edge of what has been read glows blue.
  const color = name => getComputedStyle(root).getPropertyValue(name).trim();
  const wordsFrom = () => ({ opacity: M.words.dim, filter: `blur(${M.words.blur}px)`, yPercent: 14, color: color("--accent") });
  const wordsTo = extra => ({
    keyframes: {
      "0%": { opacity: M.words.dim, filter: `blur(${M.words.blur}px)`, yPercent: 14, color: color("--accent") },
      "55%": { opacity: 1, filter: "blur(0px)", yPercent: 0, color: color("--accent") },
      "100%": { color: color("--ink") },
      easeEach: "none",
    },
    ease: "none",
    stagger: M.stagger.words,
    ...extra,
  });

  // Phones: leaving the hero, the name lags behind the scroll, the corner words part.
  function heroScene() {
    const hero = document.querySelector(".hero");
    if (!hero) return;
    gsap.timeline({ scrollTrigger: { trigger: hero, start: "top top", end: "bottom top", scrub: true, invalidateOnRefresh: true } })
      .to(hero.querySelector(".name"), { y: () => innerHeight * 0.22, ease: "none" }, 0)
      .to(hero.querySelector(".ghost-l"), { xPercent: -45, ease: "none" }, 0)
      .to(hero.querySelector(".ghost-r"), { xPercent: 45, ease: "none" }, 0)
      .to(hero.querySelectorAll(".meta, .role"), { autoAlpha: 0, ease: "none", duration: 0.4 }, 0);
  }

  // About: the statement lights up word by word, then the paragraph arrives.
  // Desktop: About is the first card, on screen from the start, so it plays once
  // the hero has landed. Phones: it follows the scroll.
  function aboutScene(handled, desktop) {
    const sec = document.querySelector('[data-scene="about"]');
    if (!sec) return;
    const lead = sec.querySelector("[data-words]");
    const fades = sec.querySelectorAll("[data-fade]");
    const side = sec.querySelector("[data-side]");
    handled.add(lead);
    fades.forEach(el => handled.add(el));

    if (desktop) {
      handled.add(side);
      const words = lead.querySelectorAll(".w");
      gsap.set(side, { xPercent: 105 });                 // starting states now, so
      gsap.set(words, wordsFrom());                      // nothing shows lit before
      gsap.set(fades, { autoAlpha: 0, y: M.offset });    // the sequence runs
      const tl = gsap.timeline({ paused: true })
        .to(side, { xPercent: 0, duration: 0.8 }, 0)
        .to(words, wordsTo({ duration: 1.1, stagger: 0.07 }), 0.1)
        .to(fades, { autoAlpha: 1, y: 0, stagger: 0.1 }, ">-0.5");
      introDone.then(() => tl.play());
      return;
    }

    gsap.timeline({ scrollTrigger: { trigger: sec, start: "top 85%", end: "top top", scrub: M.scrub } })
      .set(lead.querySelectorAll(".w"), wordsFrom(), 0)
      .to(lead.querySelectorAll(".w"), wordsTo({ duration: 0.6 }), 0)
      .fromTo(fades, { autoAlpha: 0, y: M.offset }, { autoAlpha: 1, y: 0, duration: 0.35, stagger: 0.1, ease: M.ease.out }, ">-0.2");
  }

  // Works with: each line comes in from alternating sides and settles in place.
  function stackScene(handled) {
    const sec = document.querySelector('[data-scene="stack"]');
    if (!sec) return;
    const text = sec.querySelector("[data-lines]");
    handled.add(text);
    gsap.fromTo(lines(text),
      { xPercent: i => (i % 2 ? -55 : 55), opacity: 0.12 },
      { xPercent: 0, opacity: 1, ease: "none", stagger: 0.06,
        scrollTrigger: { trigger: sec, start: "top 95%", end: "top 25%", scrub: M.scrub } });
  }

  // Experience: each job is drawn as the card goes by: branch, node, years,
  // name, then the details. The last job is in before the card's end arrives.
  function expScene(handled) {
    const sec = document.querySelector('[data-scene="exp"]');
    if (!sec) return;
    const jobs = [...sec.querySelectorAll(".job")];
    jobs.forEach(job => job.querySelectorAll("[data-rule], [data-node], [data-side], [data-lines], [data-fade]").forEach(el => handled.add(el)));

    const tl = gsap.timeline({ scrollTrigger: { trigger: sec, start: "top 70%", end: "bottom 95%", scrub: M.scrub } });
    jobs.forEach((job, i) => {
      const at = i * 0.55;
      tl.fromTo(job.querySelector("[data-rule]"), { scaleX: 0 }, { scaleX: 1, duration: 0.7, ease: "power2.out" }, at)
        .fromTo(job.querySelector("[data-node]"), { scale: 0 }, { scale: 1, duration: 0.25, ease: "power2.out" }, at)
        .fromTo(job.querySelector("[data-side]"), { xPercent: 105 }, { xPercent: 0, duration: 0.4 }, at + 0.1)
        .fromTo(lines(job), { yPercent: 115 }, { yPercent: 0, duration: 0.45 }, at + 0.15)
        .fromTo(job.querySelectorAll("[data-fade]"), { autoAlpha: 0, y: M.offset }, { autoAlpha: 1, y: 0, duration: 0.4, stagger: 0.08 }, at + 0.25);
    });
  }

  // Certifications: one sequence for the whole list.
  function certsScene(handled) {
    const list = document.querySelector('[data-scene="certs"] .certs');
    if (!list) return;
    list.querySelectorAll("[data-lines]").forEach(el => handled.add(el));
    gsap.fromTo(lines(list), { yPercent: 115 },
      { yPercent: 0, duration: M.dur.lines, ease: M.ease.mask, stagger: 0.07, scrollTrigger: { trigger: list, start: M.start, once: true } });
  }

  // Everything no scene took over.
  // Desktop: each card assembles as one sequence, in reading order, started by
  // the card arriving, so nothing waits for its own spot to scroll into view.
  // Phones: sections are taller than the viewport, so each piece waits for itself.
  function reveals(handled, desktop) {
    const free = sel => gsap.utils.toArray(sel).filter(el => !handled.has(el));

    free("[data-words]").forEach(el => {
      const words = el.querySelectorAll(".w");
      const screen = desktop && el.closest(".screen");
      gsap.set(words, wordsFrom());
      gsap.to(words, wordsTo({
        scrollTrigger: screen
          ? { trigger: screen, start: "top 85%", end: "top 35%", scrub: M.scrub }
          : { trigger: el, start: "top 88%", end: "bottom 45%", scrub: M.scrub },
      }));
    });

    const pieces = free("[data-lines], [data-side], [data-rule], [data-node], [data-fade]");

    if (desktop) {
      const screens = new Map();
      pieces.forEach(el => {
        const screen = el.closest(".screen, .card, .foot") || el;
        if (!screens.has(screen)) screens.set(screen, []);
        screens.get(screen).push(el);
      });
      screens.forEach((els, screen) => {
        // The footer is last: the reel may end before it gets far up the screen.
        const start = screen.matches(".foot") ? "top bottom" : "top 80%";
        const tl = gsap.timeline({ scrollTrigger: { trigger: screen, start, once: true } });
        els.forEach((el, i) => {
          const [targets, from, to] = motionFor(el, true);
          tl.fromTo(targets, from, to, i * M.stagger.items);
        });
      });
      return;
    }

    pieces.forEach(el => {
      const [targets, from, to] = motionFor(el, false);
      const trigger = el.matches("[data-side], [data-rule], [data-node]") ? el.parentElement : el;
      gsap.fromTo(targets, from, { ...to, scrollTrigger: { trigger, start: M.start, once: true } });
    });
  }

  // The one motion each kind of piece makes, as [targets, from, to].
  function motionFor(el, desktop) {
    if (el.matches("[data-lines]")) {
      return [lines(el), { yPercent: 115 }, { yPercent: 0, duration: M.dur.lines, ease: M.ease.mask, stagger: M.stagger.lines }];
    }
    if (el.matches("[data-side]")) {
      return [el, desktop ? { xPercent: 105 } : { yPercent: 105 }, { xPercent: 0, yPercent: 0 }];
    }
    if (el.matches("[data-rule]")) return [el, { scaleX: 0 }, { scaleX: 1, duration: M.dur.rule }];
    if (el.matches("[data-node]")) return [el, { scale: 0 }, { scale: 1, duration: 0.5 }];
    return [el, { autoAlpha: 0, y: M.offset }, { autoAlpha: 1, y: 0 }];
  }

  // ------------------------------------------------------------------------
  // Load sequence. Resolves once the hero has fully arrived.
  // ------------------------------------------------------------------------
  function playIntro(ready) {
    return new Promise(done => {
      const count = document.querySelector(".count");
      const axis = document.querySelector(".hero .axis");
      const SETTLED = 1700;  // ms after the reveal until the hero's own transitions end
      const reveal = () => {
        root.classList.remove("is-loading");
        root.classList.add("is-ready");
        setTimeout(done, SETTLED);
      };
      if (!root.classList.contains("is-loading")) { done(); return; }
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
    });
  }

  // ------------------------------------------------------------------------
  // Top bar: once the page has scrolled, give it a backing (phones)
  // ------------------------------------------------------------------------
  function setupNav() {
    const update = () => root.classList.toggle("scrolled", scrollY > 40);
    addEventListener("scroll", update, { passive: true });
    update();
  }
})();
