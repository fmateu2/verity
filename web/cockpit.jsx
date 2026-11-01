/**
 * VERITY — interactive research cockpit.
 *
 * React 18 interface for a three-turn academic demonstration.
 * Load after scenarios.js and signals.jsx; app.jsx mounts window.Cockpit.
 * Sensor readings are optional. Without access, the interface uses text only.
 * Browser scores are heuristics, not outputs from the Python classifiers.
 */

const { useState, useEffect, useRef, useMemo, useCallback } = React;

// ════════════════════════════════════════════════════════
// HOOKS — animation utilities
// ════════════════════════════════════════════════════════

function useAnimatedNumber(target, duration = 1200) {
  const [v, setV] = useState(target);
  const fromRef = useRef(target);
  const startRef = useRef(null);
  useEffect(() => {
    fromRef.current = v;
    startRef.current = null;
    let raf;
    const tick = (ts) => {
      if (startRef.current == null) startRef.current = ts;
      const t = Math.min(1, (ts - startRef.current) / duration);
      // ease out cubic
      const eased = 1 - Math.pow(1 - t, 3);
      setV(fromRef.current + (target - fromRef.current) * eased);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => raf && cancelAnimationFrame(raf);
  }, [target, duration]); // intentionally not including v
  return v;
}

// ════════════════════════════════════════════════════════
// SMALL UI PRIMITIVES
// ════════════════════════════════════════════════════════

function Panel({
  title,
  statusDot,
  statusLabel,
  statusColor,
  children,
  padded = true,
  className = "",
  titleRight = null,
}) {
  return (
    <div className={"panel brackets " + className}>
      <span className="bk-tr"></span>
      <span className="bk-bl"></span>
      <div className="panel-head">
        <span className="panel-title">{title}</span>
        <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {statusLabel && (
            <span className="label-mono-sm" style={{ color: statusColor || "var(--fg-faint)" }}>
              {statusDot && <span className={`dot ${statusDot}`} style={{ marginRight: 6 }}></span>}
              {statusLabel}
            </span>
          )}
          {titleRight}
        </span>
      </div>
      <div className="panel-body" style={padded ? {} : { padding: 0 }}>
        {children}
      </div>
    </div>
  );
}

function Readout({ value, label, unit, color = "var(--fg)", size = 36, hint = null }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <span className="label-mono-sm">{label}</span>
      <span className="readout" style={{ fontSize: size, color, lineHeight: 1 }}>
        {value}
        {unit && (
          <span style={{ fontSize: 11, color: "var(--fg-faint)", marginLeft: 6, fontWeight: 400 }}>
            {unit}
          </span>
        )}
      </span>
      {hint && (
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--fg-faint)" }}>
          {hint}
        </span>
      )}
    </div>
  );
}

function MiniBar({ value, max = 1, color = "var(--cyan)", height = 4 }) {
  const pct = Math.max(0, Math.min(1, value / max)) * 100;
  return (
    <div style={{ height, background: "var(--line)", position: "relative" }}>
      <div
        style={{
          position: "absolute",
          inset: 0,
          right: "auto",
          width: pct + "%",
          background: color,
          boxShadow: `0 0 8px ${color}`,
          transition: "width 240ms ease",
        }}
      />
    </div>
  );
}

// ════════════════════════════════════════════════════════
// GAUGE — half-arc credibility gauge
// ════════════════════════════════════════════════════════

function CredibilityGauge({ decep, calibrating }) {
  // decep: 0..1; needle from -90° (truth) to +90° (deception)
  const animatedDecep = useAnimatedNumber(calibrating ? 0.5 : decep, 1400);
  const angle = (animatedDecep - 0.5) * 180;
  const isDecep = animatedDecep > 0.5;
  const color = calibrating ? "var(--fg-faint)" : isDecep ? "var(--red)" : "var(--green)";

  // Generate tick paths
  const ticks = [];
  for (let i = 0; i <= 20; i++) {
    const a = ((-180 + i * 9) * Math.PI) / 180;
    const r1 = i % 5 === 0 ? 78 : 86;
    const r2 = 92;
    const cx = 100,
      cy = 100;
    const x1 = cx + Math.cos(a) * r1;
    const y1 = cy + Math.sin(a) * r1;
    const x2 = cx + Math.cos(a) * r2;
    const y2 = cy + Math.sin(a) * r2;
    const big = i % 5 === 0;
    ticks.push(
      <line
        key={i}
        x1={x1}
        y1={y1}
        x2={x2}
        y2={y2}
        stroke={big ? "var(--fg-dim)" : "var(--fg-faint)"}
        strokeWidth={big ? 1.5 : 1}
      />,
    );
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 0,
        position: "relative",
      }}
    >
      {/* Radial pulse when deception is high */}
      {!calibrating && isDecep && <div className="gauge-pulse" style={{ borderColor: color }} />}

      <svg
        viewBox="0 0 200 130"
        style={{
          width: "100%",
          maxWidth: 260,
          overflow: "visible",
          position: "relative",
          zIndex: 1,
        }}
      >
        <defs>
          <linearGradient id="gauge-grad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="var(--green)" stopOpacity="0.8" />
            <stop offset="40%" stopColor="var(--green)" stopOpacity="0.2" />
            <stop offset="50%" stopColor="var(--amber)" stopOpacity="0.3" />
            <stop offset="60%" stopColor="var(--red)" stopOpacity="0.2" />
            <stop offset="100%" stopColor="var(--red)" stopOpacity="0.8" />
          </linearGradient>
          <radialGradient id="gauge-glow" cx="50%" cy="100%" r="50%">
            <stop offset="0%" stopColor={color} stopOpacity={calibrating ? 0 : 0.18} />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Glow halo behind arc */}
        <rect x="0" y="0" width="200" height="130" fill="url(#gauge-glow)" />

        {/* Outer arc band */}
        <path
          d="M 8 100 A 92 92 0 0 1 192 100"
          stroke="url(#gauge-grad)"
          strokeWidth="6"
          fill="none"
          opacity="0.75"
        />

        {/* Ticks */}
        {ticks}

        {/* Needle */}
        <g
          transform={`rotate(${angle} 100 100)`}
          style={{ transition: "transform 1200ms cubic-bezier(0.16, 1, 0.3, 1)" }}
        >
          <line
            x1="100"
            y1="100"
            x2="100"
            y2="18"
            stroke={color}
            strokeWidth="2"
            strokeLinecap="round"
            style={{ filter: `drop-shadow(0 0 6px ${color})` }}
          />
          <circle
            cx="100"
            cy="100"
            r="6"
            fill={color}
            style={{ filter: `drop-shadow(0 0 8px ${color})` }}
          />
          <circle cx="100" cy="100" r="3" fill="var(--bg-deep)" />
        </g>

        {/* End labels */}
        <text
          x="8"
          y="118"
          fill="var(--green)"
          fontFamily="var(--font-mono)"
          fontSize="9"
          letterSpacing="0.14em"
        >
          TRUTH
        </text>
        <text
          x="166"
          y="118"
          fill="var(--red)"
          fontFamily="var(--font-mono)"
          fontSize="9"
          letterSpacing="0.14em"
        >
          DECEP
        </text>
      </svg>

      <div
        style={{
          marginTop: -4,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 4,
        }}
      >
        <span
          className="readout"
          style={{ fontSize: 44, color, fontWeight: 500, fontVariantNumeric: "tabular-nums" }}
        >
          {calibrating ? "—" : (animatedDecep * 100).toFixed(1)}
          {!calibrating && (
            <span style={{ fontSize: 14, color: "var(--fg-faint)", marginLeft: 4 }}>%</span>
          )}
        </span>
        <span className="label-mono-sm">
          {calibrating ? "Awaiting subject" : "Heuristic score"}
        </span>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════
// OSCILLOSCOPE — generic waveform display
// ════════════════════════════════════════════════════════

function Oscilloscope({
  data,
  color = "var(--red)",
  height = 80,
  glow = true,
  baseline = false,
  scale = 1,
}) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const W = canvas.clientWidth,
      H = canvas.clientHeight;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    const ctx = canvas.getContext("2d");
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, W, H);

    // grid
    ctx.strokeStyle = "rgba(255,255,255,0.04)";
    ctx.lineWidth = 1;
    for (let x = 0; x < W; x += 24) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, H);
      ctx.stroke();
    }
    for (let y = 0; y < H; y += 16) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
      ctx.stroke();
    }

    // baseline dotted
    if (baseline) {
      ctx.strokeStyle = "var(--line-strong)";
      ctx.setLineDash([2, 6]);
      ctx.beginPath();
      ctx.moveTo(0, H / 2);
      ctx.lineTo(W, H / 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    if (!data || data.length === 0) return;

    // resolve color
    const tmp = document.createElement("div");
    tmp.style.color = color;
    document.body.appendChild(tmp);
    const resolved = getComputedStyle(tmp).color;
    document.body.removeChild(tmp);

    // waveform
    ctx.strokeStyle = resolved;
    ctx.lineWidth = 1.5;
    if (glow) {
      ctx.shadowColor = resolved;
      ctx.shadowBlur = 8;
    }
    ctx.beginPath();
    const mid = H / 2;
    for (let i = 0; i < data.length; i++) {
      const x = (i / (data.length - 1)) * W;
      const v = data[i] * scale;
      const y = mid - v * (H * 0.4);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.shadowBlur = 0;
  });

  return (
    <canvas
      ref={canvasRef}
      style={{ width: "100%", height, display: "block", background: "var(--bg-base)" }}
    />
  );
}

