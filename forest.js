"use strict";

/* Random-forest visualization. Needs the optional POST /explain endpoint
   (see README / chat). Real per-tree votes only — nothing here is simulated. */
(() => {
  const F = { ENDPOINT: "/explain", MAX_TREES_SHOWN: 48, BINS: 12, TREE_DELAY: 22, CHIP_DELAY: 55 };
  const $ = (s) => document.querySelector(s);
  const reduced = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const pretty = (k) => k.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());
  const TREE = '<svg viewBox="0 0 24 28" aria-hidden="true"><path d="M12 2 4 14h5l-4 8h14l-4-8h5z" fill="currentColor"/><rect x="11" y="22" width="2" height="5" fill="currentColor"/></svg>';
  let timers = [], observer = null, current = null;

  const later = (fn, ms) => { if (reduced()) fn(); else timers.push(setTimeout(fn, ms)); };
  const clearTimers = () => { timers.forEach(clearTimeout); timers = []; };
  const setNote = (msg) => { const n = $("#forest-note"); n.textContent = msg; n.hidden = !msg; };

  async function renderForest(payload) {
    resetForest();
    const box = $("#forest");
    box.hidden = false;
    setNote("Loading the forest…");
    try {
      const res = await fetch(CONFIG.API_BASE_URL + F.ENDPOINT, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(`/explain responded ${res.status}`);
      const data = await res.json();
      if (!Array.isArray(data.tree_predictions) || !data.tree_predictions.length) throw new Error("No tree predictions");
      current = { payload, data };
      build(current);
      setNote("");
      observer = new IntersectionObserver((e) => { if (e[0].isIntersecting) { observer.disconnect(); play(); } }, { threshold: 0.25 });
      observer.observe($("#forest-inputs"));
    } catch (err) {
      console.error("[Forest]", err);
      setNote("The forest view needs the /explain endpoint on the backend. Your score above is unaffected.");
    }
  }

  function build({ payload, data }) {
    $("#forest-inputs").innerHTML = Object.entries(payload)
      .map(([k, v]) => `<li class="chip"><span>${pretty(k)}</span><strong>${v}</strong></li>`).join("");

    const votes = data.tree_predictions, min = Math.min(...votes), max = Math.max(...votes), span = max - min || 1;
    const step = Math.max(1, Math.floor(votes.length / F.MAX_TREES_SHOWN));
    const shown = votes.filter((_, i) => i % step === 0).slice(0, F.MAX_TREES_SHOWN);
    $("#forest-trees").innerHTML = shown
      .map((v) => `<li class="tree" style="--t:${((v - min) / span).toFixed(2)}">${TREE}<span>${v.toFixed(2)}</span></li>`).join("");
    $("#forest-count").textContent = `Showing ${shown.length} of ${votes.length} trees`;

    // histogram of every tree's vote
    const counts = Array(F.BINS).fill(0);
    votes.forEach((v) => counts[Math.min(F.BINS - 1, Math.floor(((v - min) / span) * F.BINS))]++);
    const peak = Math.max(...counts), w = 300 / F.BINS;
    const mean = data.mean ?? votes.reduce((a, b) => a + b, 0) / votes.length;
    const mx = 10 + ((mean - min) / span) * 300;
    $("#forest-hist").innerHTML =
      counts.map((c, i) => `<rect class="bar-h" x="${10 + i * w + 1}" y="${110 - (c / peak) * 100}" width="${w - 2}" height="${(c / peak) * 100}" rx="2"/>`).join("") +
      `<line class="mean-line" x1="${mx}" x2="${mx}" y1="2" y2="110"/><line class="axis" x1="10" x2="310" y1="110" y2="110"/>` +
      `<text x="10" y="126">${min.toFixed(2)}</text><text x="310" y="126" text-anchor="end">${max.toFixed(2)}</text>`;
    $("#forest-mean").textContent = "0.00";
    $("#forest-summary").textContent = `Individual trees disagreed, ranging from ${min.toFixed(2)} to ${max.toFixed(2)}. Their average is the score returned by the API.`;
    $("#forest").classList.remove("played");
  }

  function play() {
    if (!current) return;
    clearTimers();
    const box = $("#forest");
    box.classList.remove("played");
    const chips = [...document.querySelectorAll(".chip")], trees = [...document.querySelectorAll(".tree")];
    [...chips, ...trees].forEach((n) => n.classList.remove("on"));
    $("#forest-mean").textContent = "0.00";
    chips.forEach((c, i) => later(() => c.classList.add("on"), i * F.CHIP_DELAY));
    const t0 = chips.length * F.CHIP_DELAY + 300;
    trees.forEach((t, i) => later(() => t.classList.add("on"), t0 + i * F.TREE_DELAY));
    const t1 = t0 + trees.length * F.TREE_DELAY + 300;
    later(() => { box.classList.add("played"); countUp(current.data.mean); }, t1);
  }

  function countUp(target) {
    const el = $("#forest-mean");
    if (reduced()) { el.textContent = Number(target).toFixed(2); return; }
    const start = performance.now(), dur = 1200;
    const tick = (now) => {
      const t = Math.min((now - start) / dur, 1);
      el.textContent = (target * (1 - Math.pow(1 - t, 3))).toFixed(2);
      if (t < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  function resetForest() {
    clearTimers();
    if (observer) observer.disconnect();
    current = null;
    $("#forest").hidden = true;
    $("#forest").classList.remove("played");
    ["#forest-inputs", "#forest-trees", "#forest-hist"].forEach((s) => ($(s).innerHTML = ""));
    setNote("");
  }

  document.addEventListener("DOMContentLoaded", () => $("#forest-replay").addEventListener("click", play));
  window.renderForest = renderForest;
  window.resetForest = resetForest;
})();
