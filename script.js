"use strict";

/* =====================================================================
   CONFIG — the only place you need to edit for URL / branding / scale
   ===================================================================== */
const CONFIG = {
  BRAND: "MindPath",
  API_BASE_URL: "https://mental-health-score-prediction-u5t3.onrender.com",
  PREDICT_ENDPOINT: "/predict",
  SCORE_MAX: 10,          // Scale used to draw the ring. Backend returns a bare float, so set this to your model's scale.
  SCORE_DECIMALS: 2,
  MIN_LOADING_MS: 900,
};

/* =====================================================================
   FORM SCHEMA — mirrors the FastAPI `StudentData` Pydantic model exactly.
   `name` is the JSON key sent to the API. No other keys are ever sent.
   ===================================================================== */
const COUNTRIES = ["Afghanistan", "Argentina", "Australia", "Austria", "Bangladesh", "Belgium", "Brazil", "Canada", "China", "Denmark", "Egypt", "France", "Germany", "India", "Indonesia", "Italy", "Japan", "Mexico", "Netherlands", "Nigeria", "Pakistan", "Russia", "Singapore", "South Korea", "Spain", "Sweden", "Switzerland", "Turkey", "UK", "USA"];

const SCHEMA = [
  { title: "About you", note: "A little background helps the model put your answers in context.", fields: [
    { name: "age", label: "Age", type: "int", min: 10, max: 100, hint: "Between 10 and 100." },
    { name: "gender", label: "Gender", type: "radio", options: ["Male", "Female"] },
    { name: "country", label: "Country", type: "select", options: COUNTRIES },
    { name: "academic_level", label: "Academic level", type: "select", options: ["High School", "Undergraduate", "Graduate"] },
  ]},
  { title: "Social media", note: "How you use social platforms day to day.", fields: [
    { name: "most_used_platform", label: "Most used platform", type: "select", options: ["Facebook", "Instagram", "KakaoTalk", "LINE", "LinkedIn", "Snapchat", "TikTok", "Twitter", "VKontakte", "WeChat", "WhatsApp", "YouTube"] },
    { name: "purpose_of_use", label: "Main purpose of use", type: "radio", options: ["Networking", "Education", "Entertainment", "News"] },
    { name: "avg_daily_usage_hours", label: "Average daily usage (hours)", type: "float", min: 0, max: 24, hint: "0 to 24 hours." },
    { name: "daily_unlocks", label: "Daily phone unlocks", type: "int", min: 0, hint: "Roughly how many times you unlock your phone in a day." },
  ]},
  { title: "Daily life", note: "Your routine and how you feel about it.", fields: [
    { name: "study_hours", label: "Study hours per day", type: "float", min: 0, max: 24, hint: "0 to 24 hours." },
    { name: "physical_activity_hours", label: "Physical activity hours per day", type: "float", min: 0, max: 24, hint: "0 to 24 hours." },
    { name: "sleep_hours_per_night", label: "Sleep hours per night", type: "float", min: 0, max: 24, hint: "0 to 24 hours." },
    { name: "stress_level", label: "Stress level", type: "radio", options: ["Low", "Medium", "High", "Very High"] },
  ]},
];

const FIELDS = SCHEMA.flatMap((g) => g.fields);
const $ = (s) => document.querySelector(s);
const state = { busy: false, raf: 0 };
const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

class ApiError extends Error {
  constructor(status, body) { super(`API responded with ${status}`); this.status = status; this.body = body; }
}

/* ---------------------------------------------------------------------
   Init & form rendering
   --------------------------------------------------------------------- */
function initializeApp() {
  document.querySelectorAll("[data-brand]").forEach((n) => (n.textContent = CONFIG.BRAND));
  document.title = `${CONFIG.BRAND} — Mental Health Assessment`;
  $("#score-max").textContent = CONFIG.SCORE_MAX;
  initializeNav();
  initializeForm();
}

function initializeNav() {
  const toggle = $(".nav-toggle"), links = $("#nav-links");
  const set = (open) => { links.classList.toggle("open", open); toggle.setAttribute("aria-expanded", open); };
  toggle.addEventListener("click", () => set(!links.classList.contains("open")));
  links.addEventListener("click", (e) => { if (e.target.closest("a")) set(false); });
}