// ════════════════════════════════════════════════════════
// AU READOUT — bar for each Action Unit
// ════════════════════════════════════════════════════════

function AURow({ code, name, value, weight, calibrating }) {
  const hasValue = value != null && isFinite(value);
  const pct = hasValue ? Math.max(0, Math.min(1, value)) * 100 : 0;
  const intense = pct > 35;
  const dim = calibrating || !hasValue;
  const color = dim ? "var(--fg-faint)" : intense ? "var(--red)" : "var(--cyan)";
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "44px 1fr 50px",
        alignItems: "center",
        gap: 10,
        padding: "6px 0",
        borderBottom: "1px solid var(--line-faint)",
      }}
    >
      <span
        className="mono"
        style={{ fontSize: 11, color: "var(--fg-faint)", letterSpacing: "0.06em" }}
      >
        {code}
      </span>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <span style={{ fontSize: 11.5, color: "var(--fg-mute)" }}>{name}</span>
        <div style={{ height: 3, background: "var(--line)", position: "relative" }}>
          <div
            style={{
              position: "absolute",
              inset: 0,
              right: "auto",
              width: pct + "%",
              background: color,
              boxShadow: intense && !dim ? `0 0 6px ${color}` : "none",
              transition: "width 200ms ease",
            }}
          />
        </div>
      </div>
      <span
        className="mono"
        style={{ fontSize: 12, color: dim ? "var(--fg-faint)" : "var(--fg)", textAlign: "right" }}
      >
        {dim ? "—" : pct.toFixed(0)}
      </span>
    </div>
  );
}

// ════════════════════════════════════════════════════════
// FACE LANDMARK OVERLAY — simple dot mesh on detected face
// ════════════════════════════════════════════════════════

// Canonical face mesh contour groups — only the OUTLINE landmarks, not the
// interior tesselation. Each array is rendered as a closed polyline for that feature.
const FACE_OVAL = [
  10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378, 400, 377, 152, 148,
  176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109,
];
const LEFT_EYEBROW = [70, 63, 105, 66, 107];
const RIGHT_EYEBROW = [336, 296, 334, 293, 300];
const LEFT_EYE = [33, 246, 161, 160, 159, 158, 157, 173, 133, 155, 154, 153, 145, 144, 163, 7];
const RIGHT_EYE = [362, 398, 384, 385, 386, 387, 388, 466, 263, 249, 390, 373, 374, 380, 381, 382];
const OUTER_LIPS = [
  61, 185, 40, 39, 37, 0, 267, 269, 270, 409, 291, 375, 321, 405, 314, 17, 84, 181, 91, 146,
];
const INNER_LIPS = [
  78, 191, 80, 81, 82, 13, 312, 311, 310, 415, 308, 324, 318, 402, 317, 14, 87, 178, 88, 95,
];
const NOSE_BRIDGE = [168, 6, 197, 195, 5, 4];
const IRIS_KEYPOINTS = [468, 473]; // left iris center, right iris center

function FaceMeshOverlay({ landmarks }) {
  if (!landmarks) return null;

  const path = (group, closed = false) => {
    let d = "";
    for (let i = 0; i < group.length; i++) {
      const p = landmarks[group[i]];
      if (!p) continue;
      d += (i === 0 ? "M" : "L") + (p.x * 100).toFixed(3) + "," + (p.y * 100).toFixed(3);
    }
    if (closed) d += "Z";
    return d;
  };

  return (
    <svg
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      style={{ position: "absolute", inset: 0, pointerEvents: "none", transform: "scaleX(-1)" }}
    >
      <defs>
        <radialGradient id="iris-glow">
          <stop offset="0%" stopColor="var(--cyan)" stopOpacity="1" />
          <stop offset="100%" stopColor="var(--cyan)" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Face contour groups — clean wireframe outline */}
      <g stroke="var(--cyan)" strokeWidth="0.22" fill="none" opacity="0.72" strokeLinejoin="round">
        <path d={path(FACE_OVAL, true)} />
        <path d={path(LEFT_EYEBROW)} />
        <path d={path(RIGHT_EYEBROW)} />
        <path d={path(LEFT_EYE, true)} />
        <path d={path(RIGHT_EYE, true)} />
        <path d={path(OUTER_LIPS, true)} />
        <path d={path(INNER_LIPS, true)} />
        <path d={path(NOSE_BRIDGE)} />
      </g>

      {/* Iris centers — highlighted with halo */}
      {IRIS_KEYPOINTS.map((idx, k) => {
        const p = landmarks[idx];
        if (!p) return null;
        return (
          <g key={k}>
            <circle cx={p.x * 100} cy={p.y * 100} r="1.5" fill="url(#iris-glow)" opacity="0.7" />
            <circle cx={p.x * 100} cy={p.y * 100} r="0.5" fill="var(--cyan)" />
          </g>
        );
      })}
    </svg>
  );
}

// ════════════════════════════════════════════════════════
// COCKPIT — top-level state machine
// ════════════════════════════════════════════════════════

