/* VERITY — signal processing
 * Text features, deception scoring, MediaPipe face, rPPG HR, Web Audio voice.
 * All modules support both REAL and SIMULATED modes with the same shape.
 */

// ════════════════════════════════════════════════════════
// TEXT FEATURES — port of extract_text_features from mv1.py
// ════════════════════════════════════════════════════════

window.extractTextFeatures = function (text) {
  const L = window.VERITY_LEXICONS;
  const tl = (text || "").toLowerCase();
  const words = tl.split(/\s+/).filter((w) => w.length > 0);
  const sentences = (text || "")
    .split(/[.!?]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  const nWords = words.length;

  const count = (list) => list.reduce((acc, w) => acc + (tl.includes(w) ? 1 : 0), 0);
  const hedgeCount = count(L.HEDGES);
  const intensCount = count(L.INTENSIFIERS);
  const denialCount = count(L.DENIALS);
  const distCount = count(L.DISTANCERS);
  const hesitCount = (L.HESITATIONS || []).reduce(
    (acc, w) => acc + (tl.match(new RegExp(`\\b${w.replace(/[.,…]/g, "")}\\b`, "g")) || []).length,
    0,
  );
  const reformCount = (L.REFORMULATIONS || []).reduce(
    (acc, w) => acc + (tl.includes(w) ? 1 : 0),
    0,
  );
  const specHits = (L.SPECIFICITY || []).reduce((acc, w) => acc + (tl.includes(w) ? 1 : 0), 0);
  const fpCount = (tl.match(/\b(i|my|me|mine|myself)\b/g) || []).length;
  const pos = count(L.POSITIVE);
  const neg = count(L.NEGATIVE);

  const r = (n, d) => (d > 0 ? n / d : 0);
  const uniqueWords = new Set(words).size;

  return {
    n_words: nWords,
    n_sentences: Math.max(sentences.length, 1),
    avg_word_len: words.length ? words.reduce((a, w) => a + w.length, 0) / words.length : 0,
    avg_sentence_len: nWords / Math.max(sentences.length, 1),
    hedge_count: hedgeCount,
    hedge_ratio: r(hedgeCount, nWords),
    denial_count: denialCount,
    denial_ratio: r(denialCount, nWords),
    distancing_ratio: r(distCount, nWords),
    first_person_ratio: r(fpCount, nWords),
    n_questions: (text || "").split("?").length - 1,
    n_exclamations: (text || "").split("!").length - 1,
    repetition_ratio: nWords ? 1 - uniqueWords / nWords : 0,
    specificity_score: Math.max(0, (hedgeCount - intensCount + 3) / 6 + specHits * 0.06),
    sentiment_ratio: (pos - neg) / (pos + neg + 1),
    // ── New features (Vrij 2008 deception cues) ──
    hesitation_count: hesitCount,
    hesitation_ratio: r(hesitCount, nWords),
    reformulation_count: reformCount,
    specificity_hits: specHits,
  };
};

// ════════════════════════════════════════════════════════
// DECEPTION SCORING
// Ported + adapted from mv1.py's recalibrated_score
// ════════════════════════════════════════════════════════

window.computeDeceptionScore = function (textFeats, physFeats) {
  // Step 1: physiological contribution — for each feature, how close to deceptive vs truthful baseline
  const B = window.VERITY_BASELINES;
  const I = window.VERITY_IMPORTANCES;
  const INV = window.VERITY_INVERSE_FEATURES;

  let physScore = 0;
  let physWeight = 0;
  const breakdown = [];

  for (const [feat, b] of Object.entries(B)) {
    const observed = physFeats[feat];
    if (observed == null || !isFinite(observed)) continue;
    // map to 0..1 between truth baseline and decep baseline
    let raw = (observed - b.truth) / (b.decep - b.truth);
    raw = Math.max(0, Math.min(1, raw));
    // some features are inverse — higher = truthful
    const contrib = INV.has(feat) ? 1 - raw : raw;
    const w = I[feat] || 0.05;
    physScore += contrib * w;
    physWeight += w;
    breakdown.push({ feat, observed, contrib, w });
  }
  const physDecep = physWeight > 0 ? physScore / physWeight : 0.5;

  // Step 2: text rule-based score
  const R = window.VERITY_RULES;
  let ruleHits = 0;
  let ruleTotal = 0;
  const ruleFired = [];
  for (const [feat, rule] of Object.entries(R)) {
    const v = textFeats[feat];
    if (v == null) continue;
    const fired = (rule.dir === "high" && v > rule.thr) || (rule.dir === "low" && v < rule.thr);
    if (fired) {
      ruleHits += rule.w;
      ruleFired.push(feat);
    }
    ruleTotal += rule.w;
  }
  const ruleDecep = ruleTotal > 0 ? ruleHits / ruleTotal : 0.5;

  // Step 3: blend 55/45 like the original pipeline; amplify extremes (>0.58 → 0.97; <0.42 → 0.03)
  let blended = 0.55 * physDecep + 0.45 * ruleDecep;
  if (blended > 0.58) blended = Math.min(0.97, blended * 1.25);
  else if (blended < 0.42) blended = Math.max(0.03, blended * 0.75);

  return {
    decep: blended,
    truth: 1 - blended,
    physDecep,
    ruleDecep,
    breakdown,
    ruleFired,
  };
};

// ════════════════════════════════════════════════════════
// SIGNAL FROM TEXT — interpretive "signals" for the UI
// Mirrors the truthful/deceptive signal logic in mv1.py
// ════════════════════════════════════════════════════════

window.deriveTextSignals = function (textFeats) {
  const out = [];
  if (textFeats.n_words > 0 && textFeats.n_words < 8)
    out.push({ kind: "warn", msg: "Unusually short response" });
  if (textFeats.denial_count > 3) out.push({ kind: "warn", msg: "Over-denial detected" });
  if (textFeats.repetition_ratio > 0.15) out.push({ kind: "warn", msg: "Heavy word repetition" });
  if (textFeats.specificity_score < 0.25 && textFeats.n_words > 5)
    out.push({ kind: "warn", msg: "Vague, low-specificity response" });
  if (textFeats.n_exclamations > 1) out.push({ kind: "warn", msg: "Emotional overstatement" });
  if (textFeats.first_person_ratio > 0.25)
    out.push({ kind: "warn", msg: "Over-justification pattern" });
  if (textFeats.distancing_ratio > 0.1)
    out.push({ kind: "warn", msg: "Distancing language (they/it/someone)" });
  if (textFeats.hedge_count >= 2) out.push({ kind: "ok", msg: "Natural hedging language" });
  if (textFeats.specificity_score > 0.45)
    out.push({ kind: "ok", msg: "Concrete, specific detail" });
  if (textFeats.first_person_ratio >= 0.05 && textFeats.first_person_ratio <= 0.2)
    out.push({ kind: "ok", msg: "Balanced self-reference" });
  if (textFeats.denial_count <= 1 && textFeats.n_exclamations === 0 && textFeats.n_words > 12)
    out.push({ kind: "ok", msg: "Calm, measured delivery" });
  return out;
};

// ════════════════════════════════════════════════════════
// SIMULATED PHYSIOLOGICAL — for fallback/standby mode
// ════════════════════════════════════════════════════════

window.simulatePhysiological = function (truthBias = 0.5, t = 0) {
  // truthBias 0 = pure truth baseline, 1 = pure deceptive baseline
  const B = window.VERITY_BASELINES;
  const out = {};
  for (const [feat, b] of Object.entries(B)) {
    const base = b.truth + (b.decep - b.truth) * truthBias;
    const noise = (Math.sin(t * 0.001 + feat.length) * 0.5 + (Math.random() - 0.5)) * b.noise;
    out[feat] = +(base + noise).toFixed(3);
  }
  return out;
};

// ════════════════════════════════════════════════════════
// BASELINE COLLECTOR — measure the subject's *real* resting values
// during calibration and use them as their personal truthful baseline.
// ════════════════════════════════════════════════════════

window.BaselineCollector = class {
  constructor() {
    this.reset();
  }

  reset() {
    this.samples = {
      hr_mean: [],
      hrv: [],
      au1_inner_brow: [],
      au4_brow_lower: [],
      au7_lid_tighten: [],
      au12_lip_corner: [],
      blink_rate: [],
    };
  }

  add(phys) {
    if (!phys) return;
    for (const k of Object.keys(this.samples)) {
      const v = phys[k];
      if (v != null && isFinite(v)) this.samples[k].push(v);
    }
  }

  // Returns the per-feature mean ONLY if we have enough real samples; otherwise null.
  // For features with no real samples, falls back to the literature truthful baseline.
  compute(minSamples = 30) {
    const B = window.VERITY_BASELINES;
    const out = { _measured: {} };
    for (const k of Object.keys(this.samples)) {
      const arr = this.samples[k];
      if (arr.length >= minSamples) {
        const mean = arr.reduce((a, x) => a + x, 0) / arr.length;
        out[k] = +mean.toFixed(3);
        out._measured[k] = true;
      } else {
        out[k] = B[k] ? B[k].truth : null;
        out._measured[k] = false;
      }
    }
    return out;
  }

  hasRealData(feat) {
    return this.samples[feat] && this.samples[feat].length >= 30;
  }
};

// ════════════════════════════════════════════════════════
// SCORING with personal baseline
// ════════════════════════════════════════════════════════

window.computeDeceptionScoreWithBaseline = function (textFeats, physFeats, personalBaseline) {
  // Same as computeDeceptionScore, but anchors the truth side of each
  // feature scale to the subject's measured baseline. The deception side
  // keeps the literature delta (lit_decep - lit_truth), scaled by sensitivity.
  const B = window.VERITY_BASELINES;
  const I = window.VERITY_IMPORTANCES;
  const INV = window.VERITY_INVERSE_FEATURES;
  const SENS = window.VERITY_SENSITIVITY || 0.4;

  let physScore = 0,
    physWeight = 0;
  const breakdown = [];

  for (const [feat, b] of Object.entries(B)) {
    const observed = physFeats[feat];
    if (observed == null || !isFinite(observed)) continue;

    const personalTruth =
      personalBaseline && personalBaseline[feat] != null ? personalBaseline[feat] : b.truth;
    // Scale the delta so smaller physiological changes register as deception
    const delta = (b.decep - b.truth) * SENS;
    const personalDecep = personalTruth + delta;

    let raw = (observed - personalTruth) / (personalDecep - personalTruth);
    raw = Math.max(0, Math.min(1, raw));
    const contrib = INV.has(feat) ? 1 - raw : raw;
    const w = I[feat] || 0.05;
    physScore += contrib * w;
    physWeight += w;
    breakdown.push({ feat, observed, contrib, w, baseline: personalTruth });
  }
  const physDecep = physWeight > 0 ? physScore / physWeight : 0.5;

  // Text rules
  const R = window.VERITY_RULES;
  let ruleHits = 0,
    ruleTotal = 0;
  const ruleFired = [];
  for (const [feat, rule] of Object.entries(R)) {
    const v = textFeats[feat];
    if (v == null) continue;
    const fired = (rule.dir === "high" && v > rule.thr) || (rule.dir === "low" && v < rule.thr);
    if (fired) {
      ruleHits += rule.w;
      ruleFired.push(feat);
    }
    ruleTotal += rule.w;
  }
  const ruleDecep = ruleTotal > 0 ? ruleHits / ruleTotal : 0.5;

  // Blend: text-leaning (45% phys, 55% text). Body signals during a 30s answer
  // are subtle; word patterns are far more diagnostic.
  let blended = 0.45 * physDecep + 0.55 * ruleDecep;
  // Amplify the extremes slightly so the verdict is decisive when warranted
  if (blended > 0.55) blended = Math.min(0.97, 0.55 + (blended - 0.55) * 1.45);
  else if (blended < 0.45) blended = Math.max(0.03, 0.45 - (0.45 - blended) * 1.35);

  return { decep: blended, truth: 1 - blended, physDecep, ruleDecep, breakdown, ruleFired };
};

// ════════════════════════════════════════════════════════
// RESPONSE SAMPLE COLLECTOR — records physiological signals
// throughout the duration of a single answer (not just the
// snapshot at Submit time). Used to compute averages and
// variability of HR / AUs / blink while the subject responds.
// ════════════════════════════════════════════════════════

window.ResponseCollector = class {
  constructor() {
    this.reset();
  }
  reset() {
    this.samples = [];
    this.startTs = null;
    this.endTs = null;
  }
  start(ts) {
    this.reset();
    this.startTs = ts;
  }
  add(phys, ts) {
    if (!phys || this.startTs == null) return;
    this.samples.push({
      ts,
      hr_mean: phys.hr_mean,
      hrv: phys.hrv,
      au1_inner_brow: phys.au1_inner_brow,
      au4_brow_lower: phys.au4_brow_lower,
      au7_lid_tighten: phys.au7_lid_tighten,
      au12_lip_corner: phys.au12_lip_corner,
      blink_rate: phys.blink_rate,
    });
  }
  stop(ts) {
    this.endTs = ts;
  }
  // Compute mean + std for each feature across the answer window
  summarize() {
    const out = { mean: {}, std: {}, peak: {}, _n: this.samples.length };
    const keys = [
      "hr_mean",
      "hrv",
      "au1_inner_brow",
      "au4_brow_lower",
      "au7_lid_tighten",
      "au12_lip_corner",
      "blink_rate",
    ];
    for (const k of keys) {
      const vals = this.samples.map((s) => s[k]).filter((v) => v != null && isFinite(v));
      if (vals.length < 3) {
        out.mean[k] = null;
        out.std[k] = null;
        out.peak[k] = null;
        continue;
      }
      const mean = vals.reduce((a, x) => a + x, 0) / vals.length;
      let v = 0;
      for (const x of vals) v += (x - mean) ** 2;
      out.mean[k] = mean;
      out.std[k] = Math.sqrt(v / vals.length);
      out.peak[k] = Math.max(...vals);
    }
    return out;
  }
};

// ════════════════════════════════════════════════════════
// rPPG — extract pulse from green channel of forehead ROI
// ════════════════════════════════════════════════════════

window.RppgProcessor = class {
  constructor() {
    this.samples = []; // {t, g}
    this.windowMs = 12000; // 12s rolling window — more data → more stable HR
    this.lastHR = null;
    this.lastHRV = null;
    this.hrHistory = []; // recent HR estimates for smoothing
    this.waveform = new Float32Array(180);
    this.waveIdx = 0;
  }

  pushSample(green, t) {
    this.samples.push({ t, g: green });
    while (this.samples.length > 0 && t - this.samples[0].t > this.windowMs) {
      this.samples.shift();
    }
    // Push detrended sample to ring buffer for display
    if (this.samples.length > 10) {
      const recent = this.samples.slice(-30);
      const mean = recent.reduce((a, s) => a + s.g, 0) / recent.length;
      this.waveform[this.waveIdx] = green - mean;
      this.waveIdx = (this.waveIdx + 1) % this.waveform.length;
    }
  }

  compute() {
    if (this.samples.length < 90) return { hr: this.lastHR, hrv: this.lastHRV, ok: false };

    const N = this.samples.length;
    const t0 = this.samples[0].t;
    const tN = this.samples[N - 1].t;
    const elapsedSec = (tN - t0) / 1000;
    if (elapsedSec < 8) return { hr: this.lastHR, hrv: this.lastHRV, ok: false };

    // ── 1. Detrend with a wide moving average (cancels slow drift)
    const detrended = new Float32Array(N);
    const detrendWin = Math.min(60, Math.floor(N / 3));
    for (let i = 0; i < N; i++) {
      let s = 0,
        c = 0;
      for (let j = Math.max(0, i - detrendWin); j <= Math.min(N - 1, i + detrendWin); j++) {
        s += this.samples[j].g;
        c++;
      }
      detrended[i] = this.samples[i].g - s / c;
    }

    // ── 2. Smooth with a narrow moving average (cancels high-freq noise)
    const smoothed = new Float32Array(N);
    const smoothWin = 2;
    for (let i = 0; i < N; i++) {
      let s = 0,
        c = 0;
      for (let j = Math.max(0, i - smoothWin); j <= Math.min(N - 1, i + smoothWin); j++) {
        s += detrended[j];
        c++;
      }
      smoothed[i] = s / c;
    }

    // ── 3. Compute std dev of smoothed signal → adaptive peak threshold
    let mean = 0;
    for (let i = 0; i < N; i++) mean += smoothed[i];
    mean /= N;
    let variance = 0;
    for (let i = 0; i < N; i++) variance += (smoothed[i] - mean) ** 2;
    const std = Math.sqrt(variance / N);
    // Peak must rise at least 0.5σ above zero — rejects most noise spikes
    const peakThreshold = std * 0.5;
    if (std < 0.05) return { hr: this.lastHR, hrv: this.lastHRV, ok: false }; // no real signal

    // ── 4. Find peaks with refractory period
    const peakTimes = [];
    const minPeakGap = 400; // 400ms → caps HR at 150 bpm (realistic at-rest ceiling)
    for (let i = 2; i < N - 2; i++) {
      const v = smoothed[i];
      const isLocalMax =
        v > smoothed[i - 1] && v > smoothed[i + 1] && v > smoothed[i - 2] && v > smoothed[i + 2];
      if (isLocalMax && v > peakThreshold) {
        const t = this.samples[i].t;
        if (peakTimes.length === 0 || t - peakTimes[peakTimes.length - 1] > minPeakGap) {
          peakTimes.push(t);
        }
      }
    }

    if (peakTimes.length < 5) return { hr: this.lastHR, hrv: this.lastHRV, ok: false };

    // ── 5. Compute RR intervals, reject outliers (>50% deviation from median)
    const intervals = [];
    for (let i = 1; i < peakTimes.length; i++) intervals.push(peakTimes[i] - peakTimes[i - 1]);
    const sorted = [...intervals].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];
    const clean = intervals.filter((rr) => Math.abs(rr - median) < median * 0.5);
    if (clean.length < 4) return { hr: this.lastHR, hrv: this.lastHRV, ok: false };

    const meanRR = clean.reduce((a, x) => a + x, 0) / clean.length;
    let hr = Math.round(60000 / meanRR);

    // ── 6. RMSSD-style HRV
    let sqDiff = 0;
    for (let i = 1; i < clean.length; i++) sqDiff += (clean[i] - clean[i - 1]) ** 2;
    const hrv = Math.round(Math.sqrt(sqDiff / Math.max(1, clean.length - 1)));

    // ── 7. REJECT readings outside plausible at-rest range instead of clamping.
    // Clamping caused values to lock at 50 or 110 when the rPPG signal was noisy.
    // Rejecting keeps the last good value (or null) and waits for cleaner data.
    if (hr < 50 || hr > 110) {
      return { hr: this.lastHR, hrv: this.lastHRV, ok: this.lastHR != null };
    }
    const hrvClamped = Math.max(15, Math.min(90, hrv));

    // ── 8. Smooth HR over recent estimates to avoid jitter
    this.hrHistory.push(hr);
    if (this.hrHistory.length > 5) this.hrHistory.shift();
    const smoothHR = Math.round(this.hrHistory.reduce((a, x) => a + x, 0) / this.hrHistory.length);

    this.lastHR = smoothHR;
    this.lastHRV = hrvClamped;
    return { hr: smoothHR, hrv: hrvClamped, ok: true };
  }
};

