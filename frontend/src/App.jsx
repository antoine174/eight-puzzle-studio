import React, { useState, useEffect, useMemo, useRef } from "react";
import { motion } from "framer-motion";
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
} from "lucide-react";
import "./App.css";

const API_BASE = "http://127.0.0.1:8000";

const PRESETS = [
  { label: "Assignment PDF Sample", state: "1,2,5,3,4,0,6,7,8" },
  { label: "Medium Depth (14 Moves)", state: "3,1,2,6,4,5,7,8,0" },
  { label: "Hard Depth (22 Moves)", state: "7,2,4,5,0,6,8,3,1" },
  { label: "Unsolvable Test (Odd Inversions)", state: "8,1,2,0,4,3,7,6,5" },
];

const STRATEGIES = [
  { id: "bfs", name: "BFS", desc: "Uninformed • Optimal", color: "#3b82f6" },
  { id: "dfs", name: "DFS", desc: "Uninformed • LIFO", color: "#a855f7" },
  { id: "iddfs", name: "Iterative DFS", desc: "Depth-Limited", color: "#f97316" },
  { id: "astar_manhattan", name: "A* Manhattan", desc: "Informed • L1 Heuristic", color: "#10b981" },
  { id: "astar_euclidean", name: "A* Euclidean", desc: "Informed • L2 Heuristic", color: "#ec4899" },
];

// Calculate inversions on the client side for live badge feedback
function calculateInversions(arr) {
  const tiles = arr.filter((x) => x !== 0);
  let inv = 0;
  for (let i = 0; i < tiles.length; i++) {
    for (let j = i + 1; j < tiles.length; j++) {
      if (tiles[i] > tiles[j]) inv++;
    }
  }
  return inv;
}

// Calculate individual tile Manhattan distance to its goal position (0..8)
function getTileDistance(tileValue, currentIndex) {
  if (tileValue === 0) return 0;
  const curRow = Math.floor(currentIndex / 3);
  const curCol = currentIndex % 3;
  const goalRow = Math.floor(tileValue / 3);
  const goalCol = tileValue % 3;
  return Math.abs(curRow - goalRow) + Math.abs(curCol - goalCol);
}

// Total board Manhattan distance h(n)
function getBoardManhattan(board) {
  if (!board || board.length !== 9) return 0;
  return board.reduce((sum, val, idx) => sum + getTileDistance(val, idx), 0);
}

// Lightweight Web Audio synthesizer for subtle UI clicks
function playTickSound(enabled, freq = 320) {
  if (!enabled) return;
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    if (!window._puzzleAudioCtx) window._puzzleAudioCtx = new Ctx();
    const ctx = window._puzzleAudioCtx;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    gain.gain.setValueAtTime(0.03, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.045);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.05);
  } catch {
    // Ignore audio context restrictions
  }
}