function Cockpit() {
  // Refs
  const videoRef = useRef(null);
  const canvasROIRef = useRef(null);
  const streamRef = useRef(null);
  const faceRef = useRef(null); // FaceProcessor
  const rppgRef = useRef(null); // RppgProcessor
  const voiceRef = useRef(null); // VoiceProcessor
  const speechRef = useRef(null); // Unified SpeechProcessor — Web Speech or Whisper
  const animRef = useRef(null);
  const baselineCollectorRef = useRef(null); // BaselineCollector during calibration
  const responseCollectorRef = useRef(null); // ResponseCollector during each turn

  // State
  const [phase, setPhase] = useState("idle"); // idle | calibrating | awaiting | analyzing | result | final
  const [turn, setTurn] = useState(1);
  const [category, setCategory] = useState("WORKPLACE");
  const [transcript, setTranscript] = useState("");
  const [typedText, setTypedText] = useState("");
  const [micActive, setMicActive] = useState(false);

  // Empty phys = no sensors yet. All readouts render "—" until real data flows.
  const emptyPhys = {
    hr_mean: null,
    hrv: null,
    au1_inner_brow: null,
    au4_brow_lower: null,
    au7_lid_tighten: null,
    au12_lip_corner: null,
    blink_rate: null,
    _faceReady: false,
    _hrReady: false,
    _landmarks: null,
  };
  const [phys, setPhys] = useState(emptyPhys);
  const [personalBaseline, setPersonalBaseline] = useState(null);
  const [calibrationProgress, setCalibrationProgress] = useState(0);
  const [voiceMeta, setVoiceMeta] = useState({
    rms: 0,
    voiced: false,
    voicedRatio: 0,
    pauseRatio: 1,
  });
  const [textFeats, setTextFeats] = useState(() => window.extractTextFeatures(""));
  const [currentResult, setCurrentResult] = useState(null);
  const [turnLog, setTurnLog] = useState([]);
  const [permError, setPermError] = useState(null);
  const [mediapipeStatus, setMediapipeStatus] = useState("idle"); // idle | loading | ready | failed
  const [speechStatus, setSpeechStatus] = useState({ backend: "none", state: "idle", progress: 0 });

  const [signalStreams, setSignalStreams] = useState({
    rppgWave: new Float32Array(180),
    voiceWave: new Float32Array(180),
  });

  // session id + timestamp
  const sessionId = useMemo(() => {
    const id = Math.floor(Math.random() * 9999)
      .toString()
      .padStart(4, "0");
    return `VRT-2026-${id}`;
  }, []);

  // Shuffle scenarios per session so each turn gets a different question.
  // Re-shuffle whenever the user picks a new category.
  const scenarioOrder = useMemo(() => {
    const pool = window.VERITY_SCENARIOS[category];
    const idxs = pool.map((_, i) => i);
    // Fisher–Yates
    for (let i = idxs.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [idxs[i], idxs[j]] = [idxs[j], idxs[i]];
    }
    return idxs;
  }, [category]);

  const scenario =
    window.VERITY_SCENARIOS[category][scenarioOrder[(turn - 1) % scenarioOrder.length]];

  // Use either typed text or live transcript as the response
  const response = (typedText || transcript || "").trim();
  useEffect(() => {
    setTextFeats(window.extractTextFeatures(response));
  }, [response]);

  // ────────────────────────────────────────────────────
  // INIT — request camera + mic on Begin Session
  // ────────────────────────────────────────────────────
  const beginTextSession = useCallback(() => {
    setPermError(null);
    rppgRef.current = new window.RppgProcessor();
    baselineCollectorRef.current = new window.BaselineCollector();
    responseCollectorRef.current = new window.ResponseCollector();
    setPhase("awaiting");
  }, []);

  const beginSession = useCallback(async () => {
    setPermError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: "user" },
        audio: true,
      });
      streamRef.current = stream;
      // Don't try to set videoRef.current.srcObject here — the <video> element
      // isn't mounted until phase !== "idle". A separate useEffect handles wiring
      // the stream to the video element once it's in the DOM.

      // init voice
      voiceRef.current = new window.VoiceProcessor();
      await voiceRef.current.init(stream);

      // init speech — unified processor picks Web Speech (Chrome/Edge) or Whisper (Safari/Firefox/all)
      speechRef.current = new window.SpeechProcessor(
        (t) => setTranscript(t),
        (status) => setSpeechStatus(status),
      );
      speechRef.current.setStream(stream);

      // init rPPG
      rppgRef.current = new window.RppgProcessor();

      // init personal baseline collector — measures the SUBJECT's resting values
      baselineCollectorRef.current = new window.BaselineCollector();
      responseCollectorRef.current = new window.ResponseCollector();

      // init face landmarker (this is the slowest)
      faceRef.current = new window.FaceProcessor();
      setMediapipeStatus("loading");
      faceRef.current.init().then((ok) => {
        setMediapipeStatus(ok ? "ready" : "failed");
      });

      setPhase("calibrating");
      setCalibrationProgress(0);

      // 15-second calibration: rPPG needs ~10s of buffer to produce a stable
      // HR reading, then a few more seconds to average. Less than this and the
      // personal baseline ends up unreliable, making every later reading look "elevated".
      const CAL_MS = 15000;
      const calStart = performance.now();
      const calTicker = setInterval(() => {
        const elapsed = performance.now() - calStart;
        const pct = Math.min(1, elapsed / CAL_MS);
        setCalibrationProgress(pct);
        if (pct >= 1) clearInterval(calTicker);
      }, 100);

      setTimeout(() => {
        // Lock in the subject's personal baseline from collected samples
        if (baselineCollectorRef.current) {
          const baseline = baselineCollectorRef.current.compute();
          setPersonalBaseline(baseline);
        }
        setPhase("awaiting");
      }, CAL_MS);
    } catch (e) {
      console.warn("[VERITY] Permission denied / no devices:", e);
      setPermError(e && e.message ? e.message : "Camera and microphone access denied");
      // No simulation — without sensors the cockpit shows "—" and runs on text features only.
      rppgRef.current = new window.RppgProcessor();
      baselineCollectorRef.current = new window.BaselineCollector();
      setMediapipeStatus("failed");
      setPhase("awaiting");
    }
  }, []);

  // Wire the captured stream to the <video> element AFTER the element is mounted.
  // We can't do this inside beginSession because the video element doesn't exist
  // until phase changes from "idle" — React mounts it on the next render.
  useEffect(() => {
    if (phase !== "idle" && videoRef.current && streamRef.current && !videoRef.current.srcObject) {
      videoRef.current.srcObject = streamRef.current;
      videoRef.current.play().catch((e) => console.warn("[VERITY] video.play() rejected:", e));
      console.log("[VERITY] Video element wired to stream", {
        tracks: streamRef.current.getVideoTracks().length,
        videoEl: videoRef.current,
      });
    }
  }, [phase]);

  // ────────────────────────────────────────────────────
  // MAIN PROCESSING LOOP
  // ────────────────────────────────────────────────────
  useEffect(() => {
    if (phase === "idle") return;
    let running = true;
    const start = performance.now();

    const tick = () => {
      if (!running) return;
      const ts = performance.now();
      const t = ts - start;

      // ── FACE detection ──
      let faceData = null;
      if (
        faceRef.current &&
        faceRef.current.ready &&
        videoRef.current &&
        videoRef.current.readyState >= 2
      ) {
        faceData = faceRef.current.detect(videoRef.current, ts);
      }

      // ── rPPG from forehead ──
      if (
        videoRef.current &&
        videoRef.current.readyState >= 2 &&
        rppgRef.current &&
        faceData &&
        faceData.forehead
      ) {
        // Sample a small ROI around the forehead landmark
        const v = videoRef.current;
        const c = canvasROIRef.current;
        if (c) {
          c.width = v.videoWidth || 640;
          c.height = v.videoHeight || 480;
          const cx = faceData.forehead.x * c.width;
          const cy = faceData.forehead.y * c.height;
          const roi = 40;
          try {
            const ctx = c.getContext("2d", { willReadFrequently: true });
            ctx.drawImage(v, 0, 0, c.width, c.height);
            const data = ctx.getImageData(
              Math.max(0, cx - roi / 2),
              Math.max(0, cy - roi / 2),
              roi,
              roi,
            ).data;
            let g = 0;
            for (let i = 1; i < data.length; i += 4) g += data[i];
            g /= data.length / 4;
            rppgRef.current.pushSample(g, ts);
          } catch (e) {}
        }
      }

      const hrData = rppgRef.current ? rppgRef.current.compute() : null;

      // ── VOICE ──
      let voiceData = null;
      if (voiceRef.current) voiceData = voiceRef.current.tick(ts);

      // Compose physiological feature vector — REAL values only.
      // Missing signals are null and render as "—".
      const physVec = {
        hr_mean: hrData && hrData.ok ? hrData.hr : null,
        hrv: hrData && hrData.ok ? hrData.hrv : null,
        au1_inner_brow: faceData ? faceData.au1_inner_brow : null,
        au4_brow_lower: faceData ? faceData.au4_brow_lower : null,
        au7_lid_tighten: faceData ? faceData.au7_lid_tighten : null,
        au12_lip_corner: faceData ? faceData.au12_lip_corner : null,
        blink_rate: faceData ? faceData.blink_rate : null,
        _faceReady: !!faceData,
        _hrReady: !!(hrData && hrData.ok),
        _landmarks: faceData ? faceData.landmarks : null,
      };

      // During calibration, record real samples to build subject's personal baseline
      if (phase === "calibrating" && baselineCollectorRef.current) {
        baselineCollectorRef.current.add(physVec);
      }
      // During an active response window (awaiting), collect samples to compute
      // mean + variability of physiological signals throughout the answer
      if (phase === "awaiting" && responseCollectorRef.current) {
        responseCollectorRef.current.add(physVec, ts);
      }

      setPhys(physVec);

      if (voiceData) setVoiceMeta(voiceData);
      // (no fake voice meta — leave as whatever it was)

      // Update wave streams — only real data, empty otherwise
      setSignalStreams((s) => {
        const newRppg = new Float32Array(s.rppgWave.length);
        if (rppgRef.current && rppgRef.current.waveform && physVec._faceReady) {
          const wf = rppgRef.current.waveform;
          const idx = rppgRef.current.waveIdx;
          for (let i = 0; i < newRppg.length; i++) {
            newRppg[i] = wf[(idx + i) % wf.length] * 0.8;
          }
        }
        // else: zeros (flat baseline)

        const newVoice = new Float32Array(s.voiceWave.length);
        if (voiceRef.current && voiceRef.current.envelope) {
          const env = voiceRef.current.envelope;
          const idx = voiceRef.current.envIdx;
          for (let i = 0; i < newVoice.length; i++) {
            newVoice[i] = env[(idx + i) % env.length] * 8;
          }
        }
        return { rppgWave: newRppg, voiceWave: newVoice };
      });

      animRef.current = requestAnimationFrame(tick);
    };
    animRef.current = requestAnimationFrame(tick);

    return () => {
      running = false;
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [phase]);

  // Reset the response collector at the start of each turn so we only capture
  // physiological samples during that turn's answer window.
  useEffect(() => {
    if (phase === "awaiting" && responseCollectorRef.current) {
      responseCollectorRef.current.start(performance.now());
      console.log("[VERITY] Response collector started for turn", turn);
    }
  }, [phase, turn]);

  // ────────────────────────────────────────────────────
  // MIC toggle
  // ────────────────────────────────────────────────────
  const toggleMic = useCallback(async () => {
    if (!speechRef.current || !speechRef.current.supported) return;
    if (speechStatus.state === "loading" || speechStatus.state === "transcribing") return;
    if (micActive) {
      speechRef.current.stop();
      setMicActive(false);
    } else {
      speechRef.current.clear();
      setTranscript("");
      setMicActive(true);
      const ok = await speechRef.current.start();
      if (!ok) setMicActive(false);
    }
  }, [micActive, speechStatus.state]);

  // ────────────────────────────────────────────────────
  // SUBMIT — analyze response, score it
  // ────────────────────────────────────────────────────
  const submitResponse = useCallback(async () => {
    // If mic is on, stop it and wait for any pending Whisper transcription to finish
    let finalResponse = response;
    if (speechRef.current && micActive) {
      speechRef.current.stop();
      setMicActive(false);
      // Whisper transcribes async after stop; wait up to 6s for the final text
      if (speechStatus.backend === "whisper") {
        await new Promise((resolve) => {
          const start = performance.now();
          const poll = () => {
            const done = speechRef.current.text().length > finalResponse.length;
            if (done || performance.now() - start > 6000) resolve();
            else setTimeout(poll, 200);
          };
          poll();
        });
        finalResponse = ((typedText ? typedText + " " : "") + speechRef.current.text()).trim();
      }
    }
    if (!finalResponse || finalResponse.length < 5) {
      // create a minimal stub so the demo always works
    }
    setPhase("analyzing");
    // ~3s scan animation, then score
    setTimeout(() => {
      // Use the AVERAGE of physiological samples during the answer instead of
      // the live snapshot at submit time. More representative of what was happening
      // while the subject was responding.
      const summary = responseCollectorRef.current
        ? responseCollectorRef.current.summarize()
        : null;
      const physForScoring =
        summary && summary._n >= 10
          ? {
              hr_mean: summary.mean.hr_mean ?? phys.hr_mean,
              hrv: summary.mean.hrv ?? phys.hrv,
              au1_inner_brow: summary.mean.au1_inner_brow ?? phys.au1_inner_brow,
              au4_brow_lower: summary.peak.au4_brow_lower ?? phys.au4_brow_lower, // peak — tension shows in peaks
              au7_lid_tighten: summary.peak.au7_lid_tighten ?? phys.au7_lid_tighten, // peak
              au12_lip_corner: summary.mean.au12_lip_corner ?? phys.au12_lip_corner,
              blink_rate: summary.mean.blink_rate ?? phys.blink_rate,
            }
          : phys;

      const tf = window.extractTextFeatures(finalResponse || "I... I don't know.");
      let result = window.computeDeceptionScoreWithBaseline(tf, physForScoring, personalBaseline);

      // Variability bonus: if AUs jittered a lot during the answer, push toward deception
      if (summary && summary._n >= 10) {
        const auVariability =
          (summary.std.au4_brow_lower || 0) + (summary.std.au7_lid_tighten || 0);
        const hrVariability = summary.std.hr_mean || 0;
        if (auVariability > 0.18 || hrVariability > 8) {
          // High variability = nervous = lean toward deception
          result.decep = Math.min(0.97, result.decep + 0.08);
          result.truth = 1 - result.decep;
        }
      }

      const signals = window.deriveTextSignals(tf);
      const physSignals = [];
      const pb = personalBaseline || {};
      if (physForScoring.hr_mean != null && physForScoring.hr_mean > (pb.hr_mean || 74) + 6)
        physSignals.push({
          kind: "warn",
          msg: `Heart rate +${Math.round(physForScoring.hr_mean - (pb.hr_mean || 74))} bpm above baseline`,
        });
      if (physForScoring.hrv != null && physForScoring.hrv < (pb.hrv || 55) - 8)
        physSignals.push({
          kind: "warn",
          msg: `HRV suppressed ${Math.round((pb.hrv || 55) - physForScoring.hrv)} ms below baseline`,
        });
      if (summary && summary.std.au4_brow_lower > 0.1)
        physSignals.push({ kind: "warn", msg: "AU4 brow activity volatile during answer" });
      if (summary && summary.std.au7_lid_tighten > 0.1)
        physSignals.push({ kind: "warn", msg: "AU7 lid tension fluctuated significantly" });
      if (physForScoring.au4_brow_lower > 0.25)
        physSignals.push({ kind: "warn", msg: "AU4 brow lowering — tension" });
      if (physForScoring.au7_lid_tighten > 0.3)
        physSignals.push({ kind: "warn", msg: "AU7 lid tightening — stress" });
      if (
        physForScoring.blink_rate != null &&
        physForScoring.blink_rate > (pb.blink_rate || 18) + 6
      )
        physSignals.push({
          kind: "warn",
          msg: `Elevated blink rate (${Math.round(physForScoring.blink_rate)}/min)`,
        });
      if (physForScoring.au12_lip_corner > 0.4)
        physSignals.push({ kind: "ok", msg: "Natural smile baseline" });
      if (
        physForScoring.hrv != null &&
        physForScoring.hr_mean != null &&
        physForScoring.hrv > (pb.hrv || 55) - 5 &&
        physForScoring.hr_mean < (pb.hr_mean || 74) + 4
      )
        physSignals.push({ kind: "ok", msg: "Cardiac signature near baseline" });

      const finalResult = {
        turn,
        decep: result.decep,
        truth: result.truth,
        signals: [...signals, ...physSignals].slice(0, 8),
        ruleFired: result.ruleFired,
        textFeats: tf,
        physSnap: { ...phys },
        response: finalResponse,
      };
      setCurrentResult(finalResult);
      setTurnLog((log) => [...log, finalResult]);
      setPhase("result");
    }, 2800);
  }, [response, phys, micActive, turn, speechStatus.backend, typedText, personalBaseline]);

  // ────────────────────────────────────────────────────
  // NEXT TURN / FINAL
  // ────────────────────────────────────────────────────
  const nextTurn = useCallback(() => {
    if (turn >= 3) {
      setPhase("final");
      return;
    }
    setTurn(turn + 1);
    setTranscript("");
    setTypedText("");
    if (speechRef.current) speechRef.current.clear();
    setCurrentResult(null);
    setPhase("awaiting");
  }, [turn]);

  const resetSession = useCallback(() => {
    setTurn(1);
    setTranscript("");
    setTypedText("");
    setTurnLog([]);
    setCurrentResult(null);
    if (speechRef.current) speechRef.current.clear();
    setPhase("awaiting");
  }, []);

  // ────────────────────────────────────────────────────
  // RENDER
  // ────────────────────────────────────────────────────
  const live = phase !== "idle";
  const calibrating = phase === "calibrating";
  const showResult = phase === "result" || phase === "final";

  const statusText = {
    idle: "STANDBY",
    calibrating: "CALIBRATING",
    awaiting: "AWAITING RESPONSE",
    analyzing: "ANALYZING",
    result: "TURN COMPLETE",
    final: "SESSION ENDED",
  }[phase];

  const statusDot =
    phase === "idle"
      ? "idle"
      : phase === "calibrating"
        ? "warn"
        : phase === "analyzing"
          ? "warn"
          : phase === "result" || phase === "final"
            ? "ok"
            : "live";

  return (
    <div className="cockpit">
      {/* HIDDEN ROI canvas for rPPG sampling */}
      <canvas ref={canvasROIRef} style={{ display: "none" }} />

      {/* TOP BAR */}
      <div className="cock-topbar">
        <div className="row" style={{ gap: 18 }}>
          <span className="label-mono">
            <span className={`dot ${statusDot}`} style={{ marginRight: 8 }}></span>
            {statusText}
          </span>
          <span className="divider-v"></span>
          <span className="label-mono-sm">
            SESSION <span style={{ color: "var(--fg)" }}>{sessionId}</span>
          </span>
          <span className="divider-v"></span>
          <CategorySelector
            category={category}
            setCategory={setCategory}
            disabled={live && phase !== "awaiting" && phase !== "idle"}
          />
          <span className="divider-v"></span>
          <span className="label-mono-sm">
            TURN{" "}
            <span style={{ color: "var(--fg)" }}>
              {turn} <span style={{ color: "var(--fg-faint)" }}>/ 3</span>
            </span>
          </span>
        </div>

        <div className="row" style={{ gap: 12 }}>
          <span className="label-mono-sm">
            FACE{" "}
            <span
              style={{
                color: phys._faceReady
                  ? "var(--green)"
                  : mediapipeStatus === "loading"
                    ? "var(--amber)"
                    : "var(--fg-faint)",
                marginLeft: 4,
              }}
            >
              {phys._faceReady ? "● LIVE" : mediapipeStatus === "loading" ? "◐ LOAD" : "○ —"}
            </span>
          </span>
          <span className="label-mono-sm">
            HR{" "}
            <span
              style={{ color: phys._hrReady ? "var(--green)" : "var(--fg-faint)", marginLeft: 4 }}
            >
              {phys._hrReady ? "● LIVE" : "○ —"}
            </span>
          </span>
          <span className="label-mono-sm">
            MIC{" "}
            <span
              style={{
                color: micActive
                  ? "var(--green)"
                  : voiceRef.current
                    ? "var(--cyan)"
                    : "var(--fg-faint)",
                marginLeft: 4,
              }}
            >
              {micActive ? "● LIVE" : voiceRef.current ? "● READY" : "○ —"}
            </span>
          </span>
          <span className="label-mono-sm">
            STT{" "}
            <span
              style={{
                color:
                  speechStatus.state === "ready" ||
                  speechStatus.state === "listening" ||
                  speechStatus.state === "recording" ||
                  speechStatus.state === "transcribing"
                    ? "var(--cyan)"
                    : speechStatus.state === "loading"
                      ? "var(--amber)"
                      : speechStatus.state === "failed"
                        ? "var(--red)"
                        : "var(--fg-faint)",
                marginLeft: 4,
              }}
            >
              {speechStatus.backend === "webspeech"
                ? speechStatus.state === "listening"
                  ? "● LISTENING"
                  : "● WEB SPEECH"
                : speechStatus.backend === "whisper"
                  ? speechStatus.state === "loading"
                    ? `◐ WHISPER ${Math.round((speechStatus.progress || 0) * 100)}%`
                    : speechStatus.state === "ready"
                      ? "● WHISPER"
                      : speechStatus.state === "recording"
                        ? "● REC"
                        : speechStatus.state === "transcribing"
                          ? "◐ DECODE"
                          : speechStatus.state === "failed"
                            ? "✕ FAIL"
                            : "○ —"
                  : "○ —"}
            </span>
          </span>
        </div>
      </div>

      {/* MAIN GRID */}
      <div className="cock-grid">
        {/* LEFT COL — sensors */}
        <div className="cock-col cock-col-left">
          <Panel
            title="01 — Face / FACS"
            statusDot={live ? (phys._faceReady ? "ok" : "warn") : "idle"}
            statusLabel={
              live
                ? phys._faceReady
                  ? "478pt · 30Hz"
                  : mediapipeStatus === "loading"
                    ? "LOADING"
                    : "NO FACE"
                : "OFFLINE"
            }
            padded={false}
          >
            <div className="face-feed">
              {(!live || !streamRef.current) && (
                <div className="face-placeholder">
                  <div className="face-cross" />
                  <span className="label-mono-sm" style={{ marginTop: 12 }}>
                    NO SIGNAL
                  </span>
                </div>
              )}
              {live && streamRef.current && (
                <>
                  <video
                    ref={videoRef}
                    playsInline
                    muted
                    autoPlay
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                      transform: "scaleX(-1)",
                      display: "block",
                    }}
                  />
                  {/* Face mesh overlay disabled — the cyan wireframe consistently
                      offset from the actual face due to video aspect-ratio mismatch.
                      Camera + corner crosshairs + AU bars below provide the visual
                      signal that the system IS tracking the face. */}
                  {calibrating && (
                    <div className="face-overlay">
                      <span className="label-mono" style={{ color: "var(--amber)" }}>
                        ● MEASURING BASELINE
                      </span>
                      <div
                        style={{
                          width: 220,
                          height: 3,
                          background: "rgba(0,0,0,0.5)",
                          border: "1px solid var(--line)",
                          position: "relative",
                        }}
                      >
                        <div
                          style={{
                            position: "absolute",
                            inset: 0,
                            right: "auto",
                            width: calibrationProgress * 100 + "%",
                            background: "var(--amber)",
                            boxShadow: "0 0 8px var(--amber-glow)",
                            transition: "width 100ms linear",
                          }}
                        />
                      </div>
                      <span className="label-mono-sm" style={{ color: "var(--fg-mute)" }}>
                        {Math.ceil((1 - calibrationProgress) * 15)}s remaining
                      </span>
                    </div>
                  )}
                </>
              )}
              {/* Corner crosshairs */}
              <span className="corner-mark tl"></span>
              <span className="corner-mark tr"></span>
              <span className="corner-mark bl"></span>
              <span className="corner-mark br"></span>
            </div>
            <div style={{ padding: "12px 14px" }}>
              <AURow
                code="AU1"
                name="Inner Brow Raiser"
                value={phys.au1_inner_brow}
                calibrating={!live || calibrating}
              />
              <AURow
                code="AU4"
                name="Brow Lowerer"
                value={phys.au4_brow_lower}
                calibrating={!live || calibrating}
              />
              <AURow
                code="AU7"
                name="Lid Tightener"
                value={phys.au7_lid_tighten}
                calibrating={!live || calibrating}
              />
              <AURow
                code="AU12"
                name="Lip Corner Puller"
                value={phys.au12_lip_corner}
                calibrating={!live || calibrating}
              />
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  marginTop: 12,
                  paddingTop: 12,
                  borderTop: "1px solid var(--line)",
                }}
              >
                <Readout
                  label="Blink rate"
                  value={phys.blink_rate != null ? Math.round(phys.blink_rate) : "—"}
                  unit="/min"
                  size={20}
                  hint={
                    personalBaseline &&
                    personalBaseline._measured &&
                    personalBaseline._measured.blink_rate
                      ? `you: ${Math.round(personalBaseline.blink_rate)}/min`
                      : null
                  }
                />
                <Readout
                  label="Landmarks"
                  value={phys._faceReady ? "478" : "—"}
                  unit="pts"
                  size={20}
                />
              </div>
            </div>
          </Panel>

          <Panel
            title="02 — Cardio / rPPG"
            statusDot={live ? (phys._hrReady ? "live" : "warn") : "idle"}
            statusLabel={
              live
                ? phys._hrReady
                  ? "GREEN CHANNEL"
                  : streamRef.current
                    ? "BUFFERING"
                    : "NO SENSOR"
                : "OFFLINE"
            }
            padded={false}
          >
            <div style={{ padding: "10px 14px 6px" }}>
              <Oscilloscope
                data={signalStreams.rppgWave}
                color="var(--red)"
                height={80}
                baseline
                glow
                scale={4}
              />
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 12,
                padding: "12px 14px 14px",
                borderTop: "1px solid var(--line)",
              }}
            >
              <Readout
                label="Heart rate"
                value={phys.hr_mean != null ? Math.round(phys.hr_mean) : "—"}
                unit="bpm"
                size={28}
                color={
                  phys.hr_mean != null &&
                  personalBaseline &&
                  phys.hr_mean > (personalBaseline.hr_mean || 74) + 8
                    ? "var(--red)"
                    : "var(--fg)"
                }
                hint={
                  personalBaseline &&
                  personalBaseline._measured &&
                  personalBaseline._measured.hr_mean
                    ? `you: ${Math.round(personalBaseline.hr_mean)} bpm`
                    : personalBaseline
                      ? "ref: 74 bpm (lit.)"
                      : calibrating
                        ? "calibrating…"
                        : "No sensor data"
                }
              />
              <Readout
                label="HRV"
                value={phys.hrv != null ? Math.round(phys.hrv) : "—"}
                unit="ms"
                size={28}
                color={
                  phys.hrv != null &&
                  personalBaseline &&
                  phys.hrv < (personalBaseline.hrv || 55) - 10
                    ? "var(--red)"
                    : "var(--fg)"
                }
                hint={
                  personalBaseline && personalBaseline._measured && personalBaseline._measured.hrv
                    ? `you: ${Math.round(personalBaseline.hrv)} ms`
                    : personalBaseline
                      ? "ref: 55 ms (lit.)"
                      : calibrating
                        ? "calibrating…"
                        : "No sensor data"
                }
              />
            </div>
          </Panel>

          <Panel
            title="03 — Voice / Audio"
            statusDot={
              live ? (voiceMeta.voiced ? "live" : voiceRef.current ? "ok" : "warn") : "idle"
            }
            statusLabel={
              live
                ? voiceRef.current
                  ? voiceMeta.voiced
                    ? "VOICED"
                    : "QUIET"
                  : "NO MIC"
                : "OFFLINE"
            }
            padded={false}
          >
            <div style={{ padding: "10px 14px 6px" }}>
              <Oscilloscope
                data={signalStreams.voiceWave}
                color="var(--cyan)"
                height={56}
                glow
                scale={2}
              />
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 12,
                padding: "12px 14px 14px",
                borderTop: "1px solid var(--line)",
              }}
            >
              <Readout
                label="Voiced ratio"
                value={voiceRef.current ? (voiceMeta.voicedRatio * 100).toFixed(0) : "—"}
                unit="%"
                size={20}
              />
              <Readout
                label="Pause ratio"
                value={voiceRef.current ? (voiceMeta.pauseRatio * 100).toFixed(0) : "—"}
                unit="%"
                size={20}
              />
            </div>
          </Panel>
        </div>

        {/* CENTER COL — scenario + response */}
        <div className="cock-col cock-col-center">
          {phase === "idle" && (
            <Panel title="00 — Subject Brief" statusDot="idle" statusLabel="OFFLINE">
              <IdlePanel
                onBegin={beginSession}
                onBeginText={beginTextSession}
                permError={permError}
              />
            </Panel>
          )}

          {(phase === "calibrating" || phase === "awaiting" || phase === "analyzing") && (
            <Panel
              title={`SCENARIO ${turn.toString().padStart(2, "0")} — ${category}`}
              statusDot={phase === "calibrating" ? "warn" : phase === "analyzing" ? "warn" : "live"}
              statusLabel={
                phase === "calibrating"
                  ? "BRIEFING"
                  : phase === "analyzing"
                    ? "ANALYZING"
                    : "ACTIVE"
              }
            >
              <ScenarioBody
                scenario={scenario}
                phase={phase}
                response={response}
                typedText={typedText}
                setTypedText={setTypedText}
                transcript={transcript}
                micActive={micActive}
                speechSupported={speechRef.current ? speechRef.current.supported : false}
                speechStatus={speechStatus}
                onMic={toggleMic}
                onSubmit={submitResponse}
                turn={turn}
              />
            </Panel>
          )}

          {phase === "result" && currentResult && (
            <Panel
              title={`TURN ${currentResult.turn} — VERDICT`}
              statusDot={currentResult.decep > 0.5 ? "live" : "ok"}
              statusLabel={currentResult.decep > 0.5 ? "DECEPTION DETECTED" : "RESPONSE CREDIBLE"}
              statusColor={currentResult.decep > 0.5 ? "var(--red)" : "var(--green)"}
            >
              <TurnResult result={currentResult} onNext={nextTurn} isLast={turn >= 3} />
            </Panel>
          )}

          {phase === "final" && (
            <Panel
              title="SESSION REPORT"
              statusDot="ok"
              statusLabel="3 / 3 TURNS · COMPLETE"
              statusColor="var(--green)"
            >
              <FinalReport
                turnLog={turnLog}
                sessionId={sessionId}
                category={category}
                onReset={resetSession}
              />
            </Panel>
          )}
        </div>

        {/* RIGHT COL — credibility + features + signals */}
        <div className="cock-col cock-col-right">
          <Panel
            title="04 — Credibility"
            statusDot={showResult ? "ok" : live ? "live" : "idle"}
            statusLabel={showResult ? "VERDICT LOCKED" : live ? "LIVE TRACKING" : "OFFLINE"}
          >
            <CredibilityGauge
              decep={
                showResult
                  ? (currentResult?.decep ?? 0.5)
                  : live && !calibrating
                    ? livePreviewDecep(phys, textFeats, personalBaseline)
                    : 0.5
              }
              calibrating={!live || calibrating}
            />
            <div style={{ marginTop: 18, display: "flex", flexDirection: "column", gap: 10 }}>
              <ModalityScore
                label="Linguistic"
                value={
                  live && !calibrating
                    ? estimateModality("text", textFeats, phys, personalBaseline)
                    : 0
                }
                calibrating={!live || calibrating}
              />
              <ModalityScore
                label="Cardiac"
                value={
                  live && !calibrating
                    ? estimateModality("cardio", textFeats, phys, personalBaseline)
                    : 0
                }
                calibrating={!live || calibrating || !phys._hrReady}
              />
              <ModalityScore
                label="Micro-facial"
                value={
                  live && !calibrating
                    ? estimateModality("face", textFeats, phys, personalBaseline)
                    : 0
                }
                calibrating={!live || calibrating || !phys._faceReady}
              />
              <ModalityScore
                label="Vocal"
                value={
                  live && !calibrating
                    ? estimateModality("voice", voiceMeta, phys, personalBaseline)
                    : 0
                }
                calibrating={!live || calibrating || !voiceRef.current}
              />
            </div>
          </Panel>

          <Panel
            title="05 — Linguistic Features"
            statusDot={live && !calibrating && response ? "live" : "idle"}
            statusLabel={response ? `${textFeats.n_words} words` : "—"}
            padded={false}
          >
            <div
              style={{
                padding: "10px 14px 14px",
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 14,
              }}
            >
              <FeatCell
                name="Hedge ratio"
                value={textFeats.hedge_ratio}
                fmt="pct"
                warn={textFeats.hedge_ratio < 0.02 && response.length > 30}
              />
              <FeatCell
                name="Denial ratio"
                value={textFeats.denial_ratio}
                fmt="pct"
                warn={textFeats.denial_ratio > 0.04}
              />
              <FeatCell
                name="Specificity"
                value={textFeats.specificity_score}
                fmt="num"
                warn={textFeats.specificity_score < 0.25 && response.length > 30}
              />
              <FeatCell
                name="Repetition"
                value={textFeats.repetition_ratio}
                fmt="pct"
                warn={textFeats.repetition_ratio > 0.15}
              />
              <FeatCell
                name="1st-person"
                value={textFeats.first_person_ratio}
                fmt="pct"
                warn={textFeats.first_person_ratio > 0.25}
              />
              <FeatCell
                name="Exclamations"
                value={textFeats.n_exclamations}
                fmt="int"
                warn={textFeats.n_exclamations > 1}
              />
            </div>
          </Panel>

          <Panel
            title="06 — Signal Log"
            statusDot={live ? (showResult ? "ok" : "live") : "idle"}
            statusLabel={showResult ? `${currentResult?.signals.length || 0} EVENTS` : "MONITORING"}
            padded={false}
          >
            <SignalLog
              signals={
                showResult
                  ? currentResult?.signals
                  : liveDerivedSignals(phys, textFeats, response, calibrating, personalBaseline)
              }
            />
          </Panel>
        </div>
      </div>

      {/* TURN STRIP — only show after first turn */}
      {turnLog.length > 0 && (
        <div className="turn-strip">
          {[1, 2, 3].map((n) => {
            const log = turnLog.find((l) => l.turn === n);
            return (
              <div
                key={n}
                className={`turn-pill ${log ? (log.decep > 0.5 ? "decep" : "truth") : n === turn ? "active" : "future"}`}
              >
                <span className="label-mono-sm">T0{n}</span>
                {log ? (
                  <span
                    className="mono"
                    style={{ fontSize: 13, color: log.decep > 0.5 ? "var(--red)" : "var(--green)" }}
                  >
                    {(log.decep * 100).toFixed(0)}%
                  </span>
                ) : (
                  <span className="mono" style={{ fontSize: 13, color: "var(--fg-faint)" }}>
                    —
                  </span>
                )}
                <span className="label-mono-sm" style={{ color: "var(--fg-faint)" }}>
                  {log ? (log.decep > 0.5 ? "DECEP" : "TRUTH") : n === turn ? "ACTIVE" : "PENDING"}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════
// SUB-PANELS
// ════════════════════════════════════════════════════════

function CategorySelector({ category, setCategory, disabled }) {
  const [open, setOpen] = useState(false);
  const cats = window.VERITY_CATEGORIES;
  const cur = cats.find((c) => c.id === category);
  return (
    <div style={{ position: "relative" }}>
      <button
        onClick={() => !disabled && setOpen(!open)}
        style={{
          background: "transparent",
          border: "1px solid var(--line)",
          padding: "4px 12px",
          borderRadius: 2,
          fontFamily: "var(--font-mono)",
          fontSize: 10.5,
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          color: disabled ? "var(--fg-faint)" : "var(--fg)",
          cursor: disabled ? "not-allowed" : "pointer",
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        CAT <span style={{ color: "var(--red)" }}>{cur.code}</span> · {cur.label}{" "}
        <span style={{ color: "var(--fg-faint)", fontSize: 9 }}>▾</span>
      </button>
      {open && !disabled && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 4px)",
            left: 0,
            zIndex: 10,
            background: "var(--bg-elevated)",
            border: "1px solid var(--line-strong)",
            minWidth: 240,
            padding: 4,
            borderRadius: 2,
          }}
        >
          {cats.map((c) => (
            <button
              key={c.id}
              onClick={() => {
                setCategory(c.id);
                setOpen(false);
              }}
              style={{
                display: "block",
                width: "100%",
                textAlign: "left",
                background: c.id === category ? "var(--bg-panel)" : "transparent",
                border: "none",
                padding: "8px 12px",
                fontFamily: "var(--font-mono)",
                fontSize: 11,
                letterSpacing: "0.1em",
                color: c.id === category ? "var(--fg)" : "var(--fg-mute)",
                cursor: "pointer",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-panel)")}
              onMouseLeave={(e) =>
                (e.currentTarget.style.background =
                  c.id === category ? "var(--bg-panel)" : "transparent")
              }
            >
              <span style={{ color: "var(--red)" }}>{c.code}</span> · {c.label.toUpperCase()}
              <div
                style={{
                  fontSize: 10,
                  color: "var(--fg-faint)",
                  marginTop: 2,
                  textTransform: "none",
                  letterSpacing: 0,
                }}
              >
                {c.desc}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function IdlePanel({ onBegin, onBeginText, permError }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24, padding: "8px 4px" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <span className="label-mono" style={{ color: "var(--red)" }}>
          SUBJECT INTAKE
        </span>
        <h3
          style={{ fontSize: 36, lineHeight: 1.05, letterSpacing: "-0.02em", color: "var(--fg)" }}
        >
          VERITY will analyze your responses
          <br />
          across four simultaneous streams.
        </h3>
        <p className="body-text" style={{ maxWidth: "56ch" }}>
          On <b style={{ color: "var(--fg)" }}>Start with sensors</b>, your browser will request
          camera and microphone access. Camera frames are processed in your browser. A 15-second
          calibration period collects a personal baseline before the first scenario. Speech
          recognition may use a browser-provider service; model assets require internet access.
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
        {[
          { k: "Webcam", v: "Optional", d: "FACS + rPPG" },
          { k: "Microphone", v: "Optional", d: "Voice + STT" },
          { k: "Duration", v: "~5 min", d: "3 scenarios" },
          { k: "Results", v: "In memory", d: "Current page" },
        ].map((it, i) => (
          <div
            key={i}
            style={{
              padding: 14,
              border: "1px solid var(--line)",
              borderRadius: 2,
              background: "var(--bg-base)",
            }}
          >
            <div className="label-mono-sm" style={{ marginBottom: 6 }}>
              {it.k}
            </div>
            <div className="mono" style={{ fontSize: 16, color: "var(--fg)", marginBottom: 4 }}>
              {it.v}
            </div>
            <div style={{ fontSize: 11, color: "var(--fg-faint)" }}>{it.d}</div>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 16, paddingTop: 8 }}>
        <button className="btn primary" onClick={onBegin}>
          <span
            className="dot live"
            style={{
              background: "#fff",
              boxShadow: "0 0 8px rgba(255,255,255,0.8)",
              animation: "none",
            }}
          ></span>
          Start with sensors
        </button>
        <button className="btn ghost" onClick={onBeginText}>
          Try text-only
        </button>
        <span className="label-mono-sm" style={{ color: "var(--fg-dim)" }}>
          If access is unavailable, the cockpit continues in{" "}
          <span style={{ color: "var(--amber)" }}>TEXT ONLY</span> mode. Missing sensor values stay
          blank.
        </span>
      </div>

      {permError && (
        <div
          style={{
            padding: 14,
            border: "1px solid var(--amber)",
            borderRadius: 2,
            background: "color-mix(in oklch, var(--amber) 6%, transparent)",
          }}
        >
          <span className="label-mono-sm" style={{ color: "var(--amber)" }}>
            SENSOR FALLBACK ENGAGED
          </span>
          <p style={{ marginTop: 8, fontSize: 13.5, color: "var(--fg-mute)" }}>
            {permError}. Continue with a typed response. Sensor values remain unavailable.
          </p>
        </div>
      )}
    </div>
  );
}

function ScenarioBody({
  scenario,
  phase,
  response,
  typedText,
  setTypedText,
  transcript,
  micActive,
  speechSupported,
  speechStatus,
  onMic,
  onSubmit,
  turn,
}) {
  const analyzing = phase === "analyzing";

  const isWhisper = speechStatus.backend === "whisper";
  const sttState = speechStatus.state;
  const isLoading = sttState === "loading";
  const isTranscribing = sttState === "transcribing";

  // Resolve mic button label/state
  let micLabel,
    micDisabled = !speechSupported || analyzing;
  if (isWhisper) {
    if (isLoading) {
      micLabel = `Loading Whisper · ${Math.round((speechStatus.progress || 0) * 100)}%`;
      micDisabled = true;
    } else if (isTranscribing) {
      micLabel = "Transcribing audio…";
      micDisabled = true;
    } else if (micActive) {
      micLabel = "Listening · click to stop";
    } else if (sttState === "failed") {
      micLabel = "Whisper failed to load";
      micDisabled = true;
    } else {
      micLabel = "Start microphone (Whisper)";
    }
  } else if (speechSupported) {
    micLabel = micActive ? "Listening · click to stop" : "Start microphone";
  } else {
    micLabel = "STT unavailable";
  }
  const micIsRecording = micActive;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <span className="pill red">
          <span className="dot" style={{ background: "var(--red)" }}></span> SCENARIO BRIEF
        </span>
        <span className="label-mono-sm" style={{ color: "var(--fg-faint)" }}>
          Turn {turn} of 3 · Read carefully before responding
        </span>
      </div>

      <p
        style={{
          fontSize: 15,
          lineHeight: 1.55,
          color: "var(--fg-mute)",
          padding: "16px 18px",
          background: "var(--bg-base)",
          border: "1px solid var(--line)",
          borderRadius: 2,
        }}
      >
        {scenario.ctx}
      </p>

      <div>
        <span className="label-mono" style={{ color: "var(--red)" }}>
          ► QUESTION
        </span>
        <h2
          style={{
            fontSize: 28,
            lineHeight: 1.18,
            letterSpacing: "-0.018em",
            color: "var(--fg)",
            marginTop: 10,
            fontWeight: 500,
          }}
        >
          {scenario.q}
        </h2>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span className="label-mono">► RESPONSE</span>
          <span className="label-mono-sm" style={{ color: "var(--fg-faint)" }}>
            Type below, or use mic to dictate
          </span>
        </div>

        <div style={{ position: "relative" }}>
          <textarea
            aria-label="Your response"
            value={typedText}
            onChange={(e) => setTypedText(e.target.value)}
            placeholder={
              micIsRecording
                ? "Listening… speak your answer"
                : isTranscribing
                  ? "Decoding speech…"
                  : "Type your answer here, or click the microphone to speak"
            }
            disabled={analyzing}
            style={{
              width: "100%",
              minHeight: 120,
              background: "var(--bg-base)",
              border: "1px solid " + (micIsRecording ? "var(--red)" : "var(--line-strong)"),
              borderRadius: 2,
              padding: 16,
              color: "var(--fg)",
              fontFamily: "var(--font-sans)",
              fontSize: 15,
              lineHeight: 1.55,
              resize: "vertical",
              outline: "none",
              transition: "border-color 200ms",
              boxShadow: micIsRecording ? "0 0 0 1px var(--red), 0 0 20px var(--red-glow)" : "none",
            }}
          />
          {micIsRecording && isWhisper && (
            <div
              style={{
                position: "absolute",
                bottom: 8,
                left: 12,
                right: 12,
                padding: "6px 10px",
                background: "color-mix(in oklch, var(--red) 8%, var(--bg-base))",
                borderLeft: "2px solid var(--red)",
                fontFamily: "var(--font-mono)",
                fontSize: 12,
                color: "var(--fg-mute)",
              }}
            >
              <span style={{ color: "var(--red)", marginRight: 6 }}>● RECORDING</span>
              Whisper will transcribe when you stop.
            </div>
          )}
          {micActive && transcript && !isWhisper && (
            <div
              style={{
                position: "absolute",
                bottom: 8,
                left: 12,
                right: 12,
                padding: "6px 10px",
                background: "color-mix(in oklch, var(--red) 8%, var(--bg-base))",
                borderLeft: "2px solid var(--red)",
                fontFamily: "var(--font-mono)",
                fontSize: 12,
                color: "var(--fg-mute)",
              }}
            >
              <span style={{ color: "var(--red)", marginRight: 6 }}>● LIVE TRANSCRIPT</span>
              {transcript}
            </div>
          )}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 4 }}>
          <button
            className={"btn " + (micIsRecording ? "" : "ghost")}
            onClick={onMic}
            disabled={micDisabled}
            style={
              micIsRecording
                ? { borderColor: "var(--red)", color: "var(--red)" }
                : isLoading || isTranscribing
                  ? { borderColor: "var(--amber)", color: "var(--amber)" }
                  : {}
            }
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
            >
              <rect x="9" y="3" width="6" height="12" rx="3" />
              <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
            </svg>
            {micLabel}
          </button>

          <button
            className="btn primary"
            onClick={onSubmit}
            disabled={analyzing || isTranscribing || (response.length < 3 && !micActive)}
            style={{ marginLeft: "auto" }}
          >
            {analyzing
              ? "Analyzing..."
              : isTranscribing
                ? "Decoding speech..."
                : "Submit for Analysis →"}
          </button>
        </div>
      </div>

      {analyzing && <AnalyzingBars />}
    </div>
  );
}

function AnalyzingBars() {
  const modules = [
    { tag: "TEXT", label: "Scanning linguistic patterns" },
    { tag: "VOICE", label: "Processing speech cadence" },
    { tag: "FACE", label: "Reading facial action units" },
    { tag: "CARDIO", label: "Measuring HR, HRV, blink rate" },
    { tag: "FUSION", label: "Generating credibility score" },
  ];
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 8,
        paddingTop: 8,
        borderTop: "1px solid var(--line)",
      }}
    >
      <span className="label-mono" style={{ color: "var(--amber)" }}>
        <span className="dot warn" style={{ marginRight: 8 }}></span>FUSION ENGINE ENGAGED
      </span>
      {modules.map((m, i) => (
        <div
          key={m.tag}
          style={{
            display: "grid",
            gridTemplateColumns: "70px 1fr 50px",
            gap: 12,
            alignItems: "center",
          }}
        >
          <span
            className="mono"
            style={{ fontSize: 11, color: "var(--red)", letterSpacing: "0.12em" }}
          >
            {m.tag}
          </span>
          <div style={{ position: "relative", height: 4, background: "var(--line)" }}>
            <div className="scan-fill" style={{ animationDelay: i * 0.15 + "s" }} />
          </div>
          <span className="mono" style={{ fontSize: 11, color: "var(--fg-dim)" }}>
            —
          </span>
        </div>
      ))}
    </div>
  );
}

function TurnResult({ result, onNext, isLast }) {
  const decep = result.decep;
  const isDecep = decep > 0.5;
  const animatedDecep = useAnimatedNumber(decep, 1200);
  return (
    <div
      className={isDecep ? "verdict-panel-decep" : "verdict-panel-truth"}
      style={{ display: "flex", flexDirection: "column", gap: 18, padding: 4, borderRadius: 4 }}
    >
      {/* Verdict header */}
      <div
        style={{
          padding: "22px 24px",
          background: isDecep
            ? "color-mix(in oklch, var(--red) 8%, var(--bg-base))"
            : "color-mix(in oklch, var(--green) 8%, var(--bg-base))",
          borderLeft: `3px solid ${isDecep ? "var(--red)" : "var(--green)"}`,
          borderRadius: 2,
          position: "relative",
          overflow: "hidden",
        }}
      >
        <span className="label-mono" style={{ color: isDecep ? "var(--red)" : "var(--green)" }}>
          {isDecep ? "⚠  DECEPTION DETECTED" : "✓  RESPONSE CREDIBLE"}
        </span>
        <h2
          className="verdict-big"
          style={{
            fontSize: 56,
            color: isDecep ? "var(--red)" : "var(--green)",
            marginTop: 8,
            letterSpacing: "-0.025em",
            lineHeight: 1,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {(animatedDecep * 100).toFixed(1)}
          <span style={{ fontSize: 18, color: "var(--fg-faint)", marginLeft: 4 }}>%</span>
          <span
            style={{
              fontSize: 14,
              color: "var(--fg-faint)",
              marginLeft: 14,
              fontFamily: "var(--font-mono)",
              letterSpacing: "0.14em",
            }}
          >
            DECEP · {((1 - animatedDecep) * 100).toFixed(1)}% TRUTH
          </span>
        </h2>
        <div
          style={{
            marginTop: 16,
            height: 6,
            background: "var(--bg-deep)",
            border: "1px solid var(--line)",
            position: "relative",
          }}
        >
          <div
            style={{
              position: "absolute",
              inset: 0,
              right: "auto",
              width: animatedDecep * 100 + "%",
              background: `linear-gradient(90deg, ${isDecep ? "var(--red-bright)" : "var(--green)"}, ${isDecep ? "var(--red)" : "var(--green-deep)"})`,
              boxShadow: `0 0 12px ${isDecep ? "var(--red-glow)" : "var(--green-glow)"}`,
              transition: "width 1200ms cubic-bezier(0.16, 1, 0.3, 1)",
            }}
          />
        </div>
      </div>

      {/* Response summary */}
      <div>
        <span className="label-mono-sm">SUBJECT RESPONSE · TURN {result.turn}</span>
        <p
          style={{
            marginTop: 8,
            fontSize: 14.5,
            lineHeight: 1.6,
            color: "var(--fg-mute)",
            padding: "12px 14px",
            background: "var(--bg-base)",
            border: "1px solid var(--line)",
          }}
        >
          “{result.response || "—"}”
        </p>
      </div>

      {/* Top signals */}
      <div>
        <span className="label-mono-sm">TOP SIGNALS</span>
        <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 6 }}>
          {result.signals.slice(0, 5).map((s, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "8px 12px",
                background: "var(--bg-base)",
                border: "1px solid var(--line-faint)",
              }}
            >
              <span
                style={{ color: s.kind === "warn" ? "var(--red)" : "var(--green)", fontSize: 14 }}
              >
                {s.kind === "warn" ? "⚠" : "✓"}
              </span>
              <span style={{ fontSize: 13, color: "var(--fg-mute)" }}>{s.msg}</span>
            </div>
          ))}
          {result.signals.length === 0 && (
            <div style={{ fontSize: 13, color: "var(--fg-faint)", padding: 12 }}>
              No signals fired.
            </div>
          )}
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end", paddingTop: 8 }}>
        <button className="btn primary" onClick={onNext}>
          {isLast ? "Generate Session Report →" : `Continue to Turn ${result.turn + 1} →`}
        </button>
      </div>
    </div>
  );
}

function FinalReport({ turnLog, sessionId, category, onReset }) {
  const avgDecep = turnLog.reduce((a, t) => a + t.decep, 0) / turnLog.length;
  const deceptiveTurns = turnLog.filter((t) => t.decep > 0.5).length;
  const mostSus = turnLog.reduce((m, t) => (t.decep > m.decep ? t : m), turnLog[0]);

  let verdictColor, verdictLabel, recommendation;
  if (avgDecep >= 0.62) {
    verdictColor = "var(--red)";
    verdictLabel = "HIGH HEURISTIC SCORE";
    recommendation =
      "Several configured rules contributed to a high demonstration score. Review the feature trace below; this result does not establish whether a response is truthful.";
  } else if (avgDecep >= 0.45) {
    verdictColor = "var(--amber)";
    verdictLabel = "INCONCLUSIVE";
    recommendation = `The configured rules produced mixed scores. Turn ${mostSus.turn} received the highest score; inspect its feature trace to understand the calculation.`;
  } else {
    verdictColor = "var(--green)";
    verdictLabel = "LOW HEURISTIC SCORE";
    recommendation =
      "The configured rules produced a low demonstration score. This reflects the heuristic calculation, not verified truthfulness or a recommendation about a person.";
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div
        style={{
          padding: "24px 26px",
          background: `color-mix(in oklch, ${verdictColor} 8%, var(--bg-base))`,
          borderLeft: `3px solid ${verdictColor}`,
        }}
      >
        <span className="label-mono" style={{ color: verdictColor }}>
          OVERALL VERDICT
        </span>
        <h2 style={{ fontSize: 44, color: verdictColor, marginTop: 8, letterSpacing: "-0.025em" }}>
          {verdictLabel}
        </h2>
        <p
          style={{
            marginTop: 10,
            fontSize: 14,
            lineHeight: 1.55,
            color: "var(--fg-mute)",
            maxWidth: "70ch",
          }}
        >
          {recommendation}
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
        <Readout label="Session ID" value={sessionId} size={14} color="var(--fg)" />
        <Readout label="Category" value={category} size={14} color="var(--fg)" />
        <Readout
          label="Avg decep"
          value={(avgDecep * 100).toFixed(1)}
          unit="%"
          size={20}
          color={verdictColor}
        />
        <Readout label="Decep turns" value={`${deceptiveTurns} / 3`} size={20} />
      </div>

      <div>
        <span className="label-mono-sm">TURN-BY-TURN</span>
        <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 6 }}>
          {turnLog.map((t) => (
            <div
              key={t.turn}
              style={{
                display: "grid",
                gridTemplateColumns: "50px 110px 1fr 70px",
                gap: 14,
                alignItems: "center",
                padding: "10px 14px",
                background: "var(--bg-base)",
                border: "1px solid var(--line-faint)",
              }}
            >
              <span className="label-mono">T0{t.turn}</span>
              <span
                className="mono"
                style={{ fontSize: 13, color: t.decep > 0.5 ? "var(--red)" : "var(--green)" }}
              >
                {t.decep > 0.5 ? "● DECEPTIVE" : "● TRUTHFUL"}
              </span>
              <span
                style={{
                  fontSize: 12.5,
                  color: "var(--fg-mute)",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {t.signals[0] ? t.signals[0].msg : "—"}
              </span>
              <span
                className="mono"
                style={{
                  fontSize: 14,
                  color: t.decep > 0.5 ? "var(--red)" : "var(--green)",
                  textAlign: "right",
                }}
              >
                {(t.decep * 100).toFixed(0)}%
              </span>
            </div>
          ))}
        </div>
      </div>

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          paddingTop: 8,
          borderTop: "1px solid var(--line)",
        }}
      >
        <span className="label-mono-sm" style={{ color: "var(--fg-faint)" }}>
          Generated {new Date().toLocaleString()} · VERITY V1.0
        </span>
        <button className="btn" onClick={onReset}>
          Run New Session →
        </button>
      </div>
    </div>
  );
}

function ModalityScore({ label, value, calibrating }) {
  const isDecep = value > 0.5;
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
        <span className="label-mono-sm" style={{ color: "var(--fg-mute)" }}>
          {label}
        </span>
        <span
          className="mono"
          style={{
            fontSize: 11,
            color: calibrating ? "var(--fg-faint)" : isDecep ? "var(--red)" : "var(--green)",
          }}
        >
          {calibrating ? "—" : (value * 100).toFixed(0) + "%"}
        </span>
      </div>
      <MiniBar value={value} max={1} color={isDecep ? "var(--red)" : "var(--green)"} />
    </div>
  );
}

function FeatCell({ name, value, fmt, warn }) {
  let display;
  if (fmt === "pct") display = (value * 100).toFixed(1) + "%";
  else if (fmt === "int") display = Math.round(value).toString();
  else display = value.toFixed(2);
  const color = warn ? "var(--red)" : "var(--fg)";
  return (
    <div>
      <div className="label-mono-sm">{name}</div>
      <div
        className="mono"
        style={{ fontSize: 16, color, marginTop: 2, fontVariantNumeric: "tabular-nums" }}
      >
        {display}
        {warn && <span style={{ color: "var(--red)", marginLeft: 6, fontSize: 11 }}>▲</span>}
      </div>
    </div>
  );
}

function SignalLog({ signals }) {
  return (
    <div style={{ maxHeight: 180, overflowY: "auto", padding: "4px 0" }}>
      {!signals || signals.length === 0 ? (
        <div
          style={{
            padding: "20px 14px",
            color: "var(--fg-faint)",
            fontSize: 12.5,
            textAlign: "center",
          }}
        >
          <div style={{ fontFamily: "var(--font-mono)", letterSpacing: "0.16em" }}>· · ·</div>
          <div style={{ marginTop: 8 }}>No anomalous signals detected.</div>
        </div>
      ) : (
        signals.map((s, i) => (
          <div
            key={i}
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: 10,
              padding: "9px 14px",
              borderBottom: "1px solid var(--line-faint)",
            }}
          >
            <span
              style={{
                color: s.kind === "warn" ? "var(--red)" : "var(--green)",
                fontSize: 13,
                lineHeight: "16px",
              }}
            >
              {s.kind === "warn" ? "⚠" : "✓"}
            </span>
            <span style={{ fontSize: 12.5, color: "var(--fg-mute)", lineHeight: "16px" }}>
              {s.msg}
            </span>
          </div>
        ))
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════
// helpers used by render (live preview scoring)
// ════════════════════════════════════════════════════════

function livePreviewDecep(phys, textFeats, personalBaseline) {
  const result = window.computeDeceptionScoreWithBaseline(textFeats, phys, personalBaseline);
  return result.decep;
}

function estimateModality(kind, dataA, dataB, personalBaseline) {
  if (kind === "text") {
    const result = window.computeDeceptionScoreWithBaseline(dataA, {}, personalBaseline);
    return result.ruleDecep;
  }
  if (kind === "cardio") {
    if (dataB.hr_mean == null || dataB.hrv == null) return 0;
    const pb = personalBaseline || {};
    const baseHR = pb.hr_mean != null ? pb.hr_mean : 74;
    const baseHRV = pb.hrv != null ? pb.hrv : 55;
    const hrNorm = Math.max(0, Math.min(1, (dataB.hr_mean - baseHR) / 14));
    const hrvNorm = Math.max(0, Math.min(1, (baseHRV - dataB.hrv) / 20));
    return (hrNorm + hrvNorm) / 2;
  }
  if (kind === "face") {
    if (dataB.au7_lid_tighten == null) return 0;
    const x =
      (dataB.au7_lid_tighten / 0.42) * 0.45 +
      ((dataB.au4_brow_lower || 0) / 0.35) * 0.35 +
      (1 - (dataB.au12_lip_corner || 0) / 0.55) * 0.2;
    return Math.max(0, Math.min(1, x));
  }
  if (kind === "voice") {
    return Math.max(0, Math.min(1, (dataA.pauseRatio || 0.4) * 0.7));
  }
  return 0.5;
}

function liveDerivedSignals(phys, textFeats, response, calibrating, personalBaseline) {
  if (calibrating) return [{ kind: "ok", msg: "Establishing physiological baseline…" }];
  const sig = [];
  if (response && response.length > 8) {
    const ts = window.deriveTextSignals(textFeats);
    sig.push(...ts);
  }
  const pb = personalBaseline || {};
  if (phys.hr_mean != null && phys.hr_mean > (pb.hr_mean || 74) + 8)
    sig.push({
      kind: "warn",
      msg: `HR +${Math.round(phys.hr_mean - (pb.hr_mean || 74))} bpm above baseline`,
    });
  if (phys.hrv != null && phys.hrv < (pb.hrv || 55) - 10)
    sig.push({
      kind: "warn",
      msg: `HRV ${Math.round((pb.hrv || 55) - phys.hrv)} ms below baseline`,
    });
  if (phys.au7_lid_tighten != null && phys.au7_lid_tighten > 0.28)
    sig.push({ kind: "warn", msg: "AU7 lid tightening sustained" });
  if (phys.au4_brow_lower != null && phys.au4_brow_lower > 0.22)
    sig.push({ kind: "warn", msg: "AU4 brow lowering detected" });
  if (
    phys.hrv != null &&
    phys.hr_mean != null &&
    phys.hrv > (pb.hrv || 55) - 5 &&
    phys.hr_mean < (pb.hr_mean || 74) + 4
  )
    sig.push({ kind: "ok", msg: "Cardiac signature near baseline" });
  if (sig.length === 0) sig.push({ kind: "ok", msg: "All channels within normal range" });
  return sig.slice(0, 6);
}

// Make components available
window.Cockpit = Cockpit;