// ════════════════════════════════════════════════════════
// FACE — MediaPipe FaceLandmarker wrapper
// Approximates Ekman AUs from 478-point landmark set.
// ════════════════════════════════════════════════════════

window.FaceProcessor = class {
  constructor() {
    this.landmarker = null;
    this.ready = false;
    this.baseline = null;
    this.baselineSamples = [];
    this.blinkState = { closed: false, lastBlink: 0, blinks: [] };
  }

  async init() {
    const VISION_VERSION = "0.10.14";
    const MODEL_URL =
      "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";
    const BUNDLE_URL = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${VISION_VERSION}/vision_bundle.mjs`;
    const WASM_URL = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${VISION_VERSION}/wasm`;

    let vision;
    try {
      // Babel's in-browser transformer rewrites `import()` to `require()` (which
      // doesn't exist in the browser). The Function constructor bypasses that
      // transformation — the string isn't parsed as JS until runtime.
      const dynamicImport = new Function("u", "return import(u)");
      vision = await dynamicImport(BUNDLE_URL);
      console.log("[VERITY] MediaPipe tasks-vision bundle imported");
    } catch (e) {
      console.error("[VERITY] MediaPipe bundle import FAILED:", e);
      this.ready = false;
      this.failReason = "bundle import failed (CDN blocked?)";
      return false;
    }

    const { FaceLandmarker, FilesetResolver } = vision;

    let fileset;
    try {
      fileset = await FilesetResolver.forVisionTasks(WASM_URL);
      console.log("[VERITY] MediaPipe WASM fileset resolved");
    } catch (e) {
      console.error("[VERITY] MediaPipe WASM load FAILED:", e);
      this.ready = false;
      this.failReason = "WASM load failed";
      return false;
    }

    // Try GPU delegate first (faster), fall back to CPU on Safari/older browsers
    const baseOptions = {
      modelAssetPath: MODEL_URL,
      delegate: "GPU",
    };
    const commonOptions = {
      outputFaceBlendshapes: true,
      runningMode: "VIDEO",
      numFaces: 1,
    };

    try {
      this.landmarker = await FaceLandmarker.createFromOptions(fileset, {
        baseOptions,
        ...commonOptions,
      });
      this.delegate = "GPU";
      this.ready = true;
      console.log("[VERITY] FaceLandmarker ready (GPU delegate)");
      return true;
    } catch (gpuErr) {
      console.warn("[VERITY] GPU delegate failed, falling back to CPU:", gpuErr);
      try {
        this.landmarker = await FaceLandmarker.createFromOptions(fileset, {
          baseOptions: { ...baseOptions, delegate: "CPU" },
          ...commonOptions,
        });
        this.delegate = "CPU";
        this.ready = true;
        console.log("[VERITY] FaceLandmarker ready (CPU delegate — slower but Safari-compatible)");
        return true;
      } catch (cpuErr) {
        console.error("[VERITY] FaceLandmarker init failed on both GPU and CPU:", cpuErr);
        this.ready = false;
        this.failReason = "model init failed";
        return false;
      }
    }
  }

  // Returns { au1, au4, au7, au12, blink_rate, landmarks }
  detect(videoEl, ts) {
    if (!this.ready || !videoEl || videoEl.readyState < 2) return null;
    // The video must have non-zero dimensions; Safari sometimes reports readyState>=2 before this
    if (!videoEl.videoWidth || !videoEl.videoHeight) return null;
    // MediaPipe requires strictly monotonic timestamps. Two ticks of the rAF
    // loop can have the same performance.now() value on Safari — bump by 1ms.
    if (this._lastTs != null && ts <= this._lastTs) ts = this._lastTs + 1;
    this._lastTs = ts;
    let result;
    try {
      result = this.landmarker.detectForVideo(videoEl, ts);
    } catch (e) {
      if (!this._loggedDetectErr) {
        console.warn("[VERITY] detectForVideo error:", e);
        this._loggedDetectErr = true;
      }
      return null;
    }

    if (!result || !result.faceLandmarks || result.faceLandmarks.length === 0) return null;

    const lm = result.faceLandmarks[0];
    const bs =
      (result.faceBlendshapes &&
        result.faceBlendshapes[0] &&
        result.faceBlendshapes[0].categories) ||
      [];
    const bsMap = {};
    for (const c of bs) bsMap[c.categoryName] = c.score;

    // Map MediaPipe blendshapes → our AUs (this is the cleanest path)
    // browInnerUp ≈ AU1 (Inner Brow Raiser)
    // browDownLeft/Right ≈ AU4 (Brow Lowerer)
    // eyeSquintLeft/Right ≈ AU7 (Lid Tightener)
    // mouthSmileLeft/Right ≈ AU12 (Lip Corner Puller)
    const au1 = bsMap.browInnerUp || 0;
    const au4 = ((bsMap.browDownLeft || 0) + (bsMap.browDownRight || 0)) / 2;
    const au7 = ((bsMap.eyeSquintLeft || 0) + (bsMap.eyeSquintRight || 0)) / 2;
    const au12 = ((bsMap.mouthSmileLeft || 0) + (bsMap.mouthSmileRight || 0)) / 2;

    // Blink — use eyeBlinkLeft/Right
    const blinkL = bsMap.eyeBlinkLeft || 0;
    const blinkR = bsMap.eyeBlinkRight || 0;
    const blinkMean = (blinkL + blinkR) / 2;
    const closed = blinkMean > 0.55;
    if (closed && !this.blinkState.closed && ts - this.blinkState.lastBlink > 250) {
      this.blinkState.blinks.push(ts);
      this.blinkState.lastBlink = ts;
    }
    this.blinkState.closed = closed;
    // Trim blink history to last 60s
    this.blinkState.blinks = this.blinkState.blinks.filter((t) => ts - t < 60000);
    const blinkRate = this.blinkState.blinks.length; // blinks/min

    // Forehead ROI for rPPG (return landmark pixel coords)
    const forehead = lm[10]; // point above brow ridge

    return {
      au1_inner_brow: +au1.toFixed(3),
      au4_brow_lower: +au4.toFixed(3),
      au7_lid_tighten: +au7.toFixed(3),
      au12_lip_corner: +au12.toFixed(3),
      blink_rate: blinkRate,
      forehead,
      landmarks: lm,
    };
  }
};