export default function App() {
  const [inputStr, setInputStr] = useState("1,2,5,3,4,0,6,7,8");
  const [algorithm, setAlgorithm] = useState("iddfs");
  const [maxDepth, setMaxDepth] = useState(35);

  const [result, setResult] = useState(null);
  const [arenaResults, setArenaResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // Playback state: "goal" (traceable_steps) or "expansion" (expanded_steps)
  const [playbackMode, setPlaybackMode] = useState("goal");
  const [currentStep, setCurrentStep] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [soundEnabled, setSoundEnabled] = useState(true);

  const timerRef = useRef(null);

  // Parse input string into 9 integers
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

  // Choose active steps array based on playbackMode ("goal" vs "expansion")
  const activeSteps = useMemo(() => {
    if (!result) return [];
    if (playbackMode === "expansion" && result.expanded_steps?.length > 0) {
      return result.expanded_steps;
    }
    return result.traceable_steps || [];
  }, [result, playbackMode]);

  // Current board displayed on the 3x3 grid
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

  // DVR Playback loop
  useEffect(() => {
    if (!isPlaying || activeSteps.length === 0) {
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
  }, [isPlaying, speed, activeSteps, soundEnabled, playbackMode]);

  // Run single search algorithm
  const handleRunSearch = async () => {
    if (!parsedBoard) {
      setErrorMsg("Please enter a valid 9-number board containing digits 0 through 8.");
      return;
    }
    setErrorMsg("");
    setLoading(true);
    setIsPlaying(false);
    setArenaResults(null);

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
      if (!response.ok) {
        throw new Error(data.detail || "Failed to solve puzzle.");
      }

      setResult(data);
      setCurrentStep(0);
    } catch (err) {
      setErrorMsg(err.message || "Error connecting to FastAPI backend.");
    } finally {
      setLoading(false);
    }
  };

  // Run Arena Benchmark across all algorithms
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
      if (!response.ok) {
        throw new Error(data.detail || "Arena benchmark failed.");
      }

      setArenaResults(data.benchmarks || data);
    } catch (err) {
      setErrorMsg(err.message || "Error running Arena Race.");
    } finally {
      setLoading(false);
    }
  };

  // Sliding window for sequence list so 60,000+ DFS steps never lag the DOM
  const sequenceWindow = useMemo(() => {
    if (!activeSteps || activeSteps.length <= 1) return [];
    const total = activeSteps.length - 1; // Exclude step 0 in move badges if desired, or include all
    const windowRadius = 30;

    if (playbackMode === "expansion") {
      // In expansion mode, step 0 is also an expansion frame (Initial d=0)
      const start = Math.max(0, currentStep - windowRadius);
      const end = Math.min(activeSteps.length - 1, currentStep + windowRadius);
      const items = [];
      for (let i = start; i <= end; i++) {
        items.push(activeSteps[i]);
      }
      return { items, total: activeSteps.length };
    } else {
      // In goal mode, steps 1..N are the moves
      const start = Math.max(1, currentStep - windowRadius);
      const end = Math.min(total, currentStep + windowRadius);
      const items = [];
      for (let i = start; i <= end; i++) {
        items.push(activeSteps[i]);
      }
      return { items, total };
    }
  }, [activeSteps, currentStep, playbackMode]);

  return (
    <div
      style={{
        minHeight: "100vh",
        backgroundColor: "#090d16",
        color: "#f8fafc",
        fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
        padding: "24px",
        boxSizing: "border-box",
      }}
    >
      {/* Top Header */}
      <header
        style={{
          maxWidth: "1380px",
          margin: "0 auto 20px auto",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          borderBottom: "1px solid #1e293b",
          paddingBottom: "14px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <Sparkles size={22} color="#10b981" />
          <h1 style={{ fontSize: "20px", fontWeight: 700, margin: 0, letterSpacing: "-0.02em" }}>
            8-Puzzle AI Search Studio
          </h1>
          <span
            style={{
              fontSize: "11px",
              padding: "3px 8px",
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

      {/* Error Banner */}
      {errorMsg && (
        <div
          style={{
            maxWidth: "1380px",
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

      {/* Main 3-Column Dashboard */}
      <div
        style={{
          maxWidth: "1380px",
          margin: "0 auto",
          display: "grid",
          gridTemplateColumns: "340px 1fr 370px",
          gap: "20px",
          alignItems: "start",
        }}
      >
        {/* LEFT COLUMN: Configuration & Strategy */}
        <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
          {/* 1. Initial Configuration Card */}
          <div
            style={{
              backgroundColor: "#0f1523",
              border: "1px solid #1e293b",
              borderRadius: "14px",
              padding: "18px",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "14px",
              }}
            >
              <span
                style={{
                  fontSize: "11px",
                  fontWeight: 600,
                  letterSpacing: "0.08em",
                  color: "#94a3b8",
                  fontFamily: "monospace",
                }}
              >
                1. INITIAL CONFIGURATION
              </span>

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
                  border: `1px solid ${
                    isSolvable ? "rgba(16, 185, 129, 0.35)" : "rgba(239, 68, 68, 0.4)"
                  }`,
                }}
              >
                Inversions: {inversions} ({isSolvable ? "SOLVABLE" : "UNSOLVABLE"})
              </span>
            </div>

            <input
              type="text"
              value={inputStr}
              onChange={(e) => setInputStr(e.target.value)}
              placeholder="e.g. 1,2,5,3,4,0,6,7,8"
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
                outline: "none",
              }}
            />

           <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "8px",
              }}
            >
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
                    boxSizing: "border-box",
                    textAlign: "left",
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
                  <div
                    style={{
                      fontSize: "11px",
                      fontWeight: 600,
                    }}
                  >
                    {preset.label}
                  </div>
                  <div
                    style={{
                      fontSize: "10px",
                      color: "#34d399",
                      fontFamily: "monospace",
                    }}
                  >
                    {preset.state}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* 2. Search Strategy Card */}
          <div
            style={{
              backgroundColor: "#0f1523",
              border: "1px solid #1e293b",
              borderRadius: "14px",
              padding: "18px",
            }}
          >
            <div
              style={{
                fontSize: "11px",
                fontWeight: 600,
                letterSpacing: "0.08em",
                color: "#94a3b8",
                fontFamily: "monospace",
                marginBottom: "12px",
              }}
            >
              2. SEARCH STRATEGY
            </div>

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
                      transition: "all 0.15s ease",
                    }}
                  >
                    <div>
                      <div style={{ fontSize: "13px", fontWeight: 700, color: "#f8fafc" }}>
                        {strat.name}
                      </div>
                      <div style={{ fontSize: "11px", color: "#64748b", marginTop: "2px" }}>
                        {strat.desc}
                      </div>
                    </div>
                    <span
                      style={{
                        width: "9px",
                        height: "9px",
                        borderRadius: "50%",
                        backgroundColor: strat.color,
                        boxShadow: `0 0 8px ${strat.color}`,
                      }}
                    />
                  </div>
                );
              })}
            </div>

            {/* Max Depth Input for IDDFS */}
            {algorithm === "iddfs" && (
              <div
                style={{
                  marginTop: "12px",
                  padding: "10px 12px",
                  backgroundColor: "#141c2e",
                  borderRadius: "8px",
                  border: "1px solid #26324d",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <span style={{ fontSize: "12px", color: "#cbd5e1" }}>Max Depth Limit:</span>
                <input
                  type="number"
                  min={1}
                  max={80}
                  value={maxDepth}
                  onChange={(e) => setMaxDepth(e.target.value)}
                  style={{
                    width: "64px",
                    padding: "4px 8px",
                    backgroundColor: "#090d16",
                    border: "1px solid #334155",
                    borderRadius: "6px",
                    color: "#f97316",
                    fontFamily: "monospace",
                    fontWeight: 700,
                    textAlign: "center",
                  }}
                />
              </div>
            )}

            {/* Action Buttons */}
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
                  padding: "12px 14px",
                  borderRadius: "10px",
                  border: "1px solid #334155",
                  backgroundColor: "#161f33",
                  color: "#e2e8f0",
                  fontWeight: 600,
                  fontSize: "13px",
                  cursor: !isSolvable ? "not-allowed" : "pointer",
                }}
              >
                Arena Race
              </button>
            </div>
          </div>
        </div>

        {/* CENTER COLUMN: Interactive 3x3 Board & Playback Mode Controls */}
        <div
          style={{
            backgroundColor: "#0f1523",
            border: "1px solid #1e293b",
            borderRadius: "14px",
            padding: "20px 24px",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            minHeight: "610px",
          }}
        >
          {/* Top Status Row */}
          <div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                fontFamily: "monospace",
                fontSize: "12px",
                marginBottom: "14px",
              }}
            >
              <span style={{ color: "#94a3b8" }}>
                {playbackMode === "expansion" ? "EXPANSION FRAME: " : "STEP: "}
                <strong style={{ color: "#f8fafc" }}>{currentStep}</strong> /{" "}
                {Math.max(0, activeSteps.length - 1)}
              </span>
              <span style={{ color: "#10b981", fontWeight: 600 }}>
                LIVE h(n) = {liveHeuristic}
              </span>
            </div>

            {/* Mode Toggle: Goal Path vs Live Expansion */}
            {result && result.algorithm !== "DFS" && (
              <div
                style={{
                  display: "flex",
                  gap: "8px",
                  justifyContent: "center",
                  marginBottom: "12px",
                }}
              >
                <button
                  onClick={() => {
                    setPlaybackMode("goal");
                    setCurrentStep(0);
                    setIsPlaying(false);
                  }}
                  style={{
                    padding: "7px 14px",
                    borderRadius: "8px",
                    border:
                      playbackMode === "goal" ? "1px solid #10b981" : "1px solid #26324d",
                    backgroundColor:
                      playbackMode === "goal" ? "rgba(16, 185, 129, 0.16)" : "#141c2e",
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
                    border:
                      playbackMode === "expansion"
                        ? "1px solid #f59e0b"
                        : "1px solid #26324d",
                    backgroundColor:
                      playbackMode === "expansion"
                        ? "rgba(245, 158, 11, 0.16)"
                        : "#141c2e",
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

            {/* Current Move / Depth Limit Badge */}
            {result && (
              <div style={{ textAlign: "center", marginBottom: "8px" }}>
                <span
                  style={{
                    display: "inline-block",
                    padding: "4px 12px",
                    borderRadius: "999px",
                    fontSize: "12px",
                    fontFamily: "monospace",
                    fontWeight: 600,
                    backgroundColor:
                      playbackMode === "expansion"
                        ? "rgba(245, 158, 11, 0.12)"
                        : "rgba(59, 130, 246, 0.12)",
                    color: playbackMode === "expansion" ? "#fbbf24" : "#60a5fa",
                    border:
                      playbackMode === "expansion"
                        ? "1px solid rgba(245, 158, 11, 0.35)"
                        : "1px solid rgba(59, 130, 246, 0.35)",
                  }}
                >
                  {playbackMode === "expansion"
                    ? `Exploring: ${currentActionLabel}`
                    : `Action: ${currentActionLabel}`}
                </span>
              </div>
            )}
          </div>

          {/* 3x3 Puzzle Board */}
          <div
            style={{
              width: "310px",
              height: "310px",
              margin: "12px auto",
              padding: "16px",
              backgroundColor: "#090d16",
              borderRadius: "20px",
              border: "1px solid #1e293b",
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gridTemplateRows: "repeat(3, 1fr)",
              gap: "12px",
              boxShadow: "inset 0 2px 12px rgba(0,0,0,0.6)",
            }}
          >
            {currentBoard.map((tile, idx) => {
              if (tile === 0) {
                return (
                  <div
                    key="blank-tile"
                    style={{
                      borderRadius: "14px",
                      border: "1px dashed #26324d",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "#475569",
                      fontFamily: "monospace",
                      fontSize: "11px",
                    }}
                  >
                    BLANK (0)
                  </div>
                );
              }

              const dist = getTileDistance(tile, idx);
              const borderColor =
                dist === 0 ? "#10b981" : dist === 1 ? "#f59e0b" : "#f43f5e";
              const bgColor =
                dist === 0
                  ? "rgba(16, 185, 129, 0.10)"
                  : dist === 1
                  ? "rgba(245, 158, 11, 0.10)"
                  : "rgba(244, 63, 94, 0.10)";

              return (
                <motion.div
                  key={tile}
                  layout={speed <= 2.5}
                  transition={{ type: "spring", stiffness: 350, damping: 28 }}
                  style={{
                    borderRadius: "14px",
                    border: `1.5px solid ${borderColor}`,
                    backgroundColor: bgColor,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    userSelect: "none",
                  }}
                >
                  <span
                    style={{
                      fontSize: "26px",
                      fontWeight: 800,
                      color: "#f8fafc",
                      lineHeight: 1.1,
                    }}
                  >
                    {tile}
                  </span>
                  <span
                    style={{
                      fontSize: "10px",
                      fontFamily: "monospace",
                      color: "#94a3b8",
                      marginTop: "4px",
                    }}
                  >
                    Δ={dist}
                  </span>
                </motion.div>
              );
            })}
          </div>

          {/* Bottom Scrubber & DVR Controls */}
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
              style={{
                width: "100%",
                accentColor: playbackMode === "expansion" ? "#f59e0b" : "#10b981",
                cursor: "pointer",
                marginBottom: "12px",
              }}
            />

            <div
              style={{
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                gap: "8px",
              }}
            >
              <button
                onClick={() => {
                  setIsPlaying(false);
                  setCurrentStep(0);
                }}
                title="Reset to Start"
                style={dvrBtnStyle}
              >
                <RotateCcw size={15} />
              </button>

              <button
                onClick={() => {
                  setIsPlaying(false);
                  setCurrentStep((s) => Math.max(0, s - 1));
                }}
                title="Previous Step"
                style={dvrBtnStyle}
              >
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
                  backgroundColor: playbackMode === "expansion" ? "#f59e0b" : "#10b981",
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

              <button
                onClick={() => {
                  setIsPlaying(false);
                  setCurrentStep((s) => Math.min(activeSteps.length - 1, s + 1));
                }}
                title="Next Step"
                style={dvrBtnStyle}
              >
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
                  cursor: "pointer",
                }}
              >
                <option value={0.5}>0.5x Slow</option>
                <option value={1}>1.0x Normal</option>
                <option value={2.5}>2.5x Fast</option>
                <option value={8}>8.0x Turbo</option>
                <option value={25}>25x Warp</option>
              </select>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Deliverable Telemetry & Sequence Window */}
        <div
          style={{
            backgroundColor: "#0f1523",
            border: "1px solid #1e293b",
            borderRadius: "14px",
            padding: "18px",
            display: "flex",
            flexDirection: "column",
            gap: "16px",
          }}
        >
          <div
            style={{
              fontSize: "11px",
              fontWeight: 600,
              letterSpacing: "0.08em",
              color: "#94a3b8",
              fontFamily: "monospace",
            }}
          >
            3. DELIVERABLE TELEMETRY (REPORT METRICS)
          </div>

          {/* 2x2 Metrics Grid */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "12px",
            }}
          >
            <MetricCard
              icon={<Compass size={14} color="#10b981" />}
              label="Cost of Path"
              value={result ? result.cost_of_path : "—"}
            />
            <MetricCard
              icon={<Cpu size={14} color="#3b82f6" />}
              label="Nodes Expanded"
              value={result ? result.nodes_expanded : "—"}
            />
            <MetricCard
              icon={<Layers size={14} color="#a855f7" />}
              label="Search Depth"
              value={
                result ? `${result.search_depth} (Max ${result.max_search_depth})` : "—"
              }
            />
            <MetricCard
              icon={<Clock size={14} color="#f59e0b" />}
              label="Running Time"
              value={result ? `${result.running_time_ms} ms` : "—"}
            />
          </div>

          {/* Sequence Log Box (Virtualized Window) */}
          <div
            style={{
              backgroundColor: "#090d16",
              border: "1px solid #1e293b",
              borderRadius: "12px",
              padding: "14px",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "10px",
                fontSize: "11px",
                fontFamily: "monospace",
              }}
            >
              <span style={{ color: "#94a3b8" }}>
                {playbackMode === "expansion"
                  ? "Live Expansion Log:"
                  : "Path to Goal Sequence:"}
              </span>
              {sequenceWindow.items?.length > 0 && (
                <span style={{ color: "#10b981" }}>
                  Window around #{currentStep} (Total: {sequenceWindow.total})
                </span>
              )}
            </div>

            <div
              style={{
                maxHeight: "230px",
                overflowY: "auto",
                display: "flex",
                flexWrap: "wrap",
                gap: "6px",
              }}
            >
              {!result ? (
                <span style={{ fontSize: "12px", color: "#475569" }}>
                  Click &quot;Run Search &amp; Trace&quot; to inspect steps...
                </span>
              ) : (
                sequenceWindow.items?.map((stepObj) => {
                  const isCurrent = stepObj.step_number === currentStep;
                  const isNewLimit =
                    playbackMode === "expansion" &&
                    stepObj.action.includes("• Initial (d=0)");

                  return (
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
                        border: isCurrent
                          ? "1px solid #10b981"
                          : isNewLimit
                          ? "1px solid rgba(249, 115, 22, 0.6)"
                          : "1px solid #1e293b",
                        backgroundColor: isCurrent
                          ? "rgba(16, 185, 129, 0.2)"
                          : isNewLimit
                          ? "rgba(249, 115, 22, 0.15)"
                          : "#141c2e",
                        color: isCurrent
                          ? "#34d399"
                          : isNewLimit
                          ? "#fdba74"
                          : "#cbd5e1",
                      }}
                    >
                      {stepObj.step_number}. {stepObj.action}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Arena Benchmark Comparison Table */}
      {arenaResults && (
        <div
          style={{
            maxWidth: "1380px",
            margin: "24px auto 0 auto",
            backgroundColor: "#0f1523",
            border: "1px solid #1e293b",
            borderRadius: "14px",
            padding: "20px",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              marginBottom: "14px",
              fontSize: "14px",
              fontWeight: 700,
            }}
          >
            <Trophy size={18} color="#f59e0b" />
            <span>Arena Multi-Algorithm Benchmark Comparison</span>
          </div>

          <div style={{ overflowX: "auto" }}>
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                fontFamily: "monospace",
                fontSize: "13px",
                textAlign: "left",
              }}
            >
              <thead>
                <tr style={{ borderBottom: "1px solid #1e293b", color: "#94a3b8" }}>
                  <th style={{ padding: "10px" }}>Algorithm</th>
                  <th style={{ padding: "10px" }}>Cost of Path</th>
                  <th style={{ padding: "10px" }}>Nodes Expanded</th>
                  <th style={{ padding: "10px" }}>Search Depth</th>
                  <th style={{ padding: "10px" }}>Max Depth</th>
                  <th style={{ padding: "10px" }}>Running Time (ms)</th>
                </tr>
              </thead>
              <tbody>
                {arenaResults.map((row) => (
                  <tr key={row.algorithm} style={{ borderBottom: "1px solid #141c2e" }}>
                    <td style={{ padding: "10px", fontWeight: 700, color: "#f8fafc" }}>
                      {row.algorithm}
                    </td>
                    <td style={{ padding: "10px", color: "#10b981" }}>{row.cost_of_path}</td>
                    <td style={{ padding: "10px", color: "#60a5fa" }}>{row.nodes_expanded}</td>
                    <td style={{ padding: "10px" }}>{row.search_depth}</td>
                    <td style={{ padding: "10px" }}>{row.max_search_depth}</td>
                    <td style={{ padding: "10px", color: "#fbbf24" }}>
                      {row.running_time_ms} ms
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

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
    <div
      style={{
        backgroundColor: "#090d16",
        border: "1px solid #1e293b",
        borderRadius: "12px",
        padding: "14px",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "6px",
          fontSize: "11px",
          color: "#94a3b8",
          marginBottom: "8px",
        }}
      >
        {icon}
        <span>{label}</span>
      </div>
      <div
        style={{
          fontSize: "20px",
          fontWeight: 800,
          fontFamily: "monospace",
          color: "#f8fafc",
        }}
      >
        {value}
      </div>
    </div>
  );
}