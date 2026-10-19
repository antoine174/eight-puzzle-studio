import React, { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import confetti from "canvas-confetti";
import {
  Play, Pause, RotateCcw, StepForward, StepBack, Volume2, VolumeX,
  Sparkles, Cpu, Activity, Layers, Clock, Compass, Zap, Eye
} from "lucide-react";
import { sound } from "./utils/soundEngine";

const PRESETS = [
  { name: "Assignment PDF Sample", board: [1, 2, 5, 3, 4, 0, 6, 7, 8] },
  { name: "Medium Depth (14 Moves)", board: [3, 1, 2, 6, 4, 5, 7, 8, 0] },
  { name: "Hard Depth (22 Moves)", board: [7, 2, 4, 5, 0, 6, 8, 3, 1] },
  { name: "Unsolvable Test (Odd Inversions)", board: [8, 1, 2, 0, 4, 3, 7, 6, 5] },
];

const ALGORITHMS = [
  { id: "bfs", name: "BFS", badge: "Uninformed • Optimal", color: "from-cyan-500 to-blue-600" },
  { id: "dfs", name: "DFS", badge: "Uninformed • LIFO", color: "from-purple-500 to-indigo-600" },
  { id: "iddfs", name: "Iterative DFS", badge: "Depth-Limited", color: "from-amber-500 to-orange-600" },
  { id: "astar_manhattan", name: "A* Manhattan", badge: "Informed • L1 Heuristic", color: "from-emerald-400 to-teal-600" },
  { id: "astar_euclidean", name: "A* Euclidean", badge: "Informed • L2 Heuristic", color: "from-rose-500 to-pink-600" },
];

function computeInversions(board) {
  const tiles = board.filter((x) => x !== 0);
  let inv = 0;
  for (let i = 0; i < tiles.length; i++) {
    for (let j = i + 1; j < tiles.length; j++) {
      if (tiles[i] > tiles[j]) inv++;
    }
  }
  return inv;
}

function tileManhattanDist(tileVal, currentIndex) {
  if (tileVal === 0) return 0;
  const curR = Math.floor(currentIndex / 3), curC = currentIndex % 3;
  const goalR = Math.floor(tileVal / 3), goalC = tileVal % 3;
  return Math.abs(curR - goalR) + Math.abs(curC - goalC);
}

export default function App() {
  const [initialBoard, setInitialBoard] = useState([1, 2, 5, 3, 4, 0, 6, 7, 8]);
  const [customInput, setCustomInput] = useState("1,2,5,3,4,0,6,7,8");
  const [selectedAlgo, setSelectedAlgo] = useState("astar_manhattan");
  const [heatmapMode, setHeatmapMode] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(true);

  // Playback & Telemetry state
  const [telemetry, setTelemetry] = useState(null);
  const [benchmarkData, setBenchmarkData] = useState([]);
  const [currentStep, setCurrentStep] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speedMs, setSpeedMs] = useState(380);
  const [loading, setLoading] = useState(false);

  const inversions = useMemo(() => computeInversions(initialBoard), [initialBoard]);
  const isSolvable = inversions % 2 === 0;

  const activeBoard = useMemo(() => {
    if (telemetry?.traceable_steps?.length > 0 && telemetry.traceable_steps[currentStep]) {
      return telemetry.traceable_steps[currentStep].board;
    }
    return initialBoard;
  }, [telemetry, currentStep, initialBoard]);

  // Calculate total board heuristic live
  const liveBoardManhattan = useMemo(() => {
    return activeBoard.reduce((acc, val, idx) => acc + tileManhattanDist(val, idx), 0);
  }, [activeBoard]);

  // DVR Auto-playback loop
  useEffect(() => {
    if (!isPlaying || !telemetry?.traceable_steps) return;
    if (currentStep >= telemetry.traceable_steps.length - 1) {
      setIsPlaying(false);
      sound.playVictoryChord();
      confetti({ particleCount: 70, spread: 60, origin: { y: 0.6 } });
      return;
    }
    const timer = setTimeout(() => {
      const next = currentStep + 1;
      setCurrentStep(next);
      sound.playTileMove(next, telemetry.traceable_steps.length - 1);
    }, speedMs);
    return () => clearTimeout(timer);
  }, [isPlaying, currentStep, telemetry, speedMs]);

  const handleSolve = async () => {
    if (!isSolvable) {
      sound.playError();
      return;
    }
    setLoading(true);
    setIsPlaying(false);
    try {
      const res = await fetch("http://localhost:8000/api/solve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ initial_state: initialBoard, algorithm: selectedAlgo, max_depth: 35 }),
      });
      const data = await res.json();
      setTelemetry(data);
      setCurrentStep(0);
      if (data.traceable_steps?.length > 1) setIsPlaying(true);
    } catch (err) {
      console.error("Backend connection error:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleBenchmarkAll = async () => {
    if (!isSolvable) {
      sound.playError();
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("http://localhost:8000/api/benchmark", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ initial_state: initialBoard, algorithm: selectedAlgo, max_depth: 35 }),
      });
      const data = await res.json();
      setBenchmarkData(data.results || []);
    } catch (err) {
      console.error("Benchmark error:", err);
    } finally {
      setLoading(false);
    }
  };

  const applyCustomBoard = (str) => {
    setCustomInput(str);
    const nums = str.split(",").map((s) => parseInt(s.trim(), 10));
    if (nums.length === 9 && [...nums].sort().join(",") === "0,1,2,3,4,5,6,7,8") {
      setInitialBoard(nums);
      setTelemetry(null);
      setCurrentStep(0);
    }
  };

  return (
    <div className="min-h-screen bg-[#07090E] text-slate-100 font-sans selection:bg-emerald-500/30 p-6">
      {/* Top Studio Header */}
      <header className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4 pb-6 border-b border-white/10">
        <div>
          <div className="flex items-center gap-2 text-xs uppercase tracking-[0.25em] text-emerald-400 font-mono">
            <Sparkles className="w-3.5 h-3.5" /> Alexandria University • Computer & Systems AI Studio
          </div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight mt-1 bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
            8-Puzzle Kinetic State-Space Observatory
          </h1>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              sound.enabled = !soundEnabled;
              setSoundEnabled(!soundEnabled);
            }}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-mono transition"
          >
            {soundEnabled ? <Volume2 className="w-4 h-4 text-emerald-400" /> : <VolumeX className="w-4 h-4 text-slate-400" />}
            {soundEnabled ? "SYNTH AUDIO ON" : "MUTED"}
          </button>

          <button
            onClick={() => setHeatmapMode(!heatmapMode)}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl border text-xs font-mono transition ${
              heatmapMode
                ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-300"
                : "bg-white/5 border-white/10 text-slate-400"
            }`}
          >
            <Eye className="w-4 h-4" />
            HEURISTIC X-RAY: {heatmapMode ? "ON" : "OFF"}
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6 mt-6">
        {/* Left Column: Controls, Presets & Solvability Gatekeeper */}
        <section className="lg:col-span-4 space-y-5">
          {/* Board Input & Solvability Card */}
          <div className="p-5 rounded-2xl bg-[#0D111A] border border-white/10 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono uppercase tracking-wider text-slate-400">1. Initial Configuration</span>
              <span
                className={`text-xs font-mono px-2.5 py-0.5 rounded-full border ${
                  isSolvable
                    ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                    : "bg-rose-500/10 border-rose-500/30 text-rose-400"
                }`}
              >
                Inversions: {inversions} ({isSolvable ? "SOLVABLE" : "IMPOSSIBLE"})
              </span>
            </div>

            <input
              type="text"
              value={customInput}
              onChange={(e) => applyCustomBoard(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-black/50 border border-white/15 font-mono text-sm text-emerald-300 focus:outline-none focus:border-emerald-500"
              placeholder="e.g. 1,2,5,3,4,0,6,7,8"
            />

            <div className="grid grid-cols-2 gap-2">
              {PRESETS.map((p) => (
                <button
                  key={p.name}
                  onClick={() => applyCustomBoard(p.board.join(","))}
                  className="text-left p-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 text-xs transition"
                >
                  <div className="font-medium text-slate-200 truncate">{p.name}</div>
                  <div className="font-mono text-[10px] text-slate-400 mt-0.5">{p.board.join(",")}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Algorithm Selector */}
          <div className="p-5 rounded-2xl bg-[#0D111A] border border-white/10 space-y-3">
            <span className="text-xs font-mono uppercase tracking-wider text-slate-400">2. Search Strategy</span>
            <div className="space-y-2">
              {ALGORITHMS.map((algo) => (
                <button
                  key={algo.id}
                  onClick={() => setSelectedAlgo(algo.id)}
                  className={`w-full flex items-center justify-between p-3 rounded-xl border text-left transition ${
                    selectedAlgo === algo.id
                      ? "bg-white/10 border-emerald-500/50 shadow-lg"
                      : "bg-white/[0.02] border-white/5 hover:bg-white/5"
                  }`}
                >
                  <div>
                    <div className="font-semibold text-sm">{algo.name}</div>
                    <div className="text-[11px] font-mono text-slate-400">{algo.badge}</div>
                  </div>
                  <div className={`w-2.5 h-2.5 rounded-full bg-gradient-to-r ${algo.color}`} />
                </button>
              ))}
            </div>

            <div className="pt-2 flex gap-2">
              <button
                onClick={handleSolve}
                disabled={loading || !isSolvable}
                className="flex-1 py-3 px-4 rounded-xl font-semibold text-sm bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-slate-950 shadow-lg shadow-emerald-500/20 disabled:opacity-40 transition"
              >
                {loading ? "Executing..." : "Run Search & Trace"}
              </button>
              <button
                onClick={handleBenchmarkAll}
                disabled={loading || !isSolvable}
                className="py-3 px-4 rounded-xl font-mono text-xs bg-white/10 hover:bg-white/15 border border-white/15 text-slate-200 transition"
                title="Compare all 5 algorithms side-by-side"
              >
                Arena Race
              </button>
            </div>
          </div>
        </section>

        {/* Center Column: Kinetic 3x3 Board & DVR Scrubber */}
        <section className="lg:col-span-4 flex flex-col items-center justify-between p-6 rounded-2xl bg-[#0D111A] border border-white/10 shadow-2xl">
          <div className="w-full flex items-center justify-between text-xs font-mono text-slate-400">
            <span>STEP: {currentStep} / {telemetry?.traceable_steps ? telemetry.traceable_steps.length - 1 : 0}</span>
            <span className="text-emerald-400">LIVE h(n) = {liveBoardManhattan}</span>
          </div>

          {/* 3x3 Tactile Grid */}
          <div className="relative grid grid-cols-3 gap-3 p-4 my-4 rounded-2xl bg-[#05070B] border border-white/10 w-72 h-72 shadow-inner">
            {activeBoard.map((tile, idx) => {
              if (tile === 0) {
                return (
                  <div
                    key="blank-slot"
                    className="rounded-xl border border-dashed border-white/10 bg-white/[0.01] flex items-center justify-center text-[10px] font-mono text-slate-600"
                  >
                    BLANK (0)
                  </div>
                );
              }

              const dist = tileManhattanDist(tile, idx);
              const heatStyle = heatmapMode
                ? dist === 0
                  ? "border-emerald-500/60 bg-emerald-500/15 text-emerald-200 shadow-emerald-500/10"
                  : dist === 1
                  ? "border-amber-500/50 bg-amber-500/15 text-amber-200"
                  : "border-rose-500/50 bg-rose-500/15 text-rose-200"
                : "border-white/15 bg-slate-800/90 text-white";

              return (
                <motion.div
                  layout
                  key={tile}
                  transition={{ type: "spring", stiffness: 420, damping: 28 }}
                  className={`relative rounded-xl border flex flex-col items-center justify-center shadow-lg select-none ${heatStyle}`}
                >
                  <span className="text-3xl font-bold tracking-tight font-mono">{tile}</span>
                  {heatmapMode && (
                    <span className="text-[9px] font-mono uppercase opacity-75 mt-0.5">
                      {dist === 0 ? "LOCKED" : `Δ=${dist}`}
                    </span>
                  )}
                </motion.div>
              );
            })}
          </div>

          {/* DVR Playback Deck */}
          <div className="w-full space-y-3">
            <input
              type="range"
              min={0}
              max={Math.max(0, (telemetry?.traceable_steps?.length || 1) - 1)}
              value={currentStep}
              onChange={(e) => {
                setIsPlaying(false);
                const val = Number(e.target.value);
                setCurrentStep(val);
                sound.playTileMove(val, telemetry?.traceable_steps?.length || 1);
              }}
              className="w-full accent-emerald-400 cursor-pointer"
            />

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => { setIsPlaying(false); setCurrentStep(0); }}
                  className="p-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>
                <button
                  onClick={() => {
                    setIsPlaying(false);
                    setCurrentStep((s) => Math.max(0, s - 1));
                    sound.playTileMove(currentStep - 1, telemetry?.traceable_steps?.length || 1);
                  }}
                  className="p-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10"
                >
                  <StepBack className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setIsPlaying(!isPlaying)}
                  className="px-4 py-2 rounded-lg bg-emerald-500 text-slate-950 font-semibold flex items-center gap-1.5 text-xs"
                >
                  {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                  {isPlaying ? "PAUSE" : "PLAY"}
                </button>
                <button
                  onClick={() => {
                    setIsPlaying(false);
                    const max = (telemetry?.traceable_steps?.length || 1) - 1;
                    setCurrentStep((s) => Math.min(max, s + 1));
                    sound.playTileMove(currentStep + 1, max);
                  }}
                  className="p-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10"
                >
                  <StepForward className="w-4 h-4" />
                </button>
              </div>

              <select
                value={speedMs}
                onChange={(e) => setSpeedMs(Number(e.target.value))}
                className="bg-black/60 border border-white/15 rounded-lg px-2.5 py-1.5 text-xs font-mono text-slate-300"
              >
                <option value={700}>0.5x Slow</option>
                <option value={380}>1.0x Normal</option>
                <option value={150}>2.5x Fast</option>
                <option value={40}>10x Turbo</option>
              </select>
            </div>
          </div>
        </section>

        {/* Right Column: Deliverable Metrics HUD (Section 3.1) */}
        <section className="lg:col-span-4 space-y-4">
          <div className="p-5 rounded-2xl bg-[#0D111A] border border-white/10 space-y-4">
            <span className="text-xs font-mono uppercase tracking-wider text-slate-400">
              3. Deliverable Telemetry (Report Metrics)
            </span>

            <div className="grid grid-cols-2 gap-3">
              <div className="p-3.5 rounded-xl bg-black/40 border border-white/5">
                <div className="flex items-center gap-1.5 text-xs text-slate-400 font-mono">
                  <Compass className="w-3.5 h-3.5 text-emerald-400" /> Cost of Path
                </div>
                <div className="text-2xl font-bold font-mono mt-1">{telemetry?.cost_of_path ?? "—"}</div>
              </div>

              <div className="p-3.5 rounded-xl bg-black/40 border border-white/5">
                <div className="flex items-center gap-1.5 text-xs text-slate-400 font-mono">
                  <Cpu className="w-3.5 h-3.5 text-cyan-400" /> Nodes Expanded
                </div>
                <div className="text-2xl font-bold font-mono mt-1">{telemetry?.nodes_expanded ?? "—"}</div>
              </div>

              <div className="p-3.5 rounded-xl bg-black/40 border border-white/5">
                <div className="flex items-center gap-1.5 text-xs text-slate-400 font-mono">
                  <Layers className="w-3.5 h-3.5 text-purple-400" /> Search Depth
                </div>
                <div className="text-2xl font-bold font-mono mt-1">
                  {telemetry ? `${telemetry.search_depth} (Max ${telemetry.max_search_depth})` : "—"}
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-black/40 border border-white/5">
                <div className="flex items-center gap-1.5 text-xs text-slate-400 font-mono">
                  <Clock className="w-3.5 h-3.5 text-amber-400" /> Running Time
                </div>
                <div className="text-2xl font-bold font-mono mt-1">
                  {telemetry ? `${telemetry.running_time_ms} ms` : "—"}
                </div>
              </div>
            </div>

            {/* Path to Goal Sequence */}
             <div className="p-3.5 rounded-xl bg-black/40 border border-white/5">
              <div className="flex justify-between items-center text-xs font-mono text-slate-400 mb-2">
                <span>Path to Goal Sequence:</span>
                {telemetry?.path_to_goal?.length > 200 && (
                  <span className="text-[10px] text-emerald-400">
                    Showing window around Step #{currentStep} (Total: {telemetry.path_to_goal.length})
                  </span>
                )}
              </div>
              <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
                {telemetry?.path_to_goal?.length > 0 ? (
                  (() => {
                    const total = telemetry.path_to_goal.length;
                    const winStart = Math.max(0, currentStep - 50);
                    const winEnd = Math.min(total, winStart + 150);
                    const visibleMoves = telemetry.path_to_goal.slice(winStart, winEnd);

                    return visibleMoves.map((act, i) => {
                      const actualIdx = winStart + i;
                      return (
                        <span
                          key={actualIdx}
                          onClick={() => {
                            setIsPlaying(false);
                            setCurrentStep(actualIdx + 1);
                          }}
                          className={`cursor-pointer px-2 py-0.5 rounded text-xs font-mono border transition ${
                            currentStep === actualIdx + 1
                              ? "bg-emerald-500 text-slate-950 border-emerald-400 font-bold"
                              : "bg-white/5 text-slate-300 border-white/10 hover:bg-white/10"
                          }`}
                        >
                          {actualIdx + 1}. {act}
                        </span>
                      );
                    });
                  })()
                ) : (
                  <span className="text-xs font-mono text-slate-500">
                    Run an algorithm to inspect move sequence.
                  </span>
                )}
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Traceable Parent -> Child Matrix Ribbon (Matches PDF Section 1 & 3 Diagram) */}
   {/* Traceable Parent -> Child Matrix Ribbon (Windowed for 60FPS performance) */}
      {telemetry?.traceable_steps?.length > 0 && (
        <section className="max-w-7xl mx-auto mt-6 p-5 rounded-2xl bg-[#0D111A] border border-white/10">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <div className="text-xs font-mono uppercase tracking-wider text-slate-400">
              4. Traceable Parent → Child State Transitions (Click any matrix to jump)
            </div>
            {telemetry.traceable_steps.length > 40 && (
              <div className="text-xs font-mono text-emerald-400">
                Live Window: Steps {Math.max(0, currentStep - 10)} –{" "}
                {Math.min(telemetry.traceable_steps.length - 1, Math.max(0, currentStep - 10) + 30)}{" "}
                of {telemetry.traceable_steps.length - 1}
              </div>
            )}
          </div>
          <div className="flex items-center gap-3 overflow-x-auto pb-2">
            {(() => {
              const total = telemetry.traceable_steps.length;
              const startIdx = Math.max(0, currentStep - 10);
              const endIdx = Math.min(total, startIdx + 30);
              const visibleSteps = telemetry.traceable_steps.slice(startIdx, endIdx);

              return visibleSteps.map((snap, i) => {
                const actualIdx = startIdx + i;
                return (
                  <React.Fragment key={actualIdx}>
                    <div
                      onClick={() => {
                        setIsPlaying(false);
                        setCurrentStep(actualIdx);
                      }}
                      className={`cursor-pointer shrink-0 p-2.5 rounded-xl border transition ${
                        currentStep === actualIdx
                          ? "bg-emerald-500/15 border-emerald-400 shadow-lg shadow-emerald-500/10"
                          : "bg-black/40 border-white/10 hover:border-white/25"
                      }`}
                    >
                      <div className="text-[10px] font-mono text-slate-400 mb-1 flex justify-between gap-2">
                        <span>#{actualIdx}</span>
                        <span className="text-emerald-400">{snap.action}</span>
                      </div>
                      <div className="grid grid-cols-3 gap-1 w-20 h-20">
                        {snap.board.map((cell, cIdx) => (
                          <div
                            key={cIdx}
                            className={`flex items-center justify-center text-xs font-mono rounded ${
                              cell === 0 ? "bg-white/5 text-slate-600" : "bg-white/10 text-slate-200"
                            }`}
                          >
                            {cell === 0 ? "·" : cell}
                          </div>
                        ))}
                      </div>
                    </div>
                    {actualIdx < total - 1 && (
                      <span className="text-slate-500 font-mono text-sm shrink-0">⇒</span>
                    )}
                  </React.Fragment>
                );
              });
            })()}
          </div>
        </section>
      )}

      {/* Multi-Algorithm Benchmark Table for Section 2.2 Report */}
      {benchmarkData.length > 0 && (
        <section className="max-w-7xl mx-auto mt-6 p-5 rounded-2xl bg-[#0D111A] border border-white/10">
          <div className="text-xs font-mono uppercase tracking-wider text-emerald-400 mb-3">
            5. Head-to-Head Heuristic & Uninformed Benchmark (Ready for Report Section 2.2 & 3.1)
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse font-mono text-xs">
              <thead>
                <tr className="border-b border-white/10 text-slate-400">
                  <th className="py-2.5 px-3">Algorithm</th>
                  <th className="py-2.5 px-3">Cost of Path</th>
                  <th className="py-2.5 px-3">Nodes Expanded</th>
                  <th className="py-2.5 px-3">Search Depth</th>
                  <th className="py-2.5 px-3">Max Depth</th>
                  <th className="py-2.5 px-3">Running Time (ms)</th>
                </tr>
              </thead>
              <tbody>
                {benchmarkData.map((row) => (
                  <tr key={row.algorithm} className="border-b border-white/5 hover:bg-white/[0.02]">
                    <td className="py-2.5 px-3 font-semibold text-white">{row.algorithm}</td>
                    <td className="py-2.5 px-3 text-emerald-400">{row.cost_of_path}</td>
                    <td className="py-2.5 px-3 text-cyan-400">{row.nodes_expanded}</td>
                    <td className="py-2.5 px-3">{row.search_depth}</td>
                    <td className="py-2.5 px-3">{row.max_search_depth}</td>
                    <td className="py-2.5 px-3 text-amber-400">{row.running_time_ms} ms</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}