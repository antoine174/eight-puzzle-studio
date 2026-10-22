import { Compass, Cpu, Layers, Activity, Clock } from "lucide-react";

export const API_BASE = "http://127.0.0.1:8000";

export const PRESETS = [
  { label: "Assignment PDF Sample", state: "1,2,5,3,4,0,6,7,8" },
  { label: "Medium Depth (14 Moves)", state: "3,1,2,6,4,5,7,8,0" },
  { label: "Hard Depth (22 Moves)", state: "7,2,4,5,0,6,8,3,1" },
  { label: "Unsolvable Test (Odd Inversions)", state: "8,1,2,0,4,3,7,6,5" },
];

export const STRATEGIES = [
  { id: "bfs", name: "BFS", desc: "Uninformed • Optimal", color: "#3b82f6" },
  { id: "dfs", name: "DFS", desc: "Uninformed • LIFO", color: "#a855f7" },
  { id: "iddfs", name: "Iterative DFS", desc: "Depth-Limited", color: "#f97316" },
  { id: "astar_manhattan", name: "A* Manhattan", desc: "Informed • L1 Heuristic", color: "#10b981" },
  { id: "astar_euclidean", name: "A* Euclidean", desc: "Informed • L2 Heuristic", color: "#ec4899" },
];

export const METRIC_CONFIGS = [
  {
    key: "cost_of_path",
    title: "Cost of Path",
    unit: "moves",
    color: "#10b981",
    icon: Compass,
    description: "Total moves from the initial board to the goal state (0,1,2,3,4,5,6,7,8).",
    insight: "BFS, IDDFS, and admissible A* heuristics guarantee the minimum optimal path cost, whereas uninformed DFS wanders deeply before stumbling onto the goal.",
  },
  {
    key: "nodes_expanded",
    title: "Nodes Expanded",
    unit: "nodes",
    color: "#3b82f6",
    icon: Cpu,
    description: "Total states popped from the frontier and evaluated during the search process.",
    insight: "A* Manhattan dominates node efficiency because L1 taxi-cab distance closely estimates actual sliding-tile moves, pruning massive branches of the search tree.",
  },
  {
    key: "search_depth",
    title: "Search Depth",
    unit: "levels",
    color: "#a855f7",
    icon: Layers,
    description: "Depth level in the search tree at which the goal state was discovered.",
    insight: "For unit step-cost, Search Depth equals Cost of Path. Comparing this against Max Depth shows whether an algorithm dived deeper than necessary.",
  },
  {
    key: "max_search_depth",
    title: "Max Depth",
    unit: "levels",
    color: "#f97316",
    icon: Activity,
    description: "Deepest tree level reached along any branch during the entire search.",
    insight: "Unbounded DFS reaches massive depths before hitting dead ends, while BFS and A* never exceed the optimal solution depth.",
  },
  {
    key: "running_time_ms",
    title: "Running Time (ms)",
    unit: "ms",
    color: "#eab308",
    icon: Clock,
    description: "High-precision wall-clock execution time measured on the FastAPI backend.",
    insight: "Even though A* computes heuristic math per child, expanding exponentially fewer nodes makes it orders of magnitude faster on deeper boards.",
  },
];

export function getAlgoColor(algoNameOrId) {
  const key = (algoNameOrId || "").toLowerCase();
  if (key.includes("manhattan")) return "#10b981";
  if (key.includes("euclidean")) return "#ec4899";
  if (key.includes("iterative") || key.includes("iddfs")) return "#f97316";
  if (key.includes("bfs")) return "#3b82f6";
  if (key.includes("dfs")) return "#a855f7";
  return "#38bdf8";
}

export function getShortAlgoName(name) {
  if (!name) return "";
  if (name.includes("Manhattan")) return "A* Manh";
  if (name.includes("Euclidean")) return "A* Eucl";
  if (name.includes("Iterative")) return "IDDFS";
  return name;
}

export function calculateInversions(arr) {
  const tiles = arr.filter((x) => x !== 0);
  let inv = 0;
  for (let i = 0; i < tiles.length; i++) {
    for (let j = i + 1; j < tiles.length; j++) {
      if (tiles[i] > tiles[j]) inv++;
    }
  }
  return inv;
}

export function getTileDistance(tileValue, currentIndex) {
  if (tileValue === 0) return 0;
  const curRow = Math.floor(currentIndex / 3);
  const curCol = currentIndex % 3;
  const goalRow = Math.floor(tileValue / 3);
  const goalCol = tileValue % 3;
  return Math.abs(curRow - goalRow) + Math.abs(curCol - goalCol);
}

export function getBoardManhattan(board) {
  if (!board || board.length !== 9) return 0;
  return board.reduce((sum, val, idx) => sum + getTileDistance(val, idx), 0);
}

export function playTickSound(enabled, freq = 320) {
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
    gain.gain.setValueAtTime(0.025, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.045);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.05);
  } catch {
    // Ignore audio restrictions
  }
}