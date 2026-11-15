// ---------- terminal typing ----------
const TERM = [
  ['<span class="c">$</span> ', 'whoami'],
  ['', '<span class="s">Salesforce Integrations Developer</span>'],
  ['<span class="c">$</span> ', 'cat stack.txt'],
  ['', 'Apex · LWC · REST/OAuth · AWS S3 · Omni-Channel'],
  ['<span class="c">$</span> ', 'echo $FOCUS'],
  ['', '<span class="k">solution_architecture</span> && limits.workaround()'],
];
const typed = document.getElementById("typed");

async function typeTerminal() {
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  let html = "";
  for (const [prefix, text] of TERM) {
    const isCmd = prefix !== "";
    if (!isCmd || reduce) {
      html += prefix + text + "\n";
      typed.innerHTML = html + '<span class="caret">&nbsp;</span>';
      await sleep(reduce ? 0 : 250);
      continue;
    }
    html += prefix;
    for (const ch of text) {
      html += ch;
      typed.innerHTML = html + '<span class="caret">&nbsp;</span>';
      await sleep(55 + Math.random() * 50);
    }
    html += "\n";
    await sleep(200);
  }
}
const sleep = ms => new Promise(r => setTimeout(r, ms));

// ---------- reveal on scroll + counters ----------
const io = new IntersectionObserver(entries => {
  entries.forEach(e => {
    if (!e.isIntersecting) return;
    e.target.classList.add("in");
    e.target.querySelectorAll("[data-count]").forEach(countUp);
    io.unobserve(e.target);
  });
}, { threshold: 0.15 });
document.querySelectorAll(".reveal").forEach(el => io.observe(el));

function countUp(el) {
  const target = +el.dataset.count;
  const start = performance.now();
  const step = t => {
    const p = Math.min((t - start) / 1200, 1);
    el.textContent = Math.round(target * (1 - Math.pow(1 - p, 3)));
    if (p < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

// ---------- card tilt + glow ----------
document.querySelectorAll("[data-tilt]").forEach(card => {
  card.addEventListener("mousemove", e => {
    const r = card.getBoundingClientRect();
    const x = e.clientX - r.left, y = e.clientY - r.top;
    card.style.setProperty("--mx", x + "px");
    card.style.setProperty("--my", y + "px");
    const rx = ((y / r.height) - .5) * -6, ry = ((x / r.width) - .5) * 6;
    card.style.transform = `perspective(800px) rotateX(${rx}deg) rotateY(${ry}deg)`;
  });
  card.addEventListener("mouseleave", () => (card.style.transform = ""));
});

// ---------- background: drifting node grid ----------
const cv = document.getElementById("grid");
const ctx = cv.getContext("2d");
let pts = [], W, H;
function resize() {
  W = cv.width = innerWidth * devicePixelRatio;
  H = cv.height = innerHeight * devicePixelRatio;
  const n = Math.min(70, Math.floor(innerWidth / 18));
  pts = Array.from({ length: n }, () => ({
    x: Math.random() * W, y: Math.random() * H,
    vx: (Math.random() - .5) * .25 * devicePixelRatio, vy: (Math.random() - .5) * .25 * devicePixelRatio,
  }));
}
function draw() {
  ctx.clearRect(0, 0, W, H);
  const max = 140 * devicePixelRatio;
  for (const p of pts) {
    p.x += p.vx; p.y += p.vy;
    if (p.x < 0 || p.x > W) p.vx *= -1;
    if (p.y < 0 || p.y > H) p.vy *= -1;
  }
  for (let i = 0; i < pts.length; i++) {
    for (let j = i + 1; j < pts.length; j++) {
      const a = pts[i], b = pts[j], d = Math.hypot(a.x - b.x, a.y - b.y);
      if (d < max) {
        ctx.strokeStyle = `rgba(0,161,224,${(1 - d / max) * .18})`;
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      }
    }
    ctx.fillStyle = "rgba(124,245,200,.35)";
    ctx.fillRect(pts[i].x, pts[i].y, 2 * devicePixelRatio, 2 * devicePixelRatio);
  }
  if (!matchMedia("(prefers-reduced-motion: reduce)").matches) requestAnimationFrame(draw);
}
addEventListener("resize", resize);
resize(); draw();

// ---------- init ----------
document.getElementById("year").textContent = new Date().getFullYear();
typeTerminal();
