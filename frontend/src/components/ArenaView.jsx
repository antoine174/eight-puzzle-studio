import React, { useState, useEffect, useMemo, useRef } from "react";
import { AnimatePresence } from "framer-motion";
import {
  Play,
  Pause,
  RotateCcw,
  SkipBack,
  SkipForward,
  Trophy,
  ArrowLeft,
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
    <div style={{ maxWidth: "1480px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "22px" }}>
      {/* 1. Master Broadcast Control Bar */}
      <div
        style={{
          backgroundColor: "#0f1523",
          border: "1px solid #26324d",
          borderRadius: "16px",
          padding: "16px 22px",
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "16px",
          boxShadow: "0 8px 30px rgba(0,0,0,0.45)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
          <button
            onClick={onBack}
            style={{
              padding: "9px 14px",
              borderRadius: "10px",
              backgroundColor: "#161f33",
              border: "1px solid #334155",
              color: "#e2e8f0",
              fontWeight: 700,
              fontSize: "12px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            <ArrowLeft size={15} />
            Back
          </button>

          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <Trophy size={18} color="#f59e0b" />
              <span style={{ fontSize: "16px", fontWeight: 800 }}>
                Multi-Algorithm Arena Command Center
              </span>
              <span
                style={{
                  fontFamily: "monospace",
                  fontSize: "12px",
                  padding: "2px 8px",
                  borderRadius: "6px",
                  backgroundColor: "#090d16",
                  border: "1px solid #10b981",
                  color: "#34d399",
                }}
              >
                Board: [{inputStr}]
              </span>
            </div>
            <div style={{ fontSize: "12px", color: "#94a3b8", marginTop: "3px" }}>
              Full uncapped paths loaded • Race all 5 boards together or scrub each individually
            </div>
          </div>
        </div>

        {/* Master Timeline Controls */}
        <div style={{ display: "flex", alignItems: "center", gap: "12px", flex: 1, maxWidth: "560px" }}>
          <button onClick={handleMasterReset} style={miniBtnStyle} title="Reset All 5 Boards">
            <RotateCcw size={15} />
          </button>

          <button
            onClick={() => {
              if (masterStep >= maxArenaSteps) handleMasterScrub(0);
              setMasterPlaying(!masterPlaying);
            }}
            style={{
              padding: "9px 18px",
              borderRadius: "10px",
              border: "none",
              backgroundColor: masterPlaying ? "#f59e0b" : "#10b981",
              color: "#052e16",
              fontWeight: 800,
              fontSize: "12px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "6px",
              whiteSpace: "nowrap",
            }}
          >
            {masterPlaying ? <Pause size={15} /> : <Play size={15} />}
            {masterPlaying ? "PAUSE ALL 5" : "RACE ALL 5"}
          </button>

          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "4px" }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontSize: "10px",
                fontFamily: "monospace",
                color: "#94a3b8",
              }}
            >
              <span>MASTER TIMELINE</span>
              <span>
                STEP {masterStep.toLocaleString()} / {maxArenaSteps.toLocaleString()}
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={maxArenaSteps}
              value={masterStep}
              onChange={(e) => handleMasterScrub(Number(e.target.value))}
              style={{ width: "100%", accentColor: "#10b981", cursor: "pointer" }}
            />
          </div>

          <select
            value={masterSpeed}
            onChange={(e) => setMasterSpeed(Number(e.target.value))}
            style={{
              backgroundColor: "#141c2e",
              color: "#e2e8f0",
              border: "1px solid #26324d",
              borderRadius: "8px",
              padding: "8px 10px",
              fontSize: "12px",
              cursor: "pointer",
            }}
          >
            <option value={0.5}>0.5x Slow</option>
            <option value={1}>1.0x Normal</option>
            <option value={2.5}>2.5x Fast</option>
            <option value={10}>10x Turbo</option>
            <option value={50}>50x Warp</option>
          </select>
        </div>
      </div>

      {/* 2. Executive Podium Highlights */}
      {arenaAwards && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "16px" }}>
          <PodiumCard
            icon={<Zap size={18} color="#fbbf24" />}
            badge="SPEED CHAMPION"
            title={arenaAwards.fastest.algorithm}
            metric={`${arenaAwards.fastest.running_time_ms} ms`}
            sub="Lowest execution latency on backend"
            borderColor="rgba(251, 191, 36, 0.35)"
          />
          <PodiumCard
            icon={<Cpu size={18} color="#38bdf8" />}
            badge="SMARTEST HEURISTIC (FEWEST NODES)"
            title={arenaAwards.fewestNodes.algorithm}
            metric={`${arenaAwards.fewestNodes.nodes_expanded.toLocaleString()} nodes`}
            sub="Highest pruning efficiency in state space"
            borderColor="rgba(56, 189, 248, 0.35)"
          />
          <PodiumCard
            icon={<Award size={18} color="#10b981" />}
            badge="OPTIMAL SHORTEST PATH"
            title={`${arenaAwards.minCostVal} Moves`}
            metric={arenaAwards.optimalAlgos}
            sub="Guaranteed minimum solution cost"
            borderColor="rgba(16, 185, 129, 0.35)"
          />
        </div>
      )}

      {/* 3. Five Simultaneous Interactive Algorithm Board Decks */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "14px" }}>
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
            <div
              key={r.algorithm}
              style={{
                backgroundColor: "#0f1523",
                border: isGoalReached ? "1.5px solid #10b981" : "1px solid #1e293b",
                borderRadius: "14px",
                padding: "14px",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                gap: "10px",
              }}
            >
              <div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: "6px",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "7px" }}>
                    <span
                      style={{
                        width: "9px",
                        height: "9px",
                        borderRadius: "50%",
                        backgroundColor: accent,
                        boxShadow: `0 0 8px ${accent}`,
                      }}
                    />
                    <span style={{ fontWeight: 800, fontSize: "13px" }}>{r.algorithm}</span>
                  </div>
                  <span
                    style={{
                      fontSize: "10px",
                      fontFamily: "monospace",
                      padding: "2px 6px",
                      borderRadius: "6px",
                      backgroundColor: isGoalReached
                        ? "rgba(16, 185, 129, 0.2)"
                        : "#141c2e",
                      color: isGoalReached ? "#34d399" : "#94a3b8",
                    }}
                  >
                    {isGoalReached ? "SOLVED ✓" : `h=${getBoardManhattan(frameObj.board)}`}
                  </span>
                </div>

                {r.algorithm !== "DFS" ? (
                  <div style={{ display: "flex", gap: "4px", marginBottom: "6px" }}>
                    <button
                      onClick={() => updateCardState({ mode: "goal", step: 0, isPlaying: false })}
                      style={{
                        flex: 1,
                        padding: "4px 6px",
                        fontSize: "10px",
                        fontWeight: 700,
                        borderRadius: "6px",
                        cursor: "pointer",
                        border: st.mode === "goal" ? "1px solid #10b981" : "1px solid #1e293b",
                        backgroundColor:
                          st.mode === "goal" ? "rgba(16, 185, 129, 0.14)" : "#090d16",
                        color: st.mode === "goal" ? "#34d399" : "#64748b",
                      }}
                    >
                      Goal ({r.cost_of_path})
                    </button>
                    <button
                      onClick={() =>
                        updateCardState({ mode: "expansion", step: 0, isPlaying: false })
                      }
                      style={{
                        flex: 1,
                        padding: "4px 6px",
                        fontSize: "10px",
                        fontWeight: 700,
                        borderRadius: "6px",
                        cursor: "pointer",
                        border:
                          st.mode === "expansion" ? "1px solid #f59e0b" : "1px solid #1e293b",
                        backgroundColor:
                          st.mode === "expansion" ? "rgba(245, 158, 11, 0.14)" : "#090d16",
                        color: st.mode === "expansion" ? "#fbbf24" : "#64748b",
                      }}
                    >
                      Expand ({r.expanded_steps?.length || 0})
                    </button>
                  </div>
                ) : (
                  <div
                    style={{
                      fontSize: "10px",
                      fontFamily: "monospace",
                      color: "#a855f7",
                      backgroundColor: "rgba(168, 85, 247, 0.1)",
                      padding: "4px 8px",
                      borderRadius: "6px",
                      textAlign: "center",
                      marginBottom: "6px",
                    }}
                  >
                    Full Goal Path ({r.cost_of_path.toLocaleString()} moves)
                  </div>
                )}
              </div>

              <PuzzleBoardGrid board={frameObj.board} size={185} compact animateLayout={false} />

              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: "10px",
                  fontFamily: "monospace",
                  color: "#94a3b8",
                }}
              >
                <span>
                  #{safeIdx.toLocaleString()}/{maxIdx.toLocaleString()}
                </span>
                <span
                  style={{
                    color: "#e2e8f0",
                    maxWidth: "110px",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {frameObj.action}
                </span>
              </div>

              <div>
                <input
                  type="range"
                  min={0}
                  max={maxIdx}
                  value={safeIdx}
                  onChange={(e) => {
                    setMasterPlaying(false);
                    updateCardState({ step: Number(e.target.value), isPlaying: false });
                  }}
                  style={{ width: "100%", accentColor: accent, cursor: "pointer", marginBottom: "6px" }}
                />

                <div style={{ display: "flex", justifyContent: "space-between", gap: "4px" }}>
                  <button
                    onClick={() => updateCardState({ step: 0, isPlaying: false })}
                    style={miniBtnStyle}
                  >
                    <RotateCcw size={12} />
                  </button>
                  <button
                    onClick={() =>
                      updateCardState({ step: Math.max(0, safeIdx - 1), isPlaying: false })
                    }
                    style={miniBtnStyle}
                  >
                    <SkipBack size={12} />
                  </button>
                  <button
                    onClick={() => {
                      setMasterPlaying(false);
                      const nextStep = safeIdx >= maxIdx ? 0 : safeIdx;
                      updateCardState({ step: nextStep, isPlaying: !st.isPlaying });
                    }}
                    style={{
                      ...miniBtnStyle,
                      flex: 1,
                      backgroundColor: st.isPlaying ? "#f59e0b" : accent,
                      color: "#052e16",
                      fontWeight: 800,
                      border: "none",
                    }}
                  >
                    {st.isPlaying ? <Pause size={12} /> : <Play size={12} />}
                    <span style={{ marginLeft: "4px", fontSize: "10px" }}>
                      {st.isPlaying ? "PAUSE" : "RUN"}
                    </span>
                  </button>
                  <button
                    onClick={() =>
                      updateCardState({ step: Math.min(maxIdx, safeIdx + 1), isPlaying: false })
                    }
                    style={miniBtnStyle}
                  >
                    <SkipForward size={12} />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* 4. Graphical SVG Telemetry Plots + 5-Axis Radar Chart */}
      <div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "12px",
            flexWrap: "wrap",
            gap: "10px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <BarChart3 size={18} color="#10b981" />
            <span
              style={{
                fontSize: "12px",
                fontWeight: 700,
                letterSpacing: "0.08em",
                color: "#94a3b8",
                fontFamily: "monospace",
              }}
            >
              GRAPHICAL TELEMETRY PLOTS (CLICK ANY GRAPH TO EXPAND)
            </span>
          </div>

          <div style={{ display: "flex", gap: "10px" }}>
            {/* Graph Type Switcher */}
            <div
              style={{
                display: "flex",
                backgroundColor: "#0f1523",
                padding: "4px",
                borderRadius: "8px",
                border: "1px solid #1e293b",
              }}
            >
              <button
                onClick={() => setChartType("bar")}
                style={{
                  padding: "4px 10px",
                  borderRadius: "6px",
                  border: "none",
                  cursor: "pointer",
                  fontWeight: 700,
                  fontSize: "11px",
                  backgroundColor: chartType === "bar" ? "#3b82f6" : "transparent",
                  color: chartType === "bar" ? "#f8fafc" : "#94a3b8",
                }}
              >
                Column Bars
              </button>
              <button
                onClick={() => setChartType("line")}
                style={{
                  padding: "4px 10px",
                  borderRadius: "6px",
                  border: "none",
                  cursor: "pointer",
                  fontWeight: 700,
                  fontSize: "11px",
                  backgroundColor: chartType === "line" ? "#3b82f6" : "transparent",
                  color: chartType === "line" ? "#f8fafc" : "#94a3b8",
                }}
              >
                Area / Line Curves
              </button>
            </div>

            {/* Log10 vs Linear Switcher */}
            <div
              style={{
                display: "flex",
                backgroundColor: "#0f1523",
                padding: "4px",
                borderRadius: "8px",
                border: "1px solid #1e293b",
              }}
            >
              <button
                onClick={() => setLogScale(true)}
                style={{
                  padding: "4px 10px",
                  borderRadius: "6px",
                  border: "none",
                  cursor: "pointer",
                  fontWeight: 700,
                  fontSize: "11px",
                  backgroundColor: logScale ? "#10b981" : "transparent",
                  color: logScale ? "#052e16" : "#94a3b8",
                }}
              >
                Log₁₀ Scale
              </button>
              <button
                onClick={() => setLogScale(false)}
                style={{
                  padding: "4px 10px",
                  borderRadius: "6px",
                  border: "none",
                  cursor: "pointer",
                  fontWeight: 700,
                  fontSize: "11px",
                  backgroundColor: !logScale ? "#10b981" : "transparent",
                  color: !logScale ? "#052e16" : "#94a3b8",
                }}
              >
                Linear Scale
              </button>
            </div>
          </div>
        </div>

        {/* 3x2 Grid: 5 Metric Graphs + 1 Multi-Axis Radar Spider Chart */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: "16px",
          }}
        >
          {METRIC_CONFIGS.map((metric) => (
            <MetricPlotCard
              key={metric.key}
              metric={metric}
              data={arenaResults}
              logScale={logScale}
              chartType={chartType}
              onExpand={() => setExpandedMetric(metric)}
            />
          ))}
          <MultiMetricRadarChart data={arenaResults} />
        </div>
      </div>

      {/* 5. Official Benchmark Comparison Table */}
      <div
        style={{
          backgroundColor: "#0f1523",
          border: "1px solid #1e293b",
          borderRadius: "14px",
          padding: "20px",
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
          <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "15px", fontWeight: 800 }}>
            <Trophy size={18} color="#f59e0b" />
            <span>Arena Multi-Algorithm Benchmark Comparison</span>
          </div>

          <button
            onClick={handleCopyMarkdown}
            style={{
              padding: "7px 12px",
              borderRadius: "8px",
              backgroundColor: copiedTable ? "rgba(16, 185, 129, 0.2)" : "#161f33",
              border: copiedTable ? "1px solid #10b981" : "1px solid #26324d",
              color: copiedTable ? "#34d399" : "#cbd5e1",
              fontSize: "12px",
              fontWeight: 600,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            {copiedTable ? <Check size={14} /> : <Copy size={14} />}
            {copiedTable ? "Copied Markdown!" : "Copy as Markdown Table"}
          </button>
        </div>

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
              <th style={{ padding: "12px 10px" }}>Algorithm</th>
              <th style={{ padding: "12px 10px" }}>Cost of Path</th>
              <th style={{ padding: "12px 10px" }}>Nodes Expanded</th>
              <th style={{ padding: "12px 10px" }}>Search Depth</th>
              <th style={{ padding: "12px 10px" }}>Max Depth</th>
              <th style={{ padding: "12px 10px" }}>Running Time (ms)</th>
            </tr>
          </thead>
          <tbody>
            {arenaResults.map((row) => {
              const accent = getAlgoColor(row.algorithm);
              return (
                <tr key={row.algorithm} style={{ borderBottom: "1px solid #141c2e" }}>
                  <td
                    style={{
                      padding: "12px 10px",
                      fontWeight: 800,
                      color: "#f8fafc",
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                    }}
                  >
                    <span
                      style={{
                        width: "8px",
                        height: "8px",
                        borderRadius: "50%",
                        backgroundColor: accent,
                      }}
                    />
                    {row.algorithm}
                  </td>
                  <td style={{ padding: "12px 10px", color: "#10b981", fontWeight: 700 }}>
                    {row.cost_of_path.toLocaleString()}
                  </td>
                  <td style={{ padding: "12px 10px", color: "#60a5fa", fontWeight: 700 }}>
                    {row.nodes_expanded.toLocaleString()}
                  </td>
                  <td style={{ padding: "12px 10px" }}>{row.search_depth.toLocaleString()}</td>
                  <td style={{ padding: "12px 10px", color: "#f97316" }}>
                    {row.max_search_depth.toLocaleString()}
                  </td>
                  <td style={{ padding: "12px 10px", color: "#fbbf24", fontWeight: 700 }}>
                    {row.running_time_ms} ms
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

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
    </div>
  );
}

function PodiumCard({ icon, badge, title, metric, sub, borderColor }) {
  return (
    <div
      style={{
        backgroundColor: "#0f1523",
        border: `1px solid ${borderColor}`,
        borderRadius: "14px",
        padding: "16px 18px",
        display: "flex",
        flexDirection: "column",
        gap: "6px",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        {icon}
        <span
          style={{
            fontSize: "10px",
            fontFamily: "monospace",
            fontWeight: 700,
            letterSpacing: "0.08em",
            color: "#94a3b8",
          }}
        >
          {badge}
        </span>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <span style={{ fontSize: "18px", fontWeight: 800, color: "#f8fafc" }}>{title}</span>
        <span style={{ fontSize: "14px", fontFamily: "monospace", fontWeight: 700, color: "#10b981" }}>
          {metric}
        </span>
      </div>
      <div style={{ fontSize: "11px", color: "#64748b" }}>{sub}</div>
    </div>
  );
}

const miniBtnStyle = {
  backgroundColor: "#141c2e",
  border: "1px solid #26324d",
  color: "#cbd5e1",
  borderRadius: "6px",
  padding: "6px 8px",
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};