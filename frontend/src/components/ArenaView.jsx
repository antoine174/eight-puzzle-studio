import React, { useState, useEffect, useMemo, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Play,
  Pause,
  RotateCcw,
  SkipBack,
  SkipForward,
  Trophy,
  BarChart3,
  Zap,
  Cpu,
  Award,
  Copy,
  Check,
} from "lucide-react";
import PuzzleBoardGrid from "./PuzzleBoardGrid";
import {
  MetricPlotCard,
  MultiMetricRadarChart,
  ExpandedPlotModal,
} from "./TelemetryCharts";
import { AnimatedNumber, Segmented, stagger, rise, SPRING_SNAP } from "./ui";
import { skin, TONE } from "../utils/theme";
import {
  METRIC_CONFIGS,
  getAlgoColor,
  getBoardManhattan,
  playTickSound,
} from "../utils/puzzleHelpers";

export default function ArenaView({
  arenaResults,
  inputStr,
  parsedBoard,
  isSolvable,
  soundEnabled,
  onBack,
}) {
  const [arenaStates, setArenaStates] = useState(() => {
    const map = {};
    arenaResults.forEach((item) => {
      map[item.algorithm] = { step: 0, isPlaying: false, mode: "goal" };
    });
    return map;
  });

  const [masterPlaying, setMasterPlaying] = useState(false);
  const [masterStep, setMasterStep] = useState(0);
  const [masterSpeed, setMasterSpeed] = useState(1);

  const [logScale, setLogScale] = useState(true);
  const [chartType, setChartType] = useState("bar"); // "bar" | "line"
  const [expandedMetric, setExpandedMetric] = useState(null);
  const [copiedTable, setCopiedTable] = useState(false);

  const arenaTimerRef = useRef(null);

  const maxArenaSteps = useMemo(() => {
    if (!arenaResults.length) return 0;
    return Math.max(
      ...arenaResults.map((r) => {
        const st = arenaStates[r.algorithm];
        const steps =
          st?.mode === "expansion" && r.expanded_steps?.length
            ? r.expanded_steps
            : r.traceable_steps || [];
        return Math.max(0, steps.length - 1);
      })
    );
  }, [arenaResults, arenaStates]);

  // Simultaneous & Individual Playback Timer
  useEffect(() => {
    const anyIndividualPlaying = Object.values(arenaStates).some((s) => s?.isPlaying);
    if (!masterPlaying && !anyIndividualPlaying) {
      clearInterval(arenaTimerRef.current);
      return;
    }

    const intervalMs = Math.max(16, Math.round(380 / masterSpeed));
    arenaTimerRef.current = setInterval(() => {
      let ticked = false;

      setArenaStates((prev) => {
        const next = { ...prev };
        let stillRunning = false;

        arenaResults.forEach((r) => {
          const st = prev[r.algorithm] || { step: 0, isPlaying: false, mode: "goal" };
          const steps =
            st.mode === "expansion" && r.expanded_steps?.length
              ? r.expanded_steps
              : r.traceable_steps || [];
          const maxIdx = Math.max(0, steps.length - 1);

          if (masterPlaying || st.isPlaying) {
            if (st.step < maxIdx) {
              next[r.algorithm] = { ...st, step: st.step + 1 };
              stillRunning = true;
              ticked = true;
            } else {
              next[r.algorithm] = { ...st, isPlaying: false };
            }
          }
        });

        if (masterPlaying && !stillRunning) {
          setMasterPlaying(false);
        }
        return next;
      });

      if (masterPlaying) {
        setMasterStep((s) => Math.min(maxArenaSteps, s + 1));
      }
      if (ticked) {
        playTickSound(soundEnabled, 350);
      }
    }, intervalMs);

    return () => clearInterval(arenaTimerRef.current);
  }, [arenaResults, arenaStates, masterPlaying, masterSpeed, maxArenaSteps, soundEnabled]);

  const handleMasterScrub = (newStep) => {
    setMasterPlaying(false);
    setMasterStep(newStep);
    setArenaStates((prev) => {
      const next = { ...prev };
      arenaResults.forEach((r) => {
        const st = prev[r.algorithm] || { step: 0, isPlaying: false, mode: "goal" };
        const steps =
          st.mode === "expansion" && r.expanded_steps?.length
            ? r.expanded_steps
            : r.traceable_steps || [];
        const maxIdx = Math.max(0, steps.length - 1);
        next[r.algorithm] = {
          ...st,
          isPlaying: false,
          step: Math.min(newStep, maxIdx),
        };
      });
      return next;
    });
  };

  const handleMasterReset = () => {
    setMasterPlaying(false);
    setMasterStep(0);
    setArenaStates((prev) => {
      const next = { ...prev };
      Object.keys(next).forEach((k) => {
        next[k] = { ...next[k], step: 0, isPlaying: false };
      });
      return next;
    });
  };

  const handleCopyMarkdown = () => {
    if (!arenaResults.length) return;
    const header =
      "| Algorithm | Cost of Path | Nodes Expanded | Search Depth | Max Depth | Running Time (ms) |\n|---|---|---|---|---|---|\n";
    const rows = arenaResults
      .map(
        (r) =>
          `| ${r.algorithm} | ${r.cost_of_path} | ${r.nodes_expanded} | ${r.search_depth} | ${r.max_search_depth} | ${r.running_time_ms} ms |`
      )
      .join("\n");
    navigator.clipboard.writeText(header + rows);
    setCopiedTable(true);
    setTimeout(() => setCopiedTable(false), 2000);
  };

  const arenaAwards = useMemo(() => {
    if (!arenaResults.length) return null;
    const solved = arenaResults.filter((r) => r.cost_of_path > 0 || isSolvable);
    if (!solved.length) return null;

    const fastest = [...solved].sort((a, b) => a.running_time_ms - b.running_time_ms)[0];
    const fewestNodes = [...solved].sort((a, b) => a.nodes_expanded - b.nodes_expanded)[0];
    const minCostVal = Math.min(...solved.map((r) => r.cost_of_path));
    const optimalAlgos = solved
      .filter((r) => r.cost_of_path === minCostVal)
      .map((r) => r.algorithm)
      .join(", ");

    return { fastest, fewestNodes, minCostVal, optimalAlgos };
  }, [arenaResults, isSolvable]);

  return (
    <motion.div className="arena" variants={stagger(0.12)} initial="hidden" animate="show">
      {/* 1. Master broadcast console */}
      <motion.section className="glass z3 arena-hero" variants={rise}>
        <div>
          <div className="eyebrow">
            <Trophy size={13} color={TONE.amber} />
            <b style={{ color: TONE.amber }}>Arena</b> · multi-algorithm command centre
          </div>
          <h2 className="arena-title">
            Five minds,
            <em>one board.</em>
          </h2>
          <div className="board-tag">BOARD [{inputStr}]</div>
          <div className="eyebrow" style={{ marginTop: 18, maxWidth: 420 }}>
            Full uncapped paths loaded
          </div>
        </div>

        <div className="arena-ctrl">
          <div className="arena-ctrl-row">
            <motion.button
              type="button"
              className="btn btn-ghost btn-icon"
              onClick={handleMasterReset}
              title="Reset All 5 Boards"
              whileTap={{ scale: 0.88, rotate: -120 }}
            >
              <RotateCcw size={15} />
            </motion.button>

            <motion.button
              type="button"
              className={`btn ${masterPlaying ? "btn-amber" : "btn-primary"}`}
              onClick={() => {
                if (masterStep >= maxArenaSteps) handleMasterScrub(0);
                setMasterPlaying(!masterPlaying);
              }}
              whileHover={{ y: -2 }}
              whileTap={{ scale: 0.96 }}
              style={{ minWidth: 168 }}
            >
              {masterPlaying ? <Pause size={15} /> : <Play size={15} />}
              {masterPlaying ? "Pause all 5" : "Race all 5"}
            </motion.button>

            <Segmented
              layoutKey="master-speed"
              small
              accent={TONE.amber}
              value={masterSpeed}
              onChange={(v) => setMasterSpeed(Number(v))}
              options={[
                { value: 0.5, label: "0.5×", title: "0.5x Slow" },
                { value: 1, label: "1×", title: "1.0x Normal" },
                { value: 2.5, label: "2.5×", title: "2.5x Fast" },
                { value: 10, label: "10×", title: "10x Turbo" },
                { value: 50, label: "50×", title: "50x Warp" },
              ]}
            />
          </div>

          <div>
            <div className="eyebrow" style={{ justifyContent: "space-between", marginBottom: 2 }}>
              <span>Master timeline</span>
              <span style={{ flex: "none" }}>
                STEP {masterStep.toLocaleString()} / {maxArenaSteps.toLocaleString()}
              </span>
            </div>
            <input
              type="range"
              className="scrub"
              style={{ "--p": `${maxArenaSteps > 0 ? (masterStep / maxArenaSteps) * 100 : 0}%`, "--ac": TONE.amber }}
              min={0}
              max={maxArenaSteps}
              value={masterStep}
              onChange={(e) => handleMasterScrub(Number(e.target.value))}
              aria-label="Master timeline"
            />
            <div className="lanes">
              {arenaResults.map((r) => {
                const st = arenaStates[r.algorithm] || { step: 0, isPlaying: false, mode: "goal" };
                const steps =
                  st.mode === "expansion" && r.expanded_steps?.length
                    ? r.expanded_steps
                    : r.traceable_steps || [];
                const mx = Math.max(0, steps.length - 1);
                const frac = mx > 0 ? Math.min(1, st.step / mx) : 0;
                return (
                  <div key={r.algorithm} className="lane" style={{ "--c": skin(getAlgoColor(r.algorithm)) }}>
                    <motion.i animate={{ width: `${frac * 100}%` }} transition={{ type: "spring", stiffness: 140, damping: 24 }} />
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </motion.section>

      {/* 2. Podium — staggered elevations */}
      {arenaAwards && (
        <motion.section className="podium" variants={stagger(0.14)}>
          <PodiumCard
            rank="02"
            icon={<Zap size={16} />}
            badge="Speed champion"
            title={arenaAwards.fastest.algorithm}
            metric={<AnimatedNumber value={arenaAwards.fastest.running_time_ms} />}
            unit="ms"
            sub="Lowest execution latency on backend"
            accent={TONE.amberHot}
          />
          <PodiumCard
            rank="01"
            icon={<Cpu size={16} />}
            badge="Smartest heuristic · fewest nodes"
            title={arenaAwards.fewestNodes.algorithm}
            metric={<AnimatedNumber value={arenaAwards.fewestNodes.nodes_expanded} />}
            unit="nodes"
            sub="Highest pruning efficiency in state space"
            accent={TONE.cyan}
          />
          <PodiumCard
            rank="03"
            icon={<Award size={16} />}
            badge="Optimal shortest path"
            title={
              <>
                <AnimatedNumber value={arenaAwards.minCostVal} /> Moves
              </>
            }
            metric={<span style={{ fontSize: "0.6em", letterSpacing: "-0.03em" }}>{arenaAwards.optimalAlgos}</span>}
            sub="Guaranteed minimum solution cost"
            accent={TONE.emerald}
          />
        </motion.section>
      )}

      {/* 3. Five simultaneous algorithm decks */}
      <motion.section className="decks" variants={stagger(0.1)}>
        {arenaResults.map((r) => {
          const st = arenaStates[r.algorithm] || { step: 0, isPlaying: false, mode: "goal" };
          const steps =
            st.mode === "expansion" && r.expanded_steps?.length
              ? r.expanded_steps
              : r.traceable_steps || [];
          const maxIdx = Math.max(0, steps.length - 1);
          const safeIdx = Math.min(st.step, maxIdx);
          const frameObj = steps[safeIdx] || {
            board: parsedBoard || [0, 1, 2, 3, 4, 5, 6, 7, 8],
            action: "Initial",
          };
          const accent = getAlgoColor(r.algorithm);
          const isGoalReached =
            frameObj.board && frameObj.board.every((val, index) => val === index);

          const updateCardState = (patch) => {
            setArenaStates((prev) => ({
              ...prev,
              [r.algorithm]: {
                ...(prev[r.algorithm] || { step: 0, isPlaying: false, mode: "goal" }),
                ...patch,
              },
            }));
          };

          return (
            <motion.article
              key={r.algorithm}
              className="glass z2 deck"
              style={{ "--c": skin(accent) }}
              variants={rise}
              whileHover={{ y: -6 }}
              transition={SPRING_SNAP}
            >
              <div className="deck-head">
                <div className="deck-name">
                  <i />
                  <span>{r.algorithm}</span>
                </div>
                <AnimatePresence mode="wait" initial={false}>
                  <motion.span
                    key={isGoalReached ? "solved" : "h"}
                    className={`h-badge ${isGoalReached ? "solved" : ""}`}
                    initial={{ scale: 0.6, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.6, opacity: 0 }}
                    transition={{ duration: 0.18 }}
                  >
                    {isGoalReached ? "SOLVED ✓" : `h=${getBoardManhattan(frameObj.board)}`}
                  </motion.span>
                </AnimatePresence>
              </div>

              {r.algorithm !== "DFS" ? (
                <Segmented
                  small
                  layoutKey={`mode-${r.algorithm}`}
                  accent={st.mode === "goal" ? TONE.emerald : TONE.amber}
                  value={st.mode}
                  onChange={(mode) => updateCardState({ mode, step: 0, isPlaying: false })}
                  options={[
                    { value: "goal", label: `Goal (${r.cost_of_path})` },
                    { value: "expansion", label: `Expand (${r.expanded_steps?.length || 0})` },
                  ]}
                />
              ) : (
                <div className="deck-note">Full goal path ({r.cost_of_path.toLocaleString()} moves)</div>
              )}

              <PuzzleBoardGrid board={frameObj.board} size={210} compact animateLayout={false} />

              <div className="deck-info">
                <span>
                  #{safeIdx.toLocaleString()}/{maxIdx.toLocaleString()}
                </span>
                <span>{frameObj.action}</span>
              </div>

              <div>
                <input
                  type="range"
                  className="scrub"
                  style={{ "--p": `${maxIdx > 0 ? (safeIdx / maxIdx) * 100 : 0}%`, "--ac": skin(accent) }}
                  min={0}
                  max={maxIdx}
                  value={safeIdx}
                  onChange={(e) => {
                    setMasterPlaying(false);
                    updateCardState({ step: Number(e.target.value), isPlaying: false });
                  }}
                  aria-label={`${r.algorithm} scrubber`}
                />

                <div className="deck-btns">
                  <motion.button
                    type="button"
                    className="mini"
                    onClick={() => updateCardState({ step: 0, isPlaying: false })}
                    whileTap={{ scale: 0.85 }}
                  >
                    <RotateCcw size={12} />
                  </motion.button>
                  <motion.button
                    type="button"
                    className="mini"
                    onClick={() =>
                      updateCardState({ step: Math.max(0, safeIdx - 1), isPlaying: false })
                    }
                    whileTap={{ scale: 0.85 }}
                  >
                    <SkipBack size={12} />
                  </motion.button>
                  <motion.button
                    type="button"
                    className={`mini run ${st.isPlaying ? "paused" : ""}`}
                    onClick={() => {
                      setMasterPlaying(false);
                      const nextStep = safeIdx >= maxIdx ? 0 : safeIdx;
                      updateCardState({ step: nextStep, isPlaying: !st.isPlaying });
                    }}
                    whileTap={{ scale: 0.92 }}
                  >
                    {st.isPlaying ? <Pause size={12} /> : <Play size={12} />}
                    <span>{st.isPlaying ? "PAUSE" : "RUN"}</span>
                  </motion.button>
                  <motion.button
                    type="button"
                    className="mini"
                    onClick={() =>
                      updateCardState({ step: Math.min(maxIdx, safeIdx + 1), isPlaying: false })
                    }
                    whileTap={{ scale: 0.85 }}
                  >
                    <SkipForward size={12} />
                  </motion.button>
                </div>
              </div>
            </motion.article>
          );
        })}
      </motion.section>

      {/* 4. HUD plots + radar */}
      <motion.section variants={rise}>
        <div className="section-head">
          <div>
            <div className="eyebrow">
              <BarChart3 size={13} color={TONE.emerald} /> <b>Telemetry</b> · click any figure to expand
            </div>
            <h2 className="section-title">
              Graphical <em>telemetry plots</em>
            </h2>
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Segmented
              layoutKey="chart-type"
              accent={TONE.cyan}
              value={chartType}
              onChange={setChartType}
              options={[
                { value: "bar", label: "Column bars" },
                { value: "line", label: "Area / curves" },
              ]}
            />
            <Segmented
              layoutKey="chart-scale"
              accent={TONE.emerald}
              value={logScale}
              onChange={setLogScale}
              options={[
                { value: true, label: "Log₁₀" },
                { value: false, label: "Linear" },
              ]}
            />
          </div>
        </div>

        <div className="plots">
          <MultiMetricRadarChart data={arenaResults} />
          {METRIC_CONFIGS.map((metric, idx) => (
            <MetricPlotCard
              key={metric.key}
              metric={metric}
              data={arenaResults}
              logScale={logScale}
              chartType={chartType}
              index={idx}
              wide={idx === METRIC_CONFIGS.length - 1}
              onExpand={() => setExpandedMetric(metric)}
            />
          ))}
        </div>
      </motion.section>

      {/* 5. Benchmark ledger */}
      <motion.section className="glass z2 ledger" variants={rise}>
        <div className="section-head" style={{ marginBottom: 18 }}>
          <div>
            <div className="eyebrow">
              <Trophy size={13} color={TONE.amber} /> <b style={{ color: TONE.amber }}>Ledger</b> · official benchmark
            </div>
            <h2 className="section-title" style={{ fontSize: "clamp(26px,2.8vw,42px)" }}>
              Arena multi-algorithm <em>comparison</em>
            </h2>
          </div>

          <motion.button
            type="button"
            className={`btn ${copiedTable ? "btn-primary" : "btn-ghost"}`}
            onClick={handleCopyMarkdown}
            whileTap={{ scale: 0.95 }}
          >
            <AnimatePresence mode="wait" initial={false}>
              <motion.span
                key={copiedTable ? "c" : "n"}
                style={{ display: "grid" }}
                initial={{ opacity: 0, scale: 0.4, rotate: -40 }}
                animate={{ opacity: 1, scale: 1, rotate: 0 }}
                exit={{ opacity: 0, scale: 0.4 }}
                transition={{ duration: 0.16 }}
              >
                {copiedTable ? <Check size={14} /> : <Copy size={14} />}
              </motion.span>
            </AnimatePresence>
            {copiedTable ? "Copied Markdown!" : "Copy as Markdown Table"}
          </motion.button>
        </div>

        <table>
          <thead>
            <tr>
              <th>Algorithm</th>
              <th>Cost of Path</th>
              <th>Nodes Expanded</th>
              <th>Search Depth</th>
              <th>Max Depth</th>
              <th>Running Time (ms)</th>
            </tr>
          </thead>
          <motion.tbody variants={stagger(0.08, 0.1)} initial="hidden" whileInView="show" viewport={{ once: true }}>
            {arenaResults.map((row) => {
              const accent = skin(getAlgoColor(row.algorithm));
              const cols = [
                { k: "cost_of_path", v: row.cost_of_path, fmt: (v) => v.toLocaleString() },
                { k: "nodes_expanded", v: row.nodes_expanded, fmt: (v) => v.toLocaleString() },
                { k: "search_depth", v: row.search_depth, fmt: (v) => v.toLocaleString() },
                { k: "max_search_depth", v: row.max_search_depth, fmt: (v) => v.toLocaleString() },
                { k: "running_time_ms", v: row.running_time_ms, fmt: (v) => `${v} ms` },
              ];
              return (
                <motion.tr
                  key={row.algorithm}
                  style={{ "--c": accent }}
                  variants={{
                    hidden: { opacity: 0, x: -30 },
                    show: { opacity: 1, x: 0, transition: { type: "spring", stiffness: 140, damping: 18 } },
                  }}
                >
                  <td>
                    <div className="cell-algo">
                      <i />
                      {row.algorithm}
                    </div>
                  </td>
                  {cols.map((c) => {
                    const all = arenaResults.map((x) => Number(x[c.k]) || 0);
                    const mxv = Math.max(...all, 0.0001);
                    const mnv = Math.min(...all);
                    const val = Number(c.v) || 0;
                    return (
                      <td key={c.k}>
                        <span className={`cell-val ${val === mnv ? "best" : ""}`}>{c.fmt(c.v)}</span>
                        <span className="cell-bar">
                          <motion.i
                            initial={{ width: 0 }}
                            whileInView={{ width: `${Math.max(3, (val / mxv) * 100)}%` }}
                            viewport={{ once: true }}
                            transition={{ type: "spring", stiffness: 50, damping: 16, delay: 0.3 }}
                          />
                        </span>
                      </td>
                    );
                  })}
                </motion.tr>
              );
            })}
          </motion.tbody>
        </table>
      </motion.section>

      {/* Fullscreen Plot Modal */}
      <AnimatePresence>
        {expandedMetric && (
          <ExpandedPlotModal
            metric={expandedMetric}
            data={arenaResults}
            logScale={logScale}
            setLogScale={setLogScale}
            onClose={() => setExpandedMetric(null)}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function PodiumCard({ rank, icon, badge, title, metric, unit, sub, accent }) {
  return (
    <motion.article
      className="glass z3 pod"
      style={{ "--pc": accent }}
      variants={rise}
      whileHover={{ y: -8, scale: 1.015 }}
      transition={SPRING_SNAP}
    >
      <span className="pod-glow" />
      <span className="pod-num" aria-hidden="true">
        {rank}
      </span>
      <div className="pod-badge">
        {icon}
        {badge}
      </div>
      <h3 className="pod-title">{title}</h3>
      <div className="pod-metric">
        {metric}
        {unit && <small>{unit}</small>}
      </div>
      <div className="pod-sub">{sub}</div>
    </motion.article>
  );
}
