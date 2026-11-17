// Motion for the one-page site. Scroll is the only input: nothing here listens
// to clicks, the pointer or the keyboard beyond what the browser already does.
// If GSAP or ScrollTrigger fail to load, or for prefers-reduced-motion, the
// page stays readable top to bottom with everything in place.
//
// Scenes, in page order:
//   hero        the name rises in on load and drifts up as you leave it
//   about       pinned; the statement lights up word by word
//   stack       each line slides in from alternating sides, its rule drawn out
//   certs       pinned; the counter climbs as each certification lights up
//   projects    pinned on desktop; scrolling down moves the projects sideways
//   experience  the axis fills in blue; each job lights its node as it passes
//   contact     the links rise through their masks
// Around them: a progress bar at the top and the current section in the corner.

(() => {
  const root = document.documentElement;
  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];

  const year = $("#year");
  if (year) year.textContent = new Date().getFullYear();

  // Full years of experience since the career start date (3 January 2019).
  // Runs before the statement is split into words, so the number is split too.
  const CAREER_START = new Date(2019, 0, 3);
  const now = new Date();
  let years = now.getFullYear() - CAREER_START.getFullYear();
  if (now < new Date(now.getFullYear(), CAREER_START.getMonth(), CAREER_START.getDate())) years--;
  $$(".js-years").forEach(el => { el.textContent = years; });

  // Email link, assembled here so the address is not in the HTML.
  $$(".js-email").forEach(item => {
    const address = item.dataset.u + "@" + item.dataset.d;
    const link = $(".c-link", item);
    link.href = "mailto:" + address;
    $(".c-handle", link).textContent = address;
    item.hidden = false;
  });

  if (!root.classList.contains("js-motion")) return;
  const { gsap, ScrollTrigger } = window;
  if (!gsap || !ScrollTrigger) {
    root.classList.remove("js-motion");
    return;
  }
  gsap.registerPlugin(ScrollTrigger);
  ScrollTrigger.config({ ignoreMobileResize: true });

  // ------------------------------------------------------------------------
  // Motion tokens
  // ------------------------------------------------------------------------
  const M = {
    ease: { out: "power3.out", mask: "power4.out" },
    scrub: 1,               // s the scrubbed scenes trail the scroll
    rise: 28,               // px a block rises as it arrives
    start: "top 86%",       // when an arrival plays
    dim: 0.14,              // opacity of a word not yet lit
  };
  gsap.defaults({ ease: M.ease.out, duration: 0.9 });

  const DESKTOP = "(min-width: 53.01rem) and (min-height: 34rem)";   // same as styles.css
  const MOBILE = "(max-width: 53rem), (max-height: 33.99rem)";

  // Line breaks depend on the typeface, so wait for it (never longer than 3 s).
  const fontsReady = Promise.race([
    document.fonts && document.fonts.load
      ? Promise.all([document.fonts.load('400 1em "Necto Mono"', "Nicolás 0123456789"), document.fonts.ready])
      : Promise.resolve(),
    new Promise(resolve => setTimeout(resolve, 3000)),
  ]).catch(() => {});

  fontsReady.then(() => {
    if (!root.classList.contains("js-motion")) return;   // the failsafe already gave up
    root.classList.add("motion-on");
    splitWords();
    build();
    requestAnimationFrame(() => root.classList.add("is-in"));
  });

  // Wrap every word of [data-words] in a span, keeping any inline markup.
  function splitWords() {
    $$("[data-words]").forEach(el => {
      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      const nodes = [];
      while (walker.nextNode()) nodes.push(walker.currentNode);
      nodes.forEach(node => {
        const frag = document.createDocumentFragment();
        node.textContent.split(/(\s+)/).forEach(part => {
          if (!part) return;
          if (/^\s+$/.test(part)) { frag.append(part); return; }
          const w = document.createElement("span");
          w.className = "w";
          w.textContent = part;
          frag.append(w);
        });
        node.replaceWith(frag);
      });
    });
  }

  // A block (or blocks) that rises in once it reaches the screen and sinks
  // back if you scroll above it again.
  const arrive = (targets, trigger, extra = {}) => gsap.from(targets, {
    y: M.rise,
    opacity: 0,
    stagger: 0.07,
    scrollTrigger: { trigger, start: M.start, toggleActions: "play none none reverse" },
    ...extra,
  });

  // Every trigger is created inside one matchMedia block, in page order, so the
  // pins above always push the triggers below them by the right amount.
  function build() {
    const mm = gsap.matchMedia();
    mm.add({ desktop: DESKTOP, mobile: MOBILE }, ctx => {
      const { desktop } = ctx.conditions;

      // Progress bar: the whole page, start to end.
      gsap.to(".progress span", {
        scaleX: 1,
        ease: "none",
        scrollTrigger: { start: 0, end: "max", scrub: 0.3 },
      });

      // HERO: the name drifts up and fades as you leave it.
      gsap.to(".hero-inner", {
        yPercent: -60,
        opacity: 0,
        ease: "none",
        scrollTrigger: { trigger: ".hero", start: "top top", end: "bottom top", scrub: true },
      });
      gsap.to(".cue", {
        opacity: 0,
        ease: "none",
        scrollTrigger: { trigger: ".hero", start: "top top", end: "15% top", scrub: true },
      });

      // Labels outside the pinned scenes.
      $$("[data-reveal]").forEach(el => arrive(el, el));

      // ABOUT: the statement lights up word by word.
      gsap.fromTo(".statement .w", { opacity: M.dim }, {
        opacity: 1,
        stagger: 0.1,
        duration: 0.4,
        ease: "none",
        scrollTrigger: desktop
          ? { trigger: ".statement", start: "top top", end: "+=140%", pin: true, scrub: M.scrub }
          : { trigger: ".statement-text", start: "top 80%", end: "bottom 45%", scrub: M.scrub },
      });

      // STACK: alternating sides, the rule drawn out from the axis.
      $$(".skills li").forEach((li, i) => {
        gsap.timeline({
          scrollTrigger: { trigger: li, start: "top 96%", end: "top 62%", scrub: M.scrub },
        })
          .fromTo($(".rule", li), { scaleX: 0 }, { scaleX: 1, ease: "none" }, 0)
          .fromTo($(".skill", li),
            { x: (i % 2 ? 1 : -1) * (desktop ? 90 : 28), opacity: 0 },
            { x: 0, opacity: 1, ease: "power2.out" }, 0);
      });

      // CERTIFICATIONS: one more lit for each stretch of scroll; the counter follows.
      const certs = $$(".cert-list li");
      const counter = $(".counter");
      const light = progress => {
        const n = Math.min(certs.length, Math.floor(progress * (certs.length + 1)));
        certs.forEach((li, i) => li.classList.toggle("on", i < n));
        counter.textContent = n;
      };
      light(0);
      ScrollTrigger.create(desktop
        ? { trigger: ".certs", start: "top top", end: "+=170%", pin: true, onUpdate: s => light(s.progress) }
        : { trigger: ".cert-list", start: "top 80%", end: "bottom 50%", onUpdate: s => light(s.progress) });
      if (!desktop) arrive(".certs-side", ".certs-side");

      // PROJECTS: sideways on desktop, one after another on phones.
      const panels = $$(".panel");
      if (desktop) {
        const track = $(".track");
        const distance = () => track.scrollWidth - innerWidth;
        const pan = gsap.to(track, {
          x: () => -distance(),
          ease: "none",
          scrollTrigger: {
            trigger: ".projects",
            start: "top top",
            end: () => "+=" + distance(),
            pin: true,
            scrub: M.scrub,
            invalidateOnRefresh: true,
          },
        });
        arrive($$("[data-in]", panels[0]), panels[0], {
          scrollTrigger: { trigger: ".projects", start: "top 70%", toggleActions: "play none none reverse" },
        });
        panels.slice(1).forEach(panel => {
          gsap.from($$("[data-in]", panel), {
            y: 60,
            opacity: 0,
            stagger: 0.12,
            ease: "none",
            scrollTrigger: { trigger: panel, containerAnimation: pan, start: "left 80%", end: "left 25%", scrub: true },
          });
        });
        // The big word drifts slower than the track, so it lingers as it leaves.
        gsap.to(".panel-intro .mega", {
          xPercent: 40,
          ease: "none",
          scrollTrigger: { trigger: panels[0], containerAnimation: pan, start: "left left", end: "right left", scrub: true },
        });
      } else {
        panels.forEach(panel => arrive($$("[data-in]", panel), panel));
      }

      // EXPERIENCE: the fill's tip stays level with the middle of the screen;
      // each job lights up as the tip reaches it.
      gsap.fromTo(".exp-fill", { scaleY: 0 }, {
        scaleY: 1,
        ease: "none",
        scrollTrigger: { trigger: ".jobs", start: "top 55%", end: "bottom 55%", scrub: true },
      });
      $$(".job").forEach(job => {
        ScrollTrigger.create({
          trigger: job,
          start: "top 55%",
          onEnter: () => job.classList.add("is-on"),
          onLeaveBack: () => job.classList.remove("is-on"),
        });
        arrive($$("[data-in]", job), job);
      });

      // CONTACT: the names rise through their masks, the handles follow.
      const links = $$(".contact-list li:not([hidden])");
      gsap.timeline({
        scrollTrigger: { trigger: ".contact-list", start: "top 82%", toggleActions: "play none none reverse" },
      })
        .from(links.map(li => $(".c-name", li)), { yPercent: 110, duration: 1.1, stagger: 0.08, ease: M.ease.mask }, 0)
        .from(links.map(li => $(".c-handle", li)), { opacity: 0, duration: 0.8, stagger: 0.08 }, 0.3);

      // CORNER: the current section. Created last so the pins above are counted.
      const hud = $(".hud");
      const hudNum = $(".hud-num");
      const hudName = $(".hud-name");
      ScrollTrigger.create({
        trigger: ".hero",
        start: "top top",
        end: "bottom 30%",
        onLeave: () => hud.classList.remove("is-off"),
        onEnterBack: () => hud.classList.add("is-off"),
      });
      $$("[data-hud]").forEach(section => {
        const [num, ...name] = section.dataset.hud.split(" ");
        ScrollTrigger.create({
          trigger: section,
          start: "top 50%",
          end: "bottom 50%",
          onToggle: s => {
            if (!s.isActive) return;
            hudNum.textContent = num;
            hudName.textContent = name.join(" ");
          },
        });
      });
    });
  }
})();
