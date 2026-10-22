import React, { useState, useEffect, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Play,
  Pause,
  RotateCcw,
  SkipBack,
  SkipForward,
  Compass,
  Cpu,
  Layers,
  Clock,
  Trophy,
  AlertTriangle,
  Volume2,
  VolumeX,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Crosshair,
  ScanSearch,
  LoaderCircle,
} from "lucide-react";
import PuzzleBoardGrid from "./components/PuzzleBoardGrid";
import ArenaView from "./components/ArenaView";
import { Stage, Digits, AnimatedNumber, Segmented, stagger, rise, slideIn, SPRING_SNAP } from "./components/ui";
import { skin, TONE } from "./utils/theme";
import {
  API_BASE,
  PRESETS,
  STRATEGIES,
  calculateInversions,
  getBoardManhattan,
  playTickSound,
} from "./utils/puzzleHelpers";
import "./App.css";

export default function App() {
  const [viewMode, setViewMode] = useState("studio");
  const [inputStr, setInputStr] = useState("1,2,5,3,4,0,6,7,8");
  const [algorithm, setAlgorithm] = useState("iddfs");
  const [maxDepth, setMaxDepth] = useState(35);

  const [result, setResult] = useState(null);
  const [arenaResults, setArenaResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const [playbackMode, setPlaybackMode] = useState("goal");
  const [currentStep, setCurrentStep] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [soundEnabled, setSoundEnabled] = useState(true);

  const timerRef = useRef(null);

  const parsedBoard = useMemo(() => {
    const nums = inputStr
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s !== "")
      .map(Number);
    if (
      nums.length === 9 &&
      nums.every((n) => !Number.isNaN(n) && n >= 0 && n <= 8) &&
      new Set(nums).size === 9
    ) {
      return nums;
    }
    return null;
  }, [inputStr]);

  const inversions = useMemo(
    () => (parsedBoard ? calculateInversions(parsedBoard) : 0),
    [parsedBoard]
  );
  const isSolvable = parsedBoard ? inversions % 2 === 0 : false;

  const activeSteps = useMemo(() => {
    if (!result) return [];
    if (
      playbackMode === "expansion" &&
      result.algorithm !== "DFS" &&
      result.expanded_steps?.length > 0
    ) {
      return result.expanded_steps;
    }
    return result.traceable_steps || [];
  }, [result, playbackMode]);

  const currentBoard = useMemo(() => {
    if (activeSteps.length > 0) {
      const safeIdx = Math.min(currentStep, activeSteps.length - 1);
      return activeSteps[safeIdx].board;
    }
    return parsedBoard || [1, 2, 5, 3, 4, 0, 6, 7, 8];
  }, [activeSteps, currentStep, parsedBoard]);

  const currentActionLabel = useMemo(() => {
    if (activeSteps.length > 0) {
      const safeIdx = Math.min(currentStep, activeSteps.length - 1);
      return activeSteps[safeIdx].action;
    }
    return "Initial";
  }, [activeSteps, currentStep]);

  const liveHeuristic = useMemo(() => getBoardManhattan(currentBoard), [currentBoard]);

  useEffect(() => {
    if (!isPlaying || activeSteps.length === 0 || viewMode !== "studio") {
      clearInterval(timerRef.current);
      return;
    }
    const intervalMs = Math.max(16, Math.round(420 / speed));
    timerRef.current = setInterval(() => {
      setCurrentStep((prev) => {
        if (prev >= activeSteps.length - 1) {
          setIsPlaying(false);
          playTickSound(soundEnabled, 580);
          return prev;
        }
        playTickSound(soundEnabled, playbackMode === "expansion" ? 280 : 360);
        return prev + 1;
      });
    }, intervalMs);
    return () => clearInterval(timerRef.current);
  }, [isPlaying, speed, activeSteps, soundEnabled, playbackMode, viewMode]);

  const handleRunSearch = async () => {
    if (!parsedBoard) {
      setErrorMsg("Please enter a valid 9-number board containing digits 0 through 8.");
      return;
    }
    setErrorMsg("");
    setLoading(true);
    setIsPlaying(false);
    try {
      const response = await fetch(`${API_BASE}/api/solve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          initial_state: parsedBoard,
          algorithm,
          max_depth: Number(maxDepth) || 35,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || "Failed to solve puzzle.");
      if (data.algorithm === "DFS") setPlaybackMode("goal");
      setResult(data);
      setCurrentStep(0);
      setViewMode("studio");
    } catch (err) {
      setErrorMsg(err.message || "Error connecting to FastAPI backend.");
    } finally {
      setLoading(false);
    }
  };

  const handleRunArena = async () => {
    if (!parsedBoard) {
      setErrorMsg("Please enter a valid 9-number board containing digits 0 through 8.");
      return;
    }
    setErrorMsg("");
    setLoading(true);
    setIsPlaying(false);
    try {
      const response = await fetch(`${API_BASE}/api/benchmark`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          initial_state: parsedBoard,
          algorithm: "all",
          max_depth: Number(maxDepth) || 35,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || "Arena benchmark failed.");
      const list = Array.isArray(data.benchmarks) ? data.benchmarks : [];
      setArenaResults(list);
      setViewMode("arena");
    } catch (err) {
      setErrorMsg(err.message || "Error running Arena Race.");
    } finally {
      setLoading(false);
    }
  };

  const sequenceWindow = useMemo(() => {
    if (!activeSteps || activeSteps.length <= 1) return { items: [], total: 0 };
    const total = activeSteps.length - 1;
    const windowRadius = 30;
    const start = Math.max(playbackMode === "expansion" ? 0 : 1, currentStep - windowRadius);
    const end = Math.min(activeSteps.length - 1, currentStep + windowRadius);
    const items = [];
    for (let i = start; i <= end; i++) items.push(activeSteps[i]);
    return { items, total: playbackMode === "expansion" ? activeSteps.length : total };
  }, [activeSteps, currentStep, playbackMode]);

  /* ---- presentation-only derived values (no engine state touched) ---- */
  const [dockOpen, setDockOpen] = useState(true);
  const maxStep = Math.max(0, activeSteps.length - 1);
  const scrubPct = maxStep > 0 ? (currentStep / maxStep) * 100 : 0;
  const h0 = Math.max(1, getBoardManhattan(activeSteps[0]?.board || parsedBoard || currentBoard));
  const hRatio = Math.min(1, liveHeuristic / h0);
  const emerald = TONE.emerald;

  return (
    <div className="app">
      <Stage />

      <div className="shell">
        <motion.header
          className="topbar"
          initial={{ opacity: 0, y: -26 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 110, damping: 18 }}
        >
          <div className="brand">
            <AnimatePresence initial={false}>
              {viewMode === "arena" && (
                <motion.button
                  key="back"
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => setViewMode("studio")}
                  initial={{ opacity: 0, x: -24, scale: 0.8 }}
                  animate={{ opacity: 1, x: 0, scale: 1 }}
                  exit={{ opacity: 0, x: -24, scale: 0.8 }}
                  whileTap={{ scale: 0.95 }}
                  transition={SPRING_SNAP}
                >
                  <ArrowLeft size={14} /> Studio
                </motion.button>
              )}
            </AnimatePresence>
            <div className="glyph" aria-hidden="true">
              {currentBoard.map((v, i) => (
                <i key={i} className={v === 0 ? "void" : v === i ? "hot" : ""} />
              ))}
            </div>
            <div>
              <h1 className="title">
                Eight-Puzzle<em>search studio</em>
              </h1>
              <div className="brand-sub">Alexandria University · AI Lab · State-space observatory</div>
            </div>
          </div>

          <div className="bar-actions">
            <span className="eyebrow" style={{ gap: 8 }}>
              <span className="live-dot" style={loading ? { background: TONE.amber, boxShadow: `0 0 12px ${TONE.amber}` } : undefined} />
              {loading ? "Solving" : "Standby"}
            </span>
            <motion.button
              type="button"
              className="btn btn-ghost"
              onClick={() => setSoundEnabled(!soundEnabled)}
              whileTap={{ scale: 0.94 }}
              style={{ color: soundEnabled ? emerald : undefined }}
            >
              {soundEnabled ? <Volume2 size={15} /> : <VolumeX size={15} />}
              {soundEnabled ? "Audio On" : "Muted"}
            </motion.button>
          </div>
        </motion.header>

        <AnimatePresence>
          {errorMsg && (
            <motion.div
              key="err"
              className="alert"
              initial={{ opacity: 0, height: 0, marginBottom: 0, x: -30 }}
              animate={{ opacity: 1, height: "auto", marginBottom: 22, x: 0 }}
              exit={{ opacity: 0, height: 0, marginBottom: 0, x: 30 }}
              transition={{ type: "spring", stiffness: 160, damping: 20 }}
            >
              <AlertTriangle size={16} color={TONE.ember} />
              <span>{errorMsg}</span>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence mode="wait">
          {viewMode === "arena" ? (
            <motion.div
              key="arena"
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -30 }}
              transition={{ type: "spring", stiffness: 100, damping: 20 }}
            >
              <ArenaView
                arenaResults={arenaResults}
                inputStr={inputStr}
                parsedBoard={parsedBoard}
                isSolvable={isSolvable}
                soundEnabled={soundEnabled}
                onBack={() => setViewMode("studio")}
              />
            </motion.div>
          ) : (
            <motion.main
              key="studio"
              className={`studio ${dockOpen ? "" : "collapsed"}`}
              variants={stagger(0.12)}
              initial="hidden"
              animate="show"
              exit="exit"
            >
              {/* ───────── Floating command dock ───────── */}
              <motion.aside className="glass z2 dock" variants={slideIn(-60)}>
                <div className="dock-head">
                  {dockOpen && (
                    <motion.div className="eyebrow" style={{ flex: 1, marginRight: 12 }} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                      <b>01</b> Command dock
                    </motion.div>
                  )}
                  <motion.button
                    type="button"
                    className="dock-toggle"
                    onClick={() => setDockOpen((o) => !o)}
                    whileTap={{ scale: 0.88 }}
                    aria-label={dockOpen ? "Collapse command dock" : "Expand command dock"}
                  >
                    {dockOpen ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
                  </motion.button>
                </div>

                <AnimatePresence mode="wait" initial={false}>
                  {dockOpen ? (
                    <motion.div
                      key="open"
                      initial={{ opacity: 0, x: -24 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -24 }}
                      transition={{ duration: 0.22 }}
                    >
                      <div className="field-label">
                        <span className="eyebrow" style={{ flex: "none" }}>
                          Initial configuration
                        </span>
                        <motion.span
                          key={isSolvable ? "ok" : "bad"}
                          className={`verdict ${isSolvable ? "ok" : "bad"}`}
                          initial={{ scale: 0.7, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          transition={SPRING_SNAP}
                        >
                          Inversions: {inversions} ({isSolvable ? "SOLVABLE" : "UNSOLVABLE"})
                        </motion.span>
                      </div>

                      <input
                        type="text"
                        className={`board-input ${parsedBoard ? "" : "invalid"}`}
                        value={inputStr}
                        onChange={(e) => setInputStr(e.target.value)}
                        spellCheck={false}
                        aria-label="Initial board as nine comma separated numbers"
                      />

                      <div style={{ display: "flex", flexDirection: "column", gap: 2, marginTop: 14 }}>
                        {PRESETS.map((preset) => (
                          <motion.button
                            key={preset.label}
                            type="button"
                            className="preset"
                            onClick={() => {
                              setInputStr(preset.state);
                              setResult(null);
                              setCurrentStep(0);
                              setIsPlaying(false);
                            }}
                            whileTap={{ scale: 0.97 }}
                          >
                            <b>{preset.label}</b>
                            <span>{preset.state}</span>
                          </motion.button>
                        ))}
                      </div>

                      <div className="eyebrow" style={{ margin: "28px 0 12px" }}>
                        <b>02</b> Search strategy
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        {STRATEGIES.map((strat) => {
                          const selected = algorithm === strat.id;
                          return (
                            <motion.button
                              key={strat.id}
                              type="button"
                              className="strat"
                              style={{ "--c": skin(strat.color) }}
                              onClick={() => setAlgorithm(strat.id)}
                              whileHover={{ x: 5 }}
                              whileTap={{ scale: 0.98 }}
                              transition={SPRING_SNAP}
                            >
                              {selected && <motion.span layoutId="strat-sel" className="sel" transition={SPRING_SNAP} />}
                              <div>
                                <div className="name">{strat.name}</div>
                                <div className="desc">{strat.desc}</div>
                              </div>
                              <span className="orb" />
                            </motion.button>
                          );
                        })}
                      </div>

                      <div className="cta-row">
                        <motion.button
                          type="button"
                          className="btn btn-primary"
                          onClick={handleRunSearch}
                          disabled={loading || !isSolvable}
                          whileHover={{ y: -2 }}
                          whileTap={{ scale: 0.97 }}
                        >
                          {loading ? (
                            <>
                              <motion.span animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: "linear" }} style={{ display: "grid" }}>
                                <LoaderCircle size={15} />
                              </motion.span>
                              Solving…
                            </>
                          ) : (
                            "Run Search & Trace"
                          )}
                        </motion.button>
                        <motion.button
                          type="button"
                          className="btn btn-amber"
                          onClick={handleRunArena}
                          disabled={loading || !isSolvable}
                          whileHover={{ y: -2 }}
                          whileTap={{ scale: 0.97 }}
                        >
                          <Trophy size={15} /> Arena Race
                        </motion.button>
                      </div>
                    </motion.div>
                  ) : (
                    <motion.div
                      key="rail"
                      className="dock-rail"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.22 }}
                    >
                      <span className="vertical">Command dock</span>
                      {STRATEGIES.map((s) => (
                        <motion.span
                          key={s.id}
                          className="rail-dot"
                          title={s.name}
                          onClick={() => setAlgorithm(s.id)}
                          style={{ background: skin(s.color), cursor: "pointer" }}
                          animate={{
                            scale: algorithm === s.id ? 1.5 : 0.8,
                            boxShadow: algorithm === s.id ? `0 0 16px ${skin(s.color)}` : "0 0 0 transparent",
                            opacity: algorithm === s.id ? 1 : 0.45,
                          }}
                        />
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.aside>

              {/* ───────── Centre stage ───────── */}
              <motion.section className="centre" variants={rise}>
                <div className="hero-num" aria-hidden="true">
                  <Digits value={currentStep} />
                </div>

                <div className="centre-top">
                  <div className="centre-meta">
                    <div className="step-line">
                      STEP: <b>{currentStep}</b> /{" "}
                      {Math.max(0, activeSteps.length - 1)}
                    </div>

                    {result && result.algorithm !== "DFS" && (
                      <Segmented
                        layoutKey="playback"
                        accent={playbackMode === "goal" ? emerald : TONE.amber}
                        value={playbackMode}
                        onChange={(mode) => {
                          setPlaybackMode(mode);
                          setCurrentStep(0);
                          setIsPlaying(false);
                        }}
                        options={[
                          {
                            value: "goal",
                            label: (
                              <>
                                <Crosshair size={12} /> Goal path ({Math.max(0, (result.traceable_steps?.length || 1) - 1)})
                              </>
                            ),
                          },
                          {
                            value: "expansion",
                            label: (
                              <>
                                <ScanSearch size={12} /> Live expansion ({result.expanded_steps?.length || 0})
                              </>
                            ),
                          },
                        ]}
                      />
                    )}

                    <AnimatePresence>
                      {result && (
                        <motion.div
                          key="action"
                          className="action-chip"
                          initial={{ opacity: 0, x: 24 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: 24 }}
                        >
                          Action:{" "}
                          <motion.span
                            key={currentActionLabel}
                            initial={{ opacity: 0, y: -8 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ type: "spring", stiffness: 500, damping: 30 }}
                          >
                            {currentActionLabel}
                          </motion.span>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  <div className="dial" title="Live Manhattan heuristic relative to the start of this trace">
                    <svg viewBox="0 0 112 112" width="112" height="112">
                      <defs>
                        <linearGradient id="dialgrad" x1="0" y1="0" x2="1" y2="1">
                          <stop offset="0" stopColor={TONE.cyan} />
                          <stop offset="1" stopColor={emerald} />
                        </linearGradient>
                      </defs>
                      <circle cx="56" cy="56" r="53" fill="none" stroke="rgba(255,255,255,0.22)" strokeWidth="3" strokeDasharray="1 5.35" />
                      <g transform="rotate(-90 56 56)">
                        <circle cx="56" cy="56" r="44" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="5" />
                        <motion.circle
                          cx="56"
                          cy="56"
                          r="44"
                          fill="none"
                          stroke="url(#dialgrad)"
                          strokeWidth="5"
                          strokeLinecap="round"
                          initial={{ pathLength: 0 }}
                          animate={{ pathLength: Math.max(0.015, hRatio) }}
                          transition={{ type: "spring", stiffness: 70, damping: 16 }}
                          style={{ filter: "drop-shadow(0 0 6px rgba(46,230,166,0.8))" }}
                        />
                      </g>
                    </svg>
                    <div className="dial-core">
                      <div>
                        <b>
                          <Digits value={liveHeuristic} />
                        </b>
                        <span>LIVE h(n)</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="board-zone">
                  <div className="board-halo" />
                  <PuzzleBoardGrid board={currentBoard} size={360} animateLayout={speed <= 2.5} />
                </div>
              </motion.section>

              {/* ───────── Telemetry column ───────── */}
              <motion.aside className="glass z3 telemetry" variants={slideIn(60)}>
                <div className="eyebrow">
                  <b>03</b> Deliverable telemetry
                </div>
                <div className="metric-grid">
                  <MetricCard
                    icon={<Compass size={13} />}
                    label="Cost of Path"
                    value={result ? result.cost_of_path : null}
                    color="#2ee6a6"
                    fill={result ? Math.min(1, result.cost_of_path / 31) : 0}
                  />
                  <MetricCard
                    icon={<Cpu size={13} />}
                    label="Nodes Expanded"
                    value={result ? result.nodes_expanded : null}
                    color="#3df2ff"
                    fill={result ? Math.min(1, Math.log10(result.nodes_expanded + 1) / 6) : 0}
                  />
                  <MetricCard
                    icon={<Layers size={13} />}
                    label="Search Depth"
                    value={result ? result.search_depth : null}
                    sub={result && result.max_search_depth !== undefined ? `Max ${Number(result.max_search_depth).toLocaleString()}` : null}
                    color="#dcc9a0"
                    fill={result && result.max_search_depth ? Math.min(1, result.search_depth / result.max_search_depth) : 0}
                  />
                  <MetricCard
                    icon={<Clock size={13} />}
                    label="Running Time"
                    value={result ? result.running_time_ms : null}
                    suffix="ms"
                    color="#f0922b"
                    fill={result ? Math.min(1, Math.log10(Number(result.running_time_ms) + 1) / 4) : 0}
                  />
                </div>

                <div className="seq">
                  <div className="seq-head">
                    <span>Sequence Window</span>
                    {sequenceWindow.items?.length > 0 && <b>Total: {sequenceWindow.total}</b>}
                  </div>
                  {sequenceWindow.items?.length > 0 ? (
                    <div className="seq-list">
                      {sequenceWindow.items.map((stepObj) => {
                        const on = stepObj.step_number === currentStep;
                        return (
                          <motion.button
                            key={stepObj.step_number}
                            type="button"
                            className={`chip ${on ? "on" : ""}`}
                            initial={{ opacity: 0, scale: 0.7 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ type: "spring", stiffness: 380, damping: 26 }}
                            whileHover={{ y: -2 }}
                            whileTap={{ scale: 0.92 }}
                            onClick={() => {
                              setIsPlaying(false);
                              setCurrentStep(stepObj.step_number);
                            }}
                          >
                            {on && <motion.span layoutId="seq-active" className="chip-pill" transition={SPRING_SNAP} />}
                            <span>
                              {stepObj.step_number}. {stepObj.action}
                            </span>
                          </motion.button>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="empty-note">AWAITING TRACE — run a search to populate the move ledger.</div>
                  )}
                </div>
              </motion.aside>
            </motion.main>
          )}
        </AnimatePresence>
      </div>

      {/* ───────── Floating DVR dock (studio only) ───────── */}
      <AnimatePresence>
        {viewMode === "studio" && (
          <motion.div
            key="dvr"
            className="dvr-wrap"
            initial={{ y: 140, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 140, opacity: 0 }}
            transition={{ type: "spring", stiffness: 90, damping: 16, delay: 0.35 }}
          >
            <div className="glass z3 dvr">
              <div className="dvr-time">
                <span>
                  <span className="live-dot" style={{ display: "inline-block", marginRight: 8, opacity: isPlaying ? 1 : 0.3 }} />
                  DVR · {isPlaying ? "Playing" : "Paused"}
                </span>
                <span>
                  {currentStep} / {maxStep}
                </span>
              </div>
              <input
                type="range"
                className="scrub"
                style={{ "--p": `${scrubPct}%` }}
                min={0}
                max={Math.max(0, activeSteps.length - 1)}
                value={currentStep}
                onChange={(e) => {
                  setIsPlaying(false);
                  setCurrentStep(Number(e.target.value));
                }}
                aria-label="Playback scrubber"
              />
              <div className="dvr-row">
                <motion.button type="button" className="btn btn-ghost btn-icon" whileTap={{ scale: 0.88, rotate: -90 }} onClick={() => { setIsPlaying(false); setCurrentStep(0); }} aria-label="Restart">
                  <RotateCcw size={15} />
                </motion.button>
                <motion.button type="button" className="btn btn-ghost btn-icon" whileTap={{ scale: 0.88, x: -3 }} onClick={() => { setIsPlaying(false); setCurrentStep((s) => Math.max(0, s - 1)); }} aria-label="Step back">
                  <SkipBack size={15} />
                </motion.button>
                <motion.button
                  type="button"
                  className="btn btn-primary play"
                  whileHover={{ y: -2 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => {
                    if (activeSteps.length <= 1) return;
                    if (currentStep >= activeSteps.length - 1) setCurrentStep(0);
                    setIsPlaying(!isPlaying);
                  }}
                >
                  <AnimatePresence mode="wait" initial={false}>
                    <motion.span
                      key={isPlaying ? "p" : "g"}
                      style={{ display: "grid" }}
                      initial={{ opacity: 0, rotate: -90, scale: 0.5 }}
                      animate={{ opacity: 1, rotate: 0, scale: 1 }}
                      exit={{ opacity: 0, rotate: 90, scale: 0.5 }}
                      transition={{ duration: 0.16 }}
                    >
                      {isPlaying ? <Pause size={15} /> : <Play size={15} />}
                    </motion.span>
                  </AnimatePresence>
                  {isPlaying ? "PAUSE" : "PLAY"}
                </motion.button>
                <motion.button type="button" className="btn btn-ghost btn-icon" whileTap={{ scale: 0.88, x: 3 }} onClick={() => { setIsPlaying(false); setCurrentStep((s) => Math.min(activeSteps.length - 1, s + 1)); }} aria-label="Step forward">
                  <SkipForward size={15} />
                </motion.button>
                <Segmented
                  layoutKey="speed"
                  small
                  value={speed}
                  onChange={(v) => setSpeed(Number(v))}
                  options={[
                    { value: 0.5, label: "0.5×", title: "0.5x Slow" },
                    { value: 1, label: "1×", title: "1.0x Normal" },
                    { value: 2.5, label: "2.5×", title: "2.5x Fast" },
                    { value: 10, label: "10×", title: "10x Turbo" },
                  ]}
                />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function MetricCard({ icon, label, value, suffix, sub, color, fill = 0 }) {
  const has = value !== null && value !== undefined;
  const numVal = Number(value);
  const isNum = has && Number.isFinite(numVal);
  const strLen = has
    ? isNum
      ? numVal.toLocaleString().length + (suffix ? suffix.length + 1 : 0)
      : String(value).length + (suffix ? suffix.length + 1 : 0)
    : 0;
  const isLarge = strLen >= 7;
  const isHuge = strLen >= 10;

  return (
    <div className="metric" style={{ "--mc": color }}>
      <div className="metric-k">
        <div className="metric-k-left">
          {icon}
          <span>{label}</span>
        </div>
        {has && sub && <span className="metric-k-sub">{sub}</span>}
      </div>
      <div className={`metric-v ${has ? "" : "empty"} ${isHuge ? "huge" : isLarge ? "large" : ""}`}>
        {has ? <AnimatedNumber value={value} /> : "—"}
        {has && suffix && <small className="metric-unit">{suffix}</small>}
      </div>
      <div className="metric-bar">
        <motion.i
          initial={{ width: 0 }}
          animate={{ width: `${Math.max(0, fill) * 100}%` }}
          transition={{ type: "spring", stiffness: 60, damping: 16 }}
        />
      </div>
    </div>
  );
}
