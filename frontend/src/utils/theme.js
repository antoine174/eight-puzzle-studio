/**
 * View-layer palette. puzzleHelpers.js still owns the data; this module only
 * re-skins its stock Tailwind-ish hex codes into the studio's obsidian /
 * emerald / amber / cyan palette.
 */
const SKIN = {
  "#10b981": "#2ee6a6", // emerald  (A* Manhattan, cost)
  "#3b82f6": "#3df2ff", // cyan     (BFS, nodes)
  "#38bdf8": "#3df2ff",
  "#a855f7": "#dcc9a0", // bone     (DFS, depth)
  "#f97316": "#f0922b", // burnt amber (IDDFS, max depth)
  "#ec4899": "#ff6f91", // rose     (A* Euclidean)
  "#eab308": "#f6d77a", // pale gold (time)
  "#f59e0b": "#e8892b",
};

export const skin = (hex) => SKIN[(hex || "").toLowerCase()] || hex;

export const TONE = {
  emerald: "#2ee6a6",
  cyan: "#3df2ff",
  amber: "#f0922b",
  amberHot: "#ffb766",
  ember: "#ff6b57",
  bone: "#dcc9a0",
  ink: "#e9efe9",
};