// ════════════════════════════════════════════════════════
// VOICE — Web Audio waveform + cadence
// ════════════════════════════════════════════════════════

window.VoiceProcessor = class {
  constructor() {
    this.audioCtx = null;
    this.analyser = null;
    this.source = null;
    this.stream = null;
    this.waveform = new Float32Array(256);
    this.envelope = new Float32Array(180);
    this.envIdx = 0;
    this.speakingFrames = 0;
    this.totalFrames = 0;
    this.lastVoice = 0;
    this.voicedFrames = 0;
    this.pauseFrames = 0;
    this.cadence = 0;
  }

  async init(stream) {
    try {
      this.stream = stream;
      this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      // Chrome blocks audio context creation until a user gesture; resume() ensures it actually starts
      if (this.audioCtx.state === "suspended") {
        try {
          await this.audioCtx.resume();
        } catch (e) {}
      }
      this.source = this.audioCtx.createMediaStreamSource(stream);
      this.analyser = this.audioCtx.createAnalyser();
      this.analyser.fftSize = 1024;
      this.analyser.smoothingTimeConstant = 0.4;
      this.source.connect(this.analyser);
      // Confirm at least one audio track is active
      const tracks = stream.getAudioTracks();
      this.hasAudio = tracks.length > 0 && tracks[0].enabled && !tracks[0].muted;
      console.log("[VERITY] Voice init OK", { state: this.audioCtx.state, tracks: tracks.length });
      return true;
    } catch (e) {
      console.warn("[VERITY] Voice init failed:", e);
      return false;
    }
  }

  tick(ts) {
    if (!this.analyser) return null;
    const buf = new Float32Array(this.analyser.fftSize);
    this.analyser.getFloatTimeDomainData(buf);
    // copy a downsampled view to display waveform
    const step = Math.floor(buf.length / this.waveform.length);
    for (let i = 0; i < this.waveform.length; i++) this.waveform[i] = buf[i * step];

    // RMS
    let sum = 0;
    for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
    const rms = Math.sqrt(sum / buf.length);
    this.envelope[this.envIdx] = rms;
    this.envIdx = (this.envIdx + 1) % this.envelope.length;

    const isVoiced = rms > 0.015;
    this.totalFrames++;
    if (isVoiced) {
      this.voicedFrames++;
      this.lastVoice = ts;
    } else this.pauseFrames++;

    return {
      rms,
      voiced: isVoiced,
      voicedRatio: this.totalFrames ? this.voicedFrames / this.totalFrames : 0,
      pauseRatio: this.totalFrames ? this.pauseFrames / this.totalFrames : 0,
    };
  }

  reset() {
    this.totalFrames = 0;
    this.voicedFrames = 0;
    this.pauseFrames = 0;
  }
};