function fieldHTML(f) {
  const id = `f-${f.name}`;
  const desc = [f.hint && `${id}-hint`, `${id}-error`].filter(Boolean).join(" ");
  const hint = f.hint ? `<p class="hint" id="${id}-hint">${f.hint}</p>` : "";
  const err = `<p class="error" id="${id}-error"></p>`;
  if (f.type === "radio") {
    const items = f.options.map((o, i) => `<label class="choice"><input type="radio" id="${id}-${i}" name="${f.name}" value="${o}" required aria-describedby="${desc}"><span>${o}</span></label>`).join("");
    return `<fieldset class="field wide" data-field="${f.name}"><legend>${f.label}</legend><div class="choices">${items}</div>${err}</fieldset>`;
  }
  if (f.type === "select") {
    const opts = f.options.map((o) => `<option value="${o}">${o}</option>`).join("");
    return `<div class="field" data-field="${f.name}"><label for="${id}">${f.label}</label><select id="${id}" name="${f.name}" required aria-describedby="${desc}"><option value="">Select…</option>${opts}</select>${err}</div>`;
  }
  const step = f.type === "int" ? 1 : 0.1;
  const min = f.min != null ? `min="${f.min}"` : "", max = f.max != null ? `max="${f.max}"` : "";
  return `<div class="field" data-field="${f.name}"><label for="${id}">${f.label}</label><input type="number" id="${id}" name="${f.name}" inputmode="${f.type === "int" ? "numeric" : "decimal"}" ${min} ${max} step="${step}" autocomplete="off" required aria-describedby="${desc}">${hint}${err}</div>`;
}

function initializeForm() {
  $("#form-fields").innerHTML = SCHEMA.map((g) =>
    `<fieldset class="group"><legend>${g.title}</legend><p class="group-note">${g.note}</p><div class="group-fields">${g.fields.map(fieldHTML).join("")}</div></fieldset>`).join("");
  $("#progress-total").textContent = String(FIELDS.length).padStart(2, "0");

  const form = $("#assessment-form");
  const byName = (t) => FIELDS.find((f) => f.name === t.name);
  form.addEventListener("focusout", (e) => { const f = byName(e.target); if (f && f.type !== "radio") validateField(f); });
  form.addEventListener("change", (e) => { const f = byName(e.target); if (f) validateField(f); updateProgress(); });
  form.addEventListener("input", (e) => {
    const f = byName(e.target); if (!f) return;
    if (e.target.getAttribute("aria-invalid") === "true") validateField(f);
    updateProgress();
  });
  form.addEventListener("submit", submitAssessment);
  $("#retake-btn").addEventListener("click", resetAssessment);
  updateProgress();
}

/* ---------------------------------------------------------------------
   Validation (matches Pydantic constraints)
   --------------------------------------------------------------------- */
const rawValue = (f) => String($("#assessment-form").elements[f.name].value ?? "").trim();

function getError(f) {
  const v = rawValue(f);
  if (v === "") return "Please answer this question.";
  if (f.type === "radio" || f.type === "select") return f.options.includes(v) ? "" : "Please choose one of the listed options.";
  const n = Number(v);
  if (!Number.isFinite(n)) return "Please enter a valid number.";
  if (f.type === "int" && !Number.isInteger(n)) return "Please enter a whole number.";
  if ((f.min != null && n < f.min) || (f.max != null && n > f.max))
    return f.max != null ? `Please enter a value between ${f.min} and ${f.max}.` : `Please enter ${f.min} or more.`;
  return "";
}

function setFieldError(f, message) {
  const wrap = document.querySelector(`[data-field="${f.name}"]`);
  wrap.querySelector(".error").textContent = message;
  wrap.classList.toggle("invalid", !!message);
  wrap.querySelectorAll("input, select").forEach((c) => (message ? c.setAttribute("aria-invalid", "true") : c.removeAttribute("aria-invalid")));
}

function validateField(f) { const m = getError(f); setFieldError(f, m); return !m; }

function validateForm() {
  const bad = FIELDS.filter((f) => !validateField(f));
  if (bad.length) {
    const first = $("#assessment-form").elements[bad[0].name];
    (first.focus ? first : first[0]).focus();
  }
  return bad.length === 0;
}

/* ---------------------------------------------------------------------
   Data collection — payload keys === Pydantic field names
   --------------------------------------------------------------------- */
function collectFormData() {
  return Object.fromEntries(FIELDS.map((f) => [f.name, rawValue(f)]));
}

function transformFormData(raw) {
  // Explicit mapping layer: only schema fields, converted to the types Pydantic expects.
  return Object.fromEntries(FIELDS.map((f) => [f.name, f.type === "int" || f.type === "float" ? Number(raw[f.name]) : raw[f.name]]));
}

function updateProgress() {
  const done = FIELDS.filter((f) => rawValue(f) !== "").length;
  const pct = Math.round((done / FIELDS.length) * 100);
  $("#progress-count").textContent = String(done).padStart(2, "0");
  $("#progress-fill").style.width = pct + "%";
  $(".bar").setAttribute("aria-valuenow", pct);
}

/* ---------------------------------------------------------------------
   API integration
   --------------------------------------------------------------------- */
