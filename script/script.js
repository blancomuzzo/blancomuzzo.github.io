// Motion for the portfolio. Everything here is off for prefers-reduced-motion,
// and if GSAP, ScrollTrigger or Lenis fail to load the page stays readable.
//
// 1. Load sequence: the axis grows while a counter climbs to 100, the name rolls in.
// 2. Smooth scroll (Lenis) that settles on the next section when you let go.
// 3. Scenes (GSAP ScrollTrigger), desktop:
//    hero      the name lags and the corner words drift apart as you leave
//    about     held on screen while the statement lights up word by word
//    stack     each line slides in from alternating sides into place
//    projects  held on screen while the panels travel sideways behind the axis
//    exp       held on screen while the timeline is built job by job
//    certs     lines rise in sequence
//    foot      the two corner words close in
//    On phones the held scenes become plain reveals as each piece enters.

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
      ? Promise.all([
          document.fonts.load('600 1em "EB Garamond"', "Nicolás 0123456789"),
          document.fonts.load('500 1em "Mona Sans"'),
          document.fonts.ready,
        ])
      : Promise.resolve(),
    new Promise(resolve => setTimeout(resolve, FONT_TIMEOUT)),
  ]).catch(() => {});

  setupNav();
  if (!motion) return;

  const introDone = playIntro(fontsReady).then(() => root.classList.add("intro-done"));

  const { gsap, ScrollTrigger } = window;
  if (!gsap || !ScrollTrigger) {
    root.classList.remove("js-motion");
    return;
  }
  gsap.registerPlugin(ScrollTrigger);

  // ------------------------------------------------------------------------
  // Motion tokens: one small set, reused everywhere
  // ------------------------------------------------------------------------
  const M = {
    ease: { out: "power3.out", mask: "power4.out", move: "power2.inOut" },
    dur: { reveal: 0.9, lines: 1.05, rule: 1.1, snap: 0.95 },
    stagger: { lines: 0.1, items: 0.08, words: 0.12 },
    offset: 24,            // px a fading block rises
    scrub: 1,              // s the scrubbed scenes trail the scroll
    start: "top 82%",      // when a reveal starts
    words: { dim: 0.16, blur: 6 },
  };
  gsap.defaults({ ease: M.ease.out, duration: M.dur.reveal });

  const DESKTOP = "(min-width: 53.01rem) and (min-height: 34rem)";
  const MOBILE = "(max-width: 53rem), (max-height: 33.99rem)";

  const lenis = setupLenis();
  let zones = [];          // scroll ranges where a whole section is on screen
  let sceneZones = [];     // functions held scenes register to report theirs

  introDone.then(heroScene);
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
  // Smooth scroll, and settling on a section when the scroll stops
  // ------------------------------------------------------------------------
  function setupLenis() {
    if (!window.Lenis) return null;
    const lenis = new window.Lenis({ lerp: 0.09, smoothWheel: true, wheelMultiplier: 0.9, anchors: true });
    lenis.on("scroll", ScrollTrigger.update);
    gsap.ticker.add(time => lenis.raf(time * 1000));
    gsap.ticker.lagSmoothing(0);

    lenis.stop();                       // no scrolling during the load sequence
    introDone.then(() => lenis.start());

    // When the scroll comes to rest between two sections, finish the trip to the
    // next one in the direction you were going. Inside a held scene any resting
    // point is fine: the whole screen is one section.
    const IDLE = 180;
    const ease = t => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
    let idle;
    let dir = 1;
    let snapping = false;

    const settle = () => {
      if (snapping || !matchMedia(DESKTOP).matches || !zones.length) return;
      const y = lenis.scroll;
      if (zones.some(([a, b]) => y >= a - 3 && y <= b + 3)) return;
      let target = null;
      if (dir > 0) {
        const next = zones.find(([a]) => a > y);
        if (next) target = next[0];
      } else {
        for (let i = zones.length - 1; i >= 0; i--) {
          if (zones[i][1] < y) { target = zones[i][1]; break; }
        }
      }
      if (target === null) return;
      snapping = true;
      const release = () => { snapping = false; };
      lenis.scrollTo(target, { duration: M.dur.snap, easing: ease, lock: true, onComplete: release });
      setTimeout(release, M.dur.snap * 1000 + 400);
    };

    // Wheel and trackpad scrolls go through Lenis's smoothing: settle as soon as
    // it has nearly stopped, without waiting out its long, almost still tail.
    // Native scrolls (scrollbar, keys) settle after a pause instead, so a
    // scrollbar drag is never fought mid-gesture.
    const SLOW = 2.5;          // px per frame
    const HANDS_OFF = 90;      // ms since the last wheel event: the gesture is over
    const NATIVE_IDLE = 400;   // ms
    let lastWheel = 0;
    addEventListener("wheel", () => { lastWheel = performance.now(); }, { passive: true });
    lenis.on("scroll", l => {
      if (l.direction) dir = l.direction;
      if (snapping) return;
      clearTimeout(idle);
      const handsOff = performance.now() - lastWheel > HANDS_OFF;
      if (l.isScrolling === "smooth" && handsOff && Math.abs(l.velocity) < SLOW) settle();
      else idle = setTimeout(settle, l.isScrolling === "smooth" ? IDLE : NATIVE_IDLE);
    });

    ScrollTrigger.addEventListener("refresh", computeZones);
    return lenis;
  }

  function computeZones() {
    const vh = innerHeight;
    const max = ScrollTrigger.maxScroll(window);
    const held = new Set();
    const out = [[0, 0]];
    sceneZones.forEach(fn => fn(out, held));
    document.querySelectorAll(".screen:not(.panel)").forEach(el => {
      if (held.has(el)) return;
      const top = el.getBoundingClientRect().top + scrollY;
      out.push([top, top + Math.max(0, el.offsetHeight - vh)]);
    });
    out.push([max, max]);
    zones = out
      .map(([a, b]) => [Math.min(Math.round(a), max), Math.min(Math.round(b), max)])
      .sort((p, q) => p[0] - q[0]);
    root.dataset.zones = JSON.stringify(zones);   // inspectable in devtools
  }

  // ------------------------------------------------------------------------
  // Splitting text into masked lines and words
  // ------------------------------------------------------------------------
  function splitLines(el) {
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
    document.querySelectorAll("[data-lines]").forEach(splitLines);
    document.querySelectorAll("[data-words]").forEach(splitWords);

    mm = gsap.matchMedia();
    mm.add({ desktop: DESKTOP, mobile: MOBILE }, ctx => {
      const desktop = ctx.conditions.desktop;
      const handled = new Set();
      const cleanups = [];
      sceneZones = [];

      if (desktop) {
        aboutScene(handled);
        stackScene(handled);
        cleanups.push(projectsScene(handled));
        expScene(handled);
      }
      certsScene(handled);
      footScene();
      reveals(handled, desktop);

      return () => {
        cleanups.forEach(fn => fn && fn());
        sceneZones = [];
      };
    });

    root.classList.add("motion-on");
    ScrollTrigger.refresh();
  }

  const lines = scope => scope.querySelectorAll(".ln-in");
  const mark = (handled, scope, sel) => scope.querySelectorAll(sel).forEach(el => handled.add(el));

  const wordsFrom = () => ({ opacity: M.words.dim, filter: `blur(${M.words.blur}px)`, yPercent: 14 });
  const wordsTo = extra => ({ opacity: 1, filter: "blur(0px)", yPercent: 0, ease: "none", stagger: M.stagger.words, ...extra });

  // Leaving the hero: the name lags behind the scroll, the corner words part.
  function heroScene() {
    const hero = document.querySelector(".hero");
    if (!hero) return;
    gsap.timeline({ scrollTrigger: { trigger: hero, start: "top top", end: "bottom top", scrub: true, invalidateOnRefresh: true } })
      .to(hero.querySelector(".name"), { y: () => innerHeight * 0.22, ease: "none" }, 0)
      .to(hero.querySelector(".ghost-l"), { xPercent: -45, ease: "none" }, 0)
      .to(hero.querySelector(".ghost-r"), { xPercent: 45, ease: "none" }, 0)
      .to(hero.querySelectorAll(".meta, .role"), { autoAlpha: 0, ease: "none", duration: 0.4 }, 0);
  }

  // About: the screen holds while the statement lights up word by word,
  // then the two paragraphs arrive.
  function aboutScene(handled) {
    const sec = document.querySelector('[data-scene="about"]');
    if (!sec) return;
    const lead = sec.querySelector("[data-words]");
    const fades = sec.querySelectorAll("[data-fade]");
    handled.add(lead);
    fades.forEach(el => handled.add(el));

    const tl = gsap.timeline({
      scrollTrigger: { trigger: sec, start: "top top", end: "+=120%", pin: true, scrub: M.scrub, anticipatePin: 1 },
    });
    tl.fromTo(lead.querySelectorAll(".w"), wordsFrom(), wordsTo({ duration: 0.6 }))
      .fromTo(fades, { autoAlpha: 0, y: M.offset }, { autoAlpha: 1, y: 0, duration: 0.5, stagger: 0.15, ease: M.ease.out }, ">-0.15")
      .to({}, { duration: 0.35 });
    holdZone(sec, tl.scrollTrigger);
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
        scrollTrigger: { trigger: sec, start: "top 95%", end: "top 15%", scrub: M.scrub } });
  }

  // Projects: the section holds; each panel slides in from the right and the
  // last one leaves behind the axis. Labels on the left swap, a bar tracks progress.
  function projectsScene(handled) {
    const sec = document.querySelector('[data-scene="projects"]');
    if (!sec) return null;
    const track = sec.querySelector(".hscene-track");
    const panels = [...sec.querySelectorAll(".panel")];
    panels.forEach(p => mark(handled, p, "[data-lines], [data-fade], [data-side]"));
    sec.classList.add("is-h");

    const labels = document.createElement("div");
    labels.className = "hscene-labels";
    labels.setAttribute("aria-hidden", "true");
    panels.forEach(p => {
      const outer = document.createElement("span");
      const inner = document.createElement("span");
      inner.innerHTML = p.querySelector(".label [data-side]").innerHTML;
      outer.append(inner);
      labels.append(outer);
    });
    const bar = document.createElement("div");
    bar.className = "hscene-bar";
    bar.setAttribute("aria-hidden", "true");
    const fill = document.createElement("span");
    bar.append(fill);
    sec.append(labels, bar);

    let active = -1;
    const setActive = i => {
      if (i === active) return;
      active = i;
      [...labels.children].forEach((el, j) => {
        el.classList.toggle("is-on", j === i);
        el.classList.toggle("is-past", j < i);
      });
    };

    // The first panel is revealed as the section arrives.
    const first = panels[0];
    gsap.timeline({ scrollTrigger: { trigger: sec, start: "top 70%", once: true, onEnter: () => setActive(Math.max(active, 0)) } })
      .fromTo(lines(first), { yPercent: 115 }, { yPercent: 0, duration: M.dur.lines, ease: M.ease.mask, stagger: M.stagger.lines })
      .fromTo(first.querySelectorAll("[data-fade]"), { autoAlpha: 0, y: M.offset }, { autoAlpha: 1, y: 0, stagger: M.stagger.items }, 0.3);

    // One timeline: a rest on each panel (DWELL), a move between them (MOVE).
    const START = 0.5, MOVE = 1, DWELL = 0.5;
    const REST = 0.2;   // where each panel rests, past the end of its move, once its details are in
    const moves = [];
    const tl = gsap.timeline({ defaults: { ease: "none" } });
    tl.to({}, { duration: START });
    panels.slice(1).forEach((panel, k) => {
      const at = tl.duration();
      moves.push(at);
      tl.to(track, { xPercent: -100 * (k + 1), duration: MOVE, ease: M.ease.move }, at)
        .fromTo(lines(panel), { yPercent: 115 }, { yPercent: 0, duration: 0.55, stagger: 0.08, ease: M.ease.out }, at + 0.35)
        .fromTo(panel.querySelectorAll("[data-fade]"), { autoAlpha: 0, y: M.offset },
          { autoAlpha: 1, y: 0, duration: 0.45, stagger: 0.05, ease: M.ease.out }, at + 0.55)
        .to({}, { duration: DWELL }, at + MOVE);
    });
    const total = tl.duration();
    tl.fromTo(fill, { scaleX: 0 }, { scaleX: 1, duration: total }, 0);

    // The label flips a little before the halfway point, as the new title lands.
    const indexAt = t => moves.filter(m => t >= m + MOVE * 0.39).length;

    const st = ScrollTrigger.create({
      trigger: sec,
      start: "top top",
      end: () => "+=" + innerHeight * total * 0.85,
      pin: true,
      scrub: M.scrub,
      anticipatePin: 1,
      invalidateOnRefresh: true,
      animation: tl,
    });
    // Follow the timeline itself, not the scroll: with scrub the picture trails
    // the scroll, and the label has to match the picture.
    tl.eventCallback("onUpdate", () => { if (tl.time() > 0) setActive(indexAt(tl.time())); });

    // Resting points: one per panel, so any small scroll from a panel carries on
    // to the next one instead of idling through scroll where nothing moves.
    const at = t => st.start + (t / total) * (st.end - st.start);
    const rests = [0, ...moves.map(m => m + MOVE + REST)];
    sceneZones.push((out, held) => {
      held.add(sec);
      rests.forEach(t => out.push([at(t), at(t)]));
    });

    // Index links glide to their panel instead of jumping to the section top.
    const onClick = e => {
      const link = e.target.closest("[data-panel]");
      if (!link) return;
      e.preventDefault();
      e.stopPropagation();   // capture phase: Lenis's own anchor handling never sees it
      const i = +link.dataset.panel;
      const y = at(rests[i]);
      if (lenis) lenis.scrollTo(y, { duration: 1.6 });
      else window.scrollTo({ top: y, behavior: "smooth" });
    };
    sec.addEventListener("click", onClick, true);

    return () => {
      sec.removeEventListener("click", onClick, true);
      sec.classList.remove("is-h");
      labels.remove();
      bar.remove();
    };
  }

  // Experience: the screen holds while each job is drawn: branch, node, years,
  // name, then the details.
  function expScene(handled) {
    const sec = document.querySelector('[data-scene="exp"]');
    if (!sec) return;
    const jobs = [...sec.querySelectorAll(".job")];
    jobs.forEach(job => mark(handled, job, "[data-rule], [data-node], [data-side], [data-lines], [data-fade]"));

    const tl = gsap.timeline({
      scrollTrigger: { trigger: sec, start: "top top", end: "+=110%", pin: true, scrub: M.scrub, anticipatePin: 1 },
    });
    jobs.forEach((job, i) => {
      const at = i * 0.55;
      tl.fromTo(job.querySelector("[data-rule]"), { scaleX: 0 }, { scaleX: 1, duration: 0.7, ease: "power2.out" }, at)
        .fromTo(job.querySelector("[data-node]"), { scale: 0 }, { scale: 1, duration: 0.25, ease: "power2.out" }, at)
        .fromTo(job.querySelector("[data-side]"), { xPercent: 105 }, { xPercent: 0, duration: 0.4 }, at + 0.1)
        .fromTo(lines(job), { yPercent: 115 }, { yPercent: 0, duration: 0.45 }, at + 0.15)
        .fromTo(job.querySelectorAll("[data-fade]"), { autoAlpha: 0, y: M.offset }, { autoAlpha: 1, y: 0, duration: 0.4, stagger: 0.08 }, at + 0.25);
    });
    tl.to({}, { duration: 0.4 });
    holdZone(sec, tl.scrollTrigger);
  }

  function holdZone(sec, st) {
    sceneZones.push((out, held) => {
      held.add(sec);
      out.push([st.start, st.end]);
    });
  }

  // Certifications: one sequence for the whole list.
  function certsScene(handled) {
    const list = document.querySelector('[data-scene="certs"] .certs');
    if (!list) return;
    mark(handled, list, "[data-lines]");
    gsap.fromTo(lines(list), { yPercent: 115 },
      { yPercent: 0, duration: M.dur.lines, ease: M.ease.mask, stagger: 0.07, scrollTrigger: { trigger: list, start: M.start, once: true } });
  }

  // Footer: the two words close in as the page ends.
  function footScene() {
    const foot = document.querySelector('[data-scene="foot"]');
    if (!foot) return;
    const [l, r] = foot.querySelectorAll(".foot-word");
    const st = { trigger: foot, start: "top bottom", end: "bottom bottom", scrub: M.scrub };
    gsap.fromTo(l, { xPercent: -70 }, { xPercent: 0, ease: "none", scrollTrigger: st });
    gsap.fromTo(r, { xPercent: 70 }, { xPercent: 0, ease: "none", scrollTrigger: { ...st } });
  }

  // Everything no scene took over: revealed once, as it enters.
  function reveals(handled, desktop) {
    const free = sel => gsap.utils.toArray(sel).filter(el => !handled.has(el));
    const once = trigger => ({ trigger, start: M.start, once: true });

    free("[data-lines]").forEach(el => {
      gsap.fromTo(lines(el), { yPercent: 115 },
        { yPercent: 0, duration: M.dur.lines, ease: M.ease.mask, stagger: M.stagger.lines, scrollTrigger: once(el) });
    });

    free("[data-words]").forEach(el => {
      gsap.fromTo(el.querySelectorAll(".w"), wordsFrom(),
        wordsTo({ scrollTrigger: { trigger: el, start: "top 88%", end: "bottom 45%", scrub: M.scrub } }));
    });

    free("[data-side]").forEach(el => {
      gsap.fromTo(el, desktop ? { xPercent: 105 } : { yPercent: 105 },
        { xPercent: 0, yPercent: 0, scrollTrigger: once(el.parentElement) });
    });

    free("[data-rule]").forEach(el => {
      gsap.fromTo(el, { scaleX: 0 }, { scaleX: 1, duration: M.dur.rule, scrollTrigger: once(el.parentElement) });
    });

    free("[data-node]").forEach(el => {
      gsap.fromTo(el, { scale: 0 }, { scale: 1, duration: 0.5, scrollTrigger: once(el.parentElement) });
    });

    const fades = free("[data-fade]");
    gsap.set(fades, { autoAlpha: 0, y: M.offset });
    ScrollTrigger.batch(fades, {
      start: M.start,
      once: true,
      onEnter: batch => gsap.to(batch, { autoAlpha: 1, y: 0, stagger: M.stagger.items, overwrite: true }),
    });
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