// ════════════════════════════════════════════════════════
// SPEECH — Unified speech-to-text with two backends
//   - Web Speech API (Chrome/Edge): live streaming transcript
//   - Whisper via transformers.js (Safari/Firefox/all): record → transcribe on stop
// ════════════════════════════════════════════════════════

window.SpeechProcessor = class {
  constructor(onTranscript, onStatus) {
    this.onTranscript = onTranscript;
    this.onStatus = onStatus || (() => {});
    this.rec = null;
    this.supported = false;
    this.backend = "none"; // "webspeech" | "whisper" | "none"
    this.active = false;
    this.interim = "";
    this.finals = "";

    // ── Backend 1: Web Speech API ──
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SR) {
      this.rec = new SR();
      this.rec.continuous = true;
      this.rec.interimResults = true;
      this.rec.lang = "en-US";
      this.rec.onresult = (e) => {
        let interim = "",
          final = this.finals;
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const t = e.results[i][0].transcript;
          if (e.results[i].isFinal) final += t + " ";
          else interim += t;
        }
        this.finals = final;
        this.interim = interim;
        if (this.onTranscript) this.onTranscript(this.finals + this.interim);
      };
      this.rec.onerror = (e) => console.warn("[VERITY] Speech error:", e.error);
      this.rec.onend = () => {
        if (this.active) {
          try {
            this.rec.start();
          } catch (e) {}
        }
      };
      this.supported = true;
      this.backend = "webspeech";
      this.onStatus({ backend: "webspeech", state: "ready" });
      console.log("[VERITY] Speech: Web Speech API ready");
    }

    // ── Backend 2: Whisper (fallback for Safari/Firefox) ──
    if (!this.supported) {
      // Defer until user clicks mic — saves the ~40MB download until needed
      this.backend = "whisper";
      this.supported = true; // assume so, we'll load on first start()
      this.whisperPipeline = null;
      this.whisperLoading = false;
      this.mediaRecorder = null;
      this.recordedChunks = [];
      this.stream = null;
      this.onStatus({ backend: "whisper", state: "idle" });
      console.log("[VERITY] Speech: Whisper backend (will load on first use)");
    }
  }

  setStream(stream) {
    this.stream = stream;
  }

  async _loadWhisper() {
    if (this.whisperPipeline || this.whisperLoading) return;
    this.whisperLoading = true;
    this.onStatus({ backend: "whisper", state: "loading", progress: 0 });
    try {
      // Bypass Babel's `import() → require()` transform by constructing the import
      // at runtime via the Function constructor (string isn't parsed until called).
      const dynamicImport = new Function("u", "return import(u)");
      const tf = await dynamicImport("https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2");
      tf.env.allowLocalModels = false;
      tf.env.useBrowserCache = true;
      this.whisperPipeline = await tf.pipeline(
        "automatic-speech-recognition",
        "Xenova/whisper-tiny.en",
        {
          progress_callback: (p) => {
            if (p && p.status === "progress") {
              this.onStatus({
                backend: "whisper",
                state: "loading",
                progress: (p.progress || 0) / 100,
                file: p.file,
              });
            }
          },
        },
      );
      this.whisperLoading = false;
      this.onStatus({ backend: "whisper", state: "ready" });
      console.log("[VERITY] Whisper model loaded");
    } catch (e) {
      console.warn("[VERITY] Whisper load failed:", e);
      this.whisperLoading = false;
      this.supported = false;
      this.onStatus({ backend: "whisper", state: "failed", error: e.message });
    }
  }

  async start() {
    if (this.backend === "webspeech") {
      this.active = true;
      try {
        this.rec.start();
      } catch (e) {}
      this.onStatus({ backend: "webspeech", state: "listening" });
      return true;
    }
    if (this.backend === "whisper") {
      // Load model first time
      if (!this.whisperPipeline) await this._loadWhisper();
      if (!this.whisperPipeline || !this.stream) return false;

      this.recordedChunks = [];
      const mimeType = MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : MediaRecorder.isTypeSupported("audio/mp4")
          ? "audio/mp4"
          : "";
      try {
        this.mediaRecorder = new MediaRecorder(this.stream, mimeType ? { mimeType } : {});
      } catch (e) {
        console.warn("[VERITY] MediaRecorder init failed:", e);
        this.onStatus({ backend: "whisper", state: "failed", error: "MediaRecorder unavailable" });
        return false;
      }

      this.mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) this.recordedChunks.push(e.data);
      };
      this.mediaRecorder.onstop = async () => {
        if (this.recordedChunks.length === 0) return;
        this.onStatus({ backend: "whisper", state: "transcribing" });
        const blob = new Blob(this.recordedChunks, {
          type: this.mediaRecorder.mimeType || "audio/webm",
        });
        try {
          const audioBuffer = await this._blobToAudio(blob);
          const result = await this.whisperPipeline(audioBuffer, {
            chunk_length_s: 30,
            stride_length_s: 5,
          });
          const text = (result && result.text ? result.text : "").trim();
          this.finals = text + " ";
          if (this.onTranscript) this.onTranscript(this.finals);
          this.onStatus({ backend: "whisper", state: "ready" });
        } catch (e) {
          console.warn("[VERITY] Whisper transcribe failed:", e);
          this.onStatus({ backend: "whisper", state: "failed", error: e.message });
        }
      };

      this.active = true;
      try {
        this.mediaRecorder.start();
      } catch (e) {}
      this.onStatus({ backend: "whisper", state: "recording" });
      return true;
    }
    return false;
  }

  async _blobToAudio(blob) {
    const arrayBuf = await blob.arrayBuffer();
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });
    const audioBuf = await audioCtx.decodeAudioData(arrayBuf);
    // Mix to mono
    let mono;
    if (audioBuf.numberOfChannels === 1) mono = audioBuf.getChannelData(0);
    else {
      const L = audioBuf.getChannelData(0),
        R = audioBuf.getChannelData(1);
      mono = new Float32Array(L.length);
      for (let i = 0; i < L.length; i++) mono[i] = (L[i] + R[i]) / 2;
    }
    // Whisper expects 16kHz. If sample rate is different, resample with a simple linear approach.
    if (audioBuf.sampleRate === 16000) return mono;
    const ratio = 16000 / audioBuf.sampleRate;
    const newLen = Math.round(mono.length * ratio);
    const out = new Float32Array(newLen);
    for (let i = 0; i < newLen; i++) {
      const idx = i / ratio;
      const i0 = Math.floor(idx),
        i1 = Math.min(mono.length - 1, i0 + 1);
      const frac = idx - i0;
      out[i] = mono[i0] * (1 - frac) + mono[i1] * frac;
    }
    return out;
  }

  stop() {
    this.active = false;
    if (this.backend === "webspeech" && this.rec) {
      try {
        this.rec.stop();
      } catch (e) {}
      this.onStatus({ backend: "webspeech", state: "ready" });
    }
    if (
      this.backend === "whisper" &&
      this.mediaRecorder &&
      this.mediaRecorder.state === "recording"
    ) {
      try {
        this.mediaRecorder.stop();
      } catch (e) {}
    }
  }

  clear() {
    this.finals = "";
    this.interim = "";
  }

  text() {
    return this.finals + this.interim;
  }
};

