import React, { useState, useEffect, useMemo, useRef } from "react";
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
  Sparkles,
  Volume2,
  VolumeX,
  ArrowLeft,
} from "lucide-react";
import PuzzleBoardGrid from "./components/PuzzleBoardGrid";
import ArenaView from "./components/ArenaView";
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

  return (
    <div
      style={{
        minHeight: "100vh",
        backgroundColor: "#070b14",
        color: "#f8fafc",
        fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
        padding: "22px 26px",
        boxSizing: "border-box",
      }}
    >
      <header
        style={{
          maxWidth: "1480px",
          margin: "0 auto 20px auto",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          borderBottom: "1px solid #1e293b",
          paddingBottom: "14px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          {viewMode === "arena" && (
            <button
              onClick={() => setViewMode("studio")}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                padding: "7px 14px",
                borderRadius: "8px",
                backgroundColor: "rgba(16, 185, 129, 0.14)",
                border: "1px solid #10b981",
                color: "#34d399",
                fontWeight: 700,
                fontSize: "12px",
                cursor: "pointer",
              }}
            >
              <ArrowLeft size={15} /> Back to Studio
            </button>
          )}
          <Sparkles size={22} color="#10b981" />
          <h1 style={{ fontSize: "20px", fontWeight: 800, margin: 0 }}>
            8-Puzzle AI Search Studio
          </h1>
          <span
            style={{
              fontSize: "11px",
              padding: "3px 9px",
              borderRadius: "999px",
              backgroundColor: "rgba(16, 185, 129, 0.12)",
              color: "#10b981",
              border: "1px solid rgba(16, 185, 129, 0.3)",
              fontFamily: "monospace",
            }}
          >
            Alexandria University • AI Lab
          </span>
        </div>

        <button
          onClick={() => setSoundEnabled(!soundEnabled)}
          style={{
            background: "#111827",
            border: "1px solid #1e293b",
            color: soundEnabled ? "#10b981" : "#64748b",
            borderRadius: "8px",
            padding: "7px 12px",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "6px",
            fontSize: "12px",
          }}
        >
          {soundEnabled ? <Volume2 size={15} /> : <VolumeX size={15} />}
          {soundEnabled ? "Audio On" : "Muted"}
        </button>
      </header>

      {errorMsg && (
        <div
          style={{
            maxWidth: "1480px",
            margin: "0 auto 16px auto",
            padding: "12px 16px",
            borderRadius: "10px",
            backgroundColor: "rgba(239, 68, 68, 0.12)",
            border: "1px solid rgba(239, 68, 68, 0.4)",
            color: "#fca5a5",
            display: "flex",
            alignItems: "center",
            gap: "10px",
            fontSize: "13px",
          }}
        >
          <AlertTriangle size={16} color="#ef4444" />
          <span>{errorMsg}</span>
        </div>
      )}

      {viewMode === "arena" ? (
        <ArenaView
          arenaResults={arenaResults}
          inputStr={inputStr}
          parsedBoard={parsedBoard}
          isSolvable={isSolvable}
          soundEnabled={soundEnabled}
          onBack={() => setViewMode("studio")}
        />
      ) : (
        <div
          style={{
            maxWidth: "1480px",
            margin: "0 auto",
            display: "grid",
            gridTemplateColumns: "360px 1fr 380px",
            gap: "20px",
            alignItems: "start",
          }}
        >
          {/* Left Column */}
          <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
            <div style={cardStyle}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "14px" }}>
                <span style={sectionHeaderStyle}>1. INITIAL CONFIGURATION</span>
                <span
                  style={{
                    fontSize: "11px",
                    fontFamily: "monospace",
                    padding: "4px 10px",
                    borderRadius: "999px",
                    backgroundColor: isSolvable
                      ? "rgba(16, 185, 129, 0.12)"
                      : "rgba(239, 68, 68, 0.15)",
                    color: isSolvable ? "#10b981" : "#f87171",
                  }}
                >
                  Inversions: {inversions} ({isSolvable ? "SOLVABLE" : "UNSOLVABLE"})
                </span>
              </div>

              <input
                type="text"
                value={inputStr}
                onChange={(e) => setInputStr(e.target.value)}
                style={{
                  width: "100%",
                  boxSizing: "border-box",
                  padding: "12px 14px",
                  backgroundColor: "#090d16",
                  border: "1px solid #10b981",
                  borderRadius: "10px",
                  color: "#34d399",
                  fontFamily: "monospace",
                  fontSize: "15px",
                  fontWeight: 600,
                  marginBottom: "14px",
                }}
              />

              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {PRESETS.map((preset) => (
                  <button
                    key={preset.label}
                    onClick={() => {
                      setInputStr(preset.state);
                      setResult(null);
                      setCurrentStep(0);
                      setIsPlaying(false);
                    }}
                    style={{
                      width: "100%",
                      padding: "9px 12px",
                      backgroundColor: "#161f33",
                      border: "1px solid #26324d",
                      borderRadius: "8px",
                      color: "#e2e8f0",
                      cursor: "pointer",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <span style={{ fontSize: "11px", fontWeight: 600 }}>{preset.label}</span>
                    <span style={{ fontSize: "10px", color: "#34d399", fontFamily: "monospace" }}>
                      {preset.state}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div style={cardStyle}>
              <div style={{ ...sectionHeaderStyle, marginBottom: "12px" }}>2. SEARCH STRATEGY</div>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {STRATEGIES.map((strat) => {
                  const selected = algorithm === strat.id;
                  return (
                    <div
                      key={strat.id}
                      onClick={() => setAlgorithm(strat.id)}
                      style={{
                        padding: "11px 14px",
                        borderRadius: "10px",
                        backgroundColor: selected ? "rgba(16, 185, 129, 0.1)" : "#141c2e",
                        border: selected ? "1px solid #10b981" : "1px solid #1e293b",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        cursor: "pointer",
                      }}
                    >
                      <div>
                        <div style={{ fontSize: "13px", fontWeight: 700 }}>{strat.name}</div>
                        <div style={{ fontSize: "11px", color: "#64748b" }}>{strat.desc}</div>
                      </div>
                      <span
                        style={{
                          width: "9px",
                          height: "9px",
                          borderRadius: "50%",
                          backgroundColor: strat.color,
                        }}
                      />
                    </div>
                  );
                })}
              </div>

              <div style={{ display: "flex", gap: "10px", marginTop: "16px" }}>
                <button
                  onClick={handleRunSearch}
                  disabled={loading || !isSolvable}
                  style={{
                    flex: 1,
                    padding: "12px",
                    borderRadius: "10px",
                    border: "none",
                    backgroundColor: !isSolvable ? "#334155" : "#10b981",
                    color: "#052e16",
                    fontWeight: 700,
                    fontSize: "13px",
                    cursor: !isSolvable ? "not-allowed" : "pointer",
                  }}
                >
                  {loading ? "Solving..." : "Run Search & Trace"}
                </button>

                <button
                  onClick={handleRunArena}
                  disabled={loading || !isSolvable}
                  style={{
                    padding: "12px 16px",
                    borderRadius: "10px",
                    border: "1px solid #f59e0b",
                    backgroundColor: "rgba(245, 158, 11, 0.18)",
                    color: "#fbbf24",
                    fontWeight: 700,
                    fontSize: "13px",
                    cursor: !isSolvable ? "not-allowed" : "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                  }}
                >
                  <Trophy size={15} /> Arena Race
                </button>
              </div>
            </div>
          </div>

          {/* Center Column */}
          <div
            style={{
              ...cardStyle,
              padding: "20px 24px",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              minHeight: "610px",
            }}
          >
            <div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontFamily: "monospace",
                  fontSize: "12px",
                  marginBottom: "14px",
                }}
              >
                <span style={{ color: "#94a3b8" }}>
                  STEP: <strong style={{ color: "#f8fafc" }}>{currentStep}</strong> /{" "}
                  {Math.max(0, activeSteps.length - 1)}
                </span>
                <span style={{ color: "#10b981", fontWeight: 600 }}>
                  LIVE h(n) = {liveHeuristic}
                </span>
              </div>

              {result && result.algorithm !== "DFS" && (
                <div style={{ display: "flex", gap: "8px", justifyContent: "center", marginBottom: "12px" }}>
                  <button
                    onClick={() => {
                      setPlaybackMode("goal");
                      setCurrentStep(0);
                      setIsPlaying(false);
                    }}
                    style={{
                      padding: "7px 14px",
                      borderRadius: "8px",
                      border: playbackMode === "goal" ? "1px solid #10b981" : "1px solid #26324d",
                      backgroundColor: playbackMode === "goal" ? "rgba(16, 185, 129, 0.16)" : "#141c2e",
                      color: playbackMode === "goal" ? "#10b981" : "#94a3b8",
                      fontSize: "12px",
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    🎯 Goal Path ({Math.max(0, (result.traceable_steps?.length || 1) - 1)} moves)
                  </button>
                  <button
                    onClick={() => {
                      setPlaybackMode("expansion");
                      setCurrentStep(0);
                      setIsPlaying(false);
                    }}
                    style={{
                      padding: "7px 14px",
                      borderRadius: "8px",
                      border: playbackMode === "expansion" ? "1px solid #f59e0b" : "1px solid #26324d",
                      backgroundColor: playbackMode === "expansion" ? "rgba(245, 158, 11, 0.16)" : "#141c2e",
                      color: playbackMode === "expansion" ? "#fbbf24" : "#94a3b8",
                      fontSize: "12px",
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    🔍 Live Expansion ({result.expanded_steps?.length || 0} frames)
                  </button>
                </div>
              )}

              {result && (
                <div style={{ textAlign: "center", marginBottom: "8px", fontFamily: "monospace", fontSize: "12px", color: "#60a5fa" }}>
                  Action: {currentActionLabel}
                </div>
              )}
            </div>

            <PuzzleBoardGrid board={currentBoard} size={310} animateLayout={speed <= 2.5} />

            <div>
              <input
                type="range"
                min={0}
                max={Math.max(0, activeSteps.length - 1)}
                value={currentStep}
                onChange={(e) => {
                  setIsPlaying(false);
                  setCurrentStep(Number(e.target.value));
                }}
                style={{ width: "100%", accentColor: "#10b981", cursor: "pointer", marginBottom: "12px" }}
              />
              <div style={{ display: "flex", justifyContent: "center", gap: "8px" }}>
                <button onClick={() => { setIsPlaying(false); setCurrentStep(0); }} style={dvrBtnStyle}>
                  <RotateCcw size={15} />
                </button>
                <button onClick={() => { setIsPlaying(false); setCurrentStep((s) => Math.max(0, s - 1)); }} style={dvrBtnStyle}>
                  <SkipBack size={15} />
                </button>
                <button
                  onClick={() => {
                    if (activeSteps.length <= 1) return;
                    if (currentStep >= activeSteps.length - 1) setCurrentStep(0);
                    setIsPlaying(!isPlaying);
                  }}
                  style={{
                    padding: "8px 18px",
                    borderRadius: "8px",
                    border: "none",
                    backgroundColor: "#10b981",
                    color: "#052e16",
                    fontWeight: 800,
                    fontSize: "12px",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                  }}
                >
                  {isPlaying ? <Pause size={15} /> : <Play size={15} />}
                  {isPlaying ? "PAUSE" : "PLAY"}
                </button>
                <button onClick={() => { setIsPlaying(false); setCurrentStep((s) => Math.min(activeSteps.length - 1, s + 1)); }} style={dvrBtnStyle}>
                  <SkipForward size={15} />
                </button>
                <select
                  value={speed}
                  onChange={(e) => setSpeed(Number(e.target.value))}
                  style={{
                    backgroundColor: "#141c2e",
                    color: "#e2e8f0",
                    border: "1px solid #26324d",
                    borderRadius: "8px",
                    padding: "7px 10px",
                    fontSize: "12px",
                  }}
                >
                  <option value={0.5}>0.5x Slow</option>
                  <option value={1}>1.0x Normal</option>
                  <option value={2.5}>2.5x Fast</option>
                  <option value={10}>10x Turbo</option>
                </select>
              </div>
            </div>
          </div>

          {/* Right Column */}
          <div style={{ ...cardStyle, display: "flex", flexDirection: "column", gap: "16px" }}>
            <div style={sectionHeaderStyle}>3. DELIVERABLE TELEMETRY (REPORT METRICS)</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              <MetricCard icon={<Compass size={14} color="#10b981" />} label="Cost of Path" value={result ? result.cost_of_path : "—"} />
              <MetricCard icon={<Cpu size={14} color="#3b82f6" />} label="Nodes Expanded" value={result ? result.nodes_expanded : "—"} />
              <MetricCard icon={<Layers size={14} color="#a855f7" />} label="Search Depth" value={result ? `${result.search_depth} (Max ${result.max_search_depth})` : "—"} />
              <MetricCard icon={<Clock size={14} color="#f59e0b" />} label="Running Time" value={result ? `${result.running_time_ms} ms` : "—"} />
            </div>

            <div style={{ backgroundColor: "#090d16", border: "1px solid #1e293b", borderRadius: "12px", padding: "14px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "10px", fontSize: "11px", fontFamily: "monospace" }}>
                <span style={{ color: "#94a3b8" }}>Sequence Window:</span>
                {sequenceWindow.items?.length > 0 && (
                  <span style={{ color: "#10b981" }}>Total: {sequenceWindow.total}</span>
                )}
              </div>
              <div style={{ maxHeight: "230px", overflowY: "auto", display: "flex", flexWrap: "wrap", gap: "6px" }}>
                {sequenceWindow.items?.map((stepObj) => (
                  <button
                    key={stepObj.step_number}
                    onClick={() => {
                      setIsPlaying(false);
                      setCurrentStep(stepObj.step_number);
                    }}
                    style={{
                      padding: "5px 9px",
                      borderRadius: "6px",
                      fontFamily: "monospace",
                      fontSize: "11px",
                      cursor: "pointer",
                      border: stepObj.step_number === currentStep ? "1px solid #10b981" : "1px solid #1e293b",
                      backgroundColor: stepObj.step_number === currentStep ? "rgba(16, 185, 129, 0.2)" : "#141c2e",
                      color: stepObj.step_number === currentStep ? "#34d399" : "#cbd5e1",
                    }}
                  >
                    {stepObj.step_number}. {stepObj.action}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const cardStyle = {
  backgroundColor: "#0f1523",
  border: "1px solid #1e293b",
  borderRadius: "14px",
  padding: "18px",
};

const sectionHeaderStyle = {
  fontSize: "11px",
  fontWeight: 600,
  letterSpacing: "0.08em",
  color: "#94a3b8",
  fontFamily: "monospace",
};

const dvrBtnStyle = {
  backgroundColor: "#141c2e",
  border: "1px solid #26324d",
  color: "#cbd5e1",
  borderRadius: "8px",
  padding: "8px 10px",
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

function MetricCard({ icon, label, value }) {
  return (
    <div style={{ backgroundColor: "#090d16", border: "1px solid #1e293b", borderRadius: "12px", padding: "14px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "11px", color: "#94a3b8", marginBottom: "8px" }}>
        {icon}
        <span>{label}</span>
      </div>
      <div style={{ fontSize: "20px", fontWeight: 800, fontFamily: "monospace" }}>{value}</div>
    </div>
  );
}