async function submitAssessment(e) {
  e.preventDefault();
  if (state.busy) return;
  hideAlert();
  if (!validateForm()) return;

  const payload = transformFormData(collectFormData());
  showLoading(true);
  try {
    // ---- API CALL: POST {API_BASE_URL}{PREDICT_ENDPOINT} ----
    const [res] = await Promise.all([
      fetch(CONFIG.API_BASE_URL + CONFIG.PREDICT_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(payload),
      }),
      sleep(CONFIG.MIN_LOADING_MS),
    ]);
    if (!res.ok) throw new ApiError(res.status, await res.json().catch(() => null));
    const result = normalizePredictionResponse(await res.json());
    showLoading(false);
    renderPrediction(result, payload);
    window.renderForest?.(payload); // optional: needs /explain endpoint
  } catch (err) {
    console.error("[Assessment] request failed:", err, err.body || "");
    showLoading(false);
    handleError(err);
  }
}

// API RESPONSE  ->  UI RESULT OBJECT
// FastAPI returns: { "predicted_mental_health_score": <float> }
function normalizePredictionResponse(json) {
  const score = Number(json?.predicted_mental_health_score);
  if (!Number.isFinite(score)) throw new Error("Unexpected response shape");
  const max = CONFIG.SCORE_MAX;
  return { score, max, display: score.toFixed(CONFIG.SCORE_DECIMALS), fraction: Math.min(Math.max(score / max, 0), 1) };
}

function handleError(err) {
  if (err instanceof ApiError) {
    if (err.status === 400 || err.status === 422) {
      const items = Array.isArray(err.body?.detail) ? err.body.detail : [];
      items.forEach((d) => { const f = FIELDS.find((x) => x.name === d.loc?.[d.loc.length - 1]); if (f) setFieldError(f, d.msg || "Please check this answer."); });
      return showError("Some responses could not be processed. Please review the highlighted fields.");
    }
    if (err.status >= 500) return showError("The assessment service encountered an error. Please try again.");
    return showError("Unable to reach the server.");
  }
  if (err instanceof TypeError) return showError("We couldn't connect to the assessment service. Please make sure the FastAPI server is running.");
  showError("The assessment service returned an unexpected response. Please try again.");
}

/* ---------------------------------------------------------------------
   UI state
   --------------------------------------------------------------------- */
function showLoading(on) {
  state.busy = on;
  const btn = $("#submit-btn");
  btn.disabled = on;
  btn.textContent = on ? "Analyzing…" : "Analyze My Responses";
  $("#assessment-form").setAttribute("aria-busy", on);
  const sec = $("#analysis");
  sec.hidden = !on;
  if (on) { $("#result").hidden = true; sec.scrollIntoView({ behavior: reducedMotion() ? "auto" : "smooth", block: "center" }); }
}

function showError(msg) {
  const box = $("#form-alert");
  box.textContent = msg; box.hidden = false;
  box.scrollIntoView({ behavior: reducedMotion() ? "auto" : "smooth", block: "center" });
}
function hideAlert() { $("#form-alert").hidden = true; }

function renderPrediction(r, payload) {
  $("#detail-score").textContent = `${r.display} / ${r.max}`;
  $("#detail-count").textContent = `${Object.keys(payload).length} of ${FIELDS.length}`;
  $("#meaning-text").textContent =
    `The assessment model returned a score of ${r.display} on a ${r.max}-point scale for the answers you provided. ` +
    `This figure reflects patterns the model learned from survey data about students' daily habits and social media use. ` +
    `It is an estimate based on limited information, not a measurement of your wellbeing, and it does not describe a diagnosis or severity.`;
  const sec = $("#result");
  sec.hidden = false;
  sec.classList.remove("fade-in"); void sec.offsetWidth; sec.classList.add("fade-in");
  sec.scrollIntoView({ behavior: reducedMotion() ? "auto" : "smooth", block: "start" });
  sec.focus({ preventScroll: true });
  animateScore(r);
}

function animateScore(r) {
  const ring = $("#ring-progress"), num = $("#score-value");
  const C = 2 * Math.PI * 90;
  ring.style.strokeDasharray = C;
  const paint = (p) => {
    ring.style.strokeDashoffset = C * (1 - r.fraction * p);
    num.textContent = (r.score * p).toFixed(CONFIG.SCORE_DECIMALS);
  };
  cancelAnimationFrame(state.raf);
  paint(0);
  if (reducedMotion()) return paint(1);
  const start = performance.now() + 350, dur = 1800; // brief pause so the reveal lands first
  const tick = (now) => {
    const t = Math.min(Math.max((now - start) / dur, 0), 1);
    paint(1 - Math.pow(1 - t, 3));
    if (t < 1) state.raf = requestAnimationFrame(tick);
  };
  state.raf = requestAnimationFrame(tick);
}

function resetAssessment() {
  cancelAnimationFrame(state.raf);
  window.resetForest?.();
  $("#assessment-form").reset();
  FIELDS.forEach((f) => setFieldError(f, ""));
  hideAlert();
  $("#result").hidden = true;
  $("#analysis").hidden = true;
  animateScore({ score: 0, fraction: 0 });
  updateProgress();
  $("#assessment").scrollIntoView({ behavior: reducedMotion() ? "auto" : "smooth" });
}

document.addEventListener("DOMContentLoaded", initializeApp);