// ════════════════════════════════════════════════════════
// WHISPER — local browser ASR via transformers.js
// Multi-language, works in ALL browsers (Safari, Firefox, etc.)
// First use downloads ~40MB Whisper-tiny model, then cached.
// ════════════════════════════════════════════════════════

window.WhisperProcessor = class {
  constructor(opts = {}) {
    this.model = opts.model || "Xenova/whisper-tiny"; // multilingual
    this.language = opts.language || "spanish"; // default — change as needed
    this.pipeline = null;
    this.loading = false;
    this.loaded = false;
    this.loadProgress = 0;
    this.onProgress = opts.onProgress || null;

    this.recording = false;
    this.audioCtx = null;
    this.source = null;
    this.processor = null;
    this.buffers = [];
    this.sampleRate = 16000;
    this.stream = null;
  }

  async loadModel() {
    if (this.loaded) return true;
    if (this.loading) return false;
    this.loading = true;
    try {
      console.log("[VERITY] Loading transformers.js...");
      const t = await import("https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2");
      // Disable local models, force CDN fetch
      t.env.allowLocalModels = false;
      t.env.useBrowserCache = true;
      this.pipeline = await t.pipeline("automatic-speech-recognition", this.model, {
        quantized: true,
        progress_callback: (p) => {
          if (p.status === "progress" && p.progress != null) {
            this.loadProgress = p.progress / 100;
            if (this.onProgress) this.onProgress(this.loadProgress, p.file);
          }
        },
      });
      this.loaded = true;
      this.loading = false;
      this.loadProgress = 1;
      console.log("[VERITY] Whisper loaded:", this.model);
      return true;
    } catch (e) {
      console.warn("[VERITY] Whisper load failed:", e);
      this.loading = false;
      return false;
    }
  }

  async start(stream) {
    this.recording = true;
    this.buffers = [];
    this.stream = stream;
    this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (this.audioCtx.state === "suspended") {
      try {
        await this.audioCtx.resume();
      } catch (e) {}
    }
    this.source = this.audioCtx.createMediaStreamSource(stream);
    // ScriptProcessorNode is deprecated but still universally supported
    this.processor = this.audioCtx.createScriptProcessor(4096, 1, 1);
    this.source.connect(this.processor);
    // Must connect processor → destination for it to actually fire on Chrome
    // But we don't want to hear ourselves — use a muted gain node
    const sink = this.audioCtx.createGain();
    sink.gain.value = 0;
    this.processor.connect(sink);
    sink.connect(this.audioCtx.destination);
    this.processor.onaudioprocess = (e) => {
      if (!this.recording) return;
      const data = e.inputBuffer.getChannelData(0);
      this.buffers.push(new Float32Array(data));
    };
    return true;
  }

  async stop() {
    this.recording = false;
    if (this.processor) {
      try {
        this.processor.disconnect();
      } catch (e) {}
      this.processor = null;
    }
    if (this.source) {
      try {
        this.source.disconnect();
      } catch (e) {}
      this.source = null;
    }
    const fromRate = this.audioCtx ? this.audioCtx.sampleRate : 44100;
    if (this.audioCtx) {
      try {
        await this.audioCtx.close();
      } catch (e) {}
      this.audioCtx = null;
    }

    if (this.buffers.length === 0) return "";

    // Flatten
    let total = 0;
    for (const b of this.buffers) total += b.length;
    const audio = new Float32Array(total);
    let offset = 0;
    for (const b of this.buffers) {
      audio.set(b, offset);
      offset += b.length;
    }
    this.buffers = [];

    // Resample to 16kHz if needed
    const resampled = this._resample(audio, fromRate, this.sampleRate);
    if (resampled.length < 1600) return ""; // <0.1s, nothing to do

    if (!this.pipeline) {
      console.warn("[VERITY] Whisper pipeline not loaded");
      return "";
    }

    try {
      const result = await this.pipeline(resampled, {
        language: this.language,
        task: "transcribe",
        chunk_length_s: 30,
        stride_length_s: 5,
        return_timestamps: false,
      });
      return (result && result.text ? result.text : "").trim();
    } catch (e) {
      console.warn("[VERITY] Whisper transcribe failed:", e);
      return "";
    }
  }

  _resample(input, fromRate, toRate) {
    if (fromRate === toRate) return input;
    const ratio = fromRate / toRate;
    const outLen = Math.floor(input.length / ratio);
    const out = new Float32Array(outLen);
    for (let i = 0; i < outLen; i++) {
      const idx = i * ratio;
      const a = Math.floor(idx);
      const b = Math.min(a + 1, input.length - 1);
      const frac = idx - a;
      out[i] = input[a] * (1 - frac) + input[b] * frac;
    }
    return out;
  }
};
