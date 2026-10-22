import React, { useId, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Maximize2, X, BarChart2, TrendingUp, Radar } from "lucide-react";
import { getAlgoColor, getShortAlgoName, METRIC_CONFIGS } from "../utils/puzzleHelpers";
import { skin } from "../utils/theme";
import { Segmented, SPRING_SNAP } from "./ui";

function normalizeValue(val, maxVal, logScale) {
  if (maxVal <= 0) return 0.05;
  if (!logScale) return Math.max(0.04, val / maxVal);
  const sVal = Math.log10(val * 100 + 1);
  const sMax = Math.log10(maxVal * 100 + 1);
  return Math.max(0.04, sVal / Math.max(sMax, 0.0001));
}

/* Catmull-Rom → cubic bezier, for liquid trend curves */
function smoothPath(pts, floorY, ceilY) {
  if (!pts.length) return "";
  if (pts.length === 1) return `M${pts[0].x},${pts[0].y}`;
  const clamp = (y) => Math.min(floorY, Math.max(ceilY, y));
  let d = `M${pts[0].x},${pts[0].y}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] || p2;
    const t = 0.17;
    d += ` C${p1.x + (p2.x - p0.x) * t},${clamp(p1.y + (p2.y - p0.y) * t)} ${p2.x - (p3.x - p1.x) * t},${clamp(
      p2.y - (p3.y - p1.y) * t
    )} ${p2.x},${p2.y}`;
  }
  return d;
}

const fmtVal = (metric, v) =>
  metric.key === "running_time_ms" ? `${v}` : v > 9999 ? `${(v / 1000).toFixed(1)}k` : v;

export function SvgMetricGraph({ data, metric, logScale, chartType = "bar", height = 175, width = 340 }) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const [hover, setHover] = useState(null);
  const padTop = 28;
  const padBottom = 34;
  const padLeft = 38;
  const padRight = 16;
  const plotW = width - padLeft - padRight;
  const plotH = height - padTop - padBottom;
  const base = padTop + plotH;
  const mc = skin(metric.color);

  const values = data.map((d) => Number(d[metric.key]) || 0);
  const maxVal = Math.max(...values, 0.001);
  const minVal = Math.min(...values);

  const points = data.map((d, i) => {
    const val = Number(d[metric.key]) || 0;
    const ratio = normalizeValue(val, maxVal, logScale);
    const x = padLeft + (plotW / Math.max(1, data.length - 1)) * i;
    const barSlotW = plotW / data.length;
    const barCenterX = padLeft + barSlotW * i + barSlotW / 2;
    const y = padTop + plotH * (1 - ratio);
    return {
      algo: d.algorithm,
      short: getShortAlgoName(d.algorithm),
      val,
      ratio,
      x: chartType === "line" ? x : barCenterX,
      y,
      color: skin(getAlgoColor(d.algorithm)),
      isBest: val === minVal,
    };
  });

  const linePath = smoothPath(points, base, padTop);
  const areaPath = points.length
    ? `${linePath} L${points[points.length - 1].x},${base} L${points[0].x},${base} Z`
    : "";
  const slotW = plotW / Math.max(1, data.length);

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      style={{ width: "100%", height: "auto", overflow: "visible" }}
      onPointerLeave={() => setHover(null)}
    >
      <defs>
        <filter id={`${uid}glow`} x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="3.2" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <pattern id={`${uid}scan`} width="4" height="3" patternUnits="userSpaceOnUse">
          <rect width="4" height="1" fill="#000" opacity="0.45" />
        </pattern>
        <linearGradient id={`${uid}area`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={mc} stopOpacity="0.5" />
          <stop offset="100%" stopColor={mc} stopOpacity="0" />
        </linearGradient>
        <linearGradient id={`${uid}fade`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#fff" stopOpacity="0.15" />
          <stop offset="0.5" stopColor="#fff" stopOpacity="1" />
          <stop offset="1" stopColor="#fff" stopOpacity="0.15" />
        </linearGradient>
        <mask id={`${uid}gridmask`}>
          <rect x={padLeft} y={padTop} width={plotW} height={plotH + 1} fill={`url(#${uid}fade)`} />
        </mask>
        {points.map((p, i) => (
          <linearGradient key={i} id={`${uid}b${i}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={p.color} stopOpacity="1" />
            <stop offset="100%" stopColor={p.color} stopOpacity="0.12" />
          </linearGradient>
        ))}
      </defs>

      {/* HUD gridlines */}
      <g mask={`url(#${uid}gridmask)`}>
        {[0, 0.25, 0.5, 0.75, 1].map((g, idx) => {
          const yPos = padTop + plotH * g;
          return (
            <line
              key={idx}
              x1={padLeft}
              y1={yPos}
              x2={width - padRight}
              y2={yPos}
              stroke={g === 1 ? "rgba(255,255,255,0.28)" : "rgba(255,255,255,0.1)"}
              strokeDasharray={g === 1 ? "none" : "2 5"}
              strokeWidth="1"
            />
          );
        })}
      </g>
      {[0, 0.25, 0.5, 0.75, 1].map((g, idx) => {
        const yPos = padTop + plotH * g;
        return (
          <g key={idx}>
            <line x1={padLeft - 4} y1={yPos} x2={padLeft} y2={yPos} stroke="rgba(255,255,255,0.4)" />
            <text
              x={padLeft - 8}
              y={yPos + 2.5}
              textAnchor="end"
              fill="#5a6b65"
              fontSize="7.5"
              fontFamily="JetBrains Mono, monospace"
            >
              {Math.round((1 - g) * 100)}
            </text>
          </g>
        );
      })}

      {/* hover guide */}
      <AnimatePresence>
        {hover !== null && points[hover] && (
          <motion.line
            key="guide"
            x1={points[hover].x}
            x2={points[hover].x}
            y1={padTop - 6}
            y2={base}
            stroke={points[hover].color}
            strokeWidth="1"
            strokeDasharray="2 3"
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.8 }}
            exit={{ opacity: 0 }}
          />
        )}
      </AnimatePresence>

      <AnimatePresence mode="wait">
        {chartType === "bar" ? (
          <motion.g key="bar" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
            {points.map((p, i) => {
              const barW = Math.min(34, (plotW / data.length) * 0.58);
              const barH = Math.max(4, base - p.y);
              const lit = hover === i;
              return (
                <g key={p.algo}>
                  <rect
                    x={p.x - barW / 2}
                    y={padTop}
                    width={barW}
                    height={plotH}
                    fill="rgba(255,255,255,0.025)"
                    stroke="rgba(255,255,255,0.05)"
                    strokeDasharray="1 3"
                  />
                  <motion.rect
                    initial={{ height: 0, y: base }}
                    animate={{ height: barH, y: p.y }}
                    transition={{ type: "spring", stiffness: 110, damping: 15, delay: i * 0.07 }}
                    x={p.x - barW / 2}
                    width={barW}
                    fill={`url(#${uid}b${i})`}
                    opacity={p.isBest || lit ? 1 : 0.78}
                    filter={p.isBest || lit ? `url(#${uid}glow)` : undefined}
                  />
                  <motion.rect
                    initial={{ height: 0, y: base }}
                    animate={{ height: barH, y: p.y }}
                    transition={{ type: "spring", stiffness: 110, damping: 15, delay: i * 0.07 }}
                    x={p.x - barW / 2}
                    width={barW}
                    fill={`url(#${uid}scan)`}
                  />
                  <motion.rect
                    initial={{ y: base }}
                    animate={{ y: p.y - 1 }}
                    transition={{ type: "spring", stiffness: 110, damping: 15, delay: i * 0.07 }}
                    x={p.x - barW / 2 - 2}
                    width={barW + 4}
                    height="2"
                    fill="#fff"
                    filter={`url(#${uid}glow)`}
                  />
                  <motion.text
                    initial={{ opacity: 0, y: base }}
                    animate={{ opacity: 1, y: p.y - 9 }}
                    transition={{ type: "spring", stiffness: 110, damping: 15, delay: 0.25 + i * 0.07 }}
                    x={p.x}
                    textAnchor="middle"
                    fill={p.isBest || lit ? "#fff" : "#9aaaa3"}
                    fontSize={lit ? 10.5 : 9}
                    fontWeight="700"
                    fontFamily="JetBrains Mono, monospace"
                  >
                    {fmtVal(metric, p.val)}
                  </motion.text>
                  {p.isBest && (
                    <motion.path
                      d={`M${p.x},${base + 24} l3,3 l-3,3 l-3,-3 z`}
                      fill={p.color}
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ delay: 0.9, type: "spring" }}
                      style={{ transformOrigin: `${p.x}px ${base + 27}px` }}
                    />
                  )}
                  <text
                    x={p.x}
                    y={base + 16}
                    textAnchor="middle"
                    fill={lit ? "#fff" : "#9aaaa3"}
                    fontSize="8.5"
                    fontWeight="500"
                    fontFamily="JetBrains Mono, monospace"
                    letterSpacing="0.5"
                  >
                    {p.short}
                  </text>
                </g>
              );
            })}
          </motion.g>
        ) : (
          <motion.g key="line" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
            <motion.path
              d={areaPath}
              fill={`url(#${uid}area)`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 1.1, delay: 0.5 }}
            />
            <motion.path
              d={linePath}
              fill="none"
              stroke={mc}
              strokeWidth="2.5"
              strokeLinecap="round"
              filter={`url(#${uid}glow)`}
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 1.3, ease: [0.2, 0.7, 0.2, 1] }}
            />
            <motion.path
              d={linePath}
              fill="none"
              stroke="#fff"
              strokeWidth="1.1"
              strokeLinecap="round"
              strokeDasharray="2 14"
              animate={{ strokeDashoffset: [0, -32] }}
              transition={{ repeat: Infinity, duration: 1.4, ease: "linear" }}
              opacity="0.85"
            />
            {points.map((p, i) => {
              const lit = hover === i;
              return (
                <g key={p.algo}>
                  {(p.isBest || lit) && (
                    <motion.circle
                      cx={p.x}
                      cy={p.y}
                      r="5"
                      fill="none"
                      stroke={p.color}
                      animate={{ r: [5, 13], opacity: [0.8, 0] }}
                      transition={{ repeat: Infinity, duration: 1.8, ease: "easeOut" }}
                    />
                  )}
                  <motion.circle
                    initial={{ scale: 0, cx: p.x, cy: base }}
                    animate={{ scale: 1, cx: p.x, cy: p.y }}
                    transition={{ type: "spring", stiffness: 120, damping: 14, delay: 0.3 + i * 0.12 }}
                    r={lit ? 6 : 4.5}
                    fill="#050607"
                    stroke={p.color}
                    strokeWidth="2.5"
                    filter={`url(#${uid}glow)`}
                  />
                  <motion.text
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.7 + i * 0.1 }}
                    x={p.x}
                    y={p.y - 11}
                    textAnchor="middle"
                    fill="#fff"
                    fontSize="9"
                    fontWeight="700"
                    fontFamily="JetBrains Mono, monospace"
                  >
                    {p.val > 9999 ? `${(p.val / 1000).toFixed(1)}k` : p.val}
                  </motion.text>
                  <text
                    x={p.x}
                    y={base + 16}
                    textAnchor="middle"
                    fill={lit ? "#fff" : "#9aaaa3"}
                    fontSize="8.5"
                    fontFamily="JetBrains Mono, monospace"
                    letterSpacing="0.5"
                  >
                    {p.short}
                  </text>
                </g>
              );
            })}
          </motion.g>
        )}
      </AnimatePresence>

      {/* hit-slots for hover */}
      {points.map((p, i) => (
        <rect
          key={`hit-${p.algo}`}
          x={chartType === "line" ? p.x - slotW / 2 : p.x - slotW / 2}
          y={padTop - 10}
          width={slotW}
          height={plotH + 50}
          fill="transparent"
          onPointerEnter={() => setHover(i)}
        />
      ))}
    </svg>
  );
}

export function MetricPlotCard({ metric, data, logScale, chartType, onExpand, index = 0, wide = false }) {
  const IconComp = metric.icon;
  const mc = skin(metric.color);
  const vals = data.map((d) => Number(d[metric.key]) || 0);
  const best = vals.length ? Math.min(...vals) : 0;
  const leader = data[vals.indexOf(best)];

  return (
    <motion.div
      layoutId={`plot-${metric.key}`}
      className={`glass z2 plot-card ${wide ? "wide" : ""}`}
      style={{ "--ac": mc }}
      onClick={onExpand}
      initial={{ opacity: 0, y: 40, filter: "blur(10px)" }}
      whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ type: "spring", stiffness: 120, damping: 20, delay: (index % 3) * 0.08 }}
      whileHover={{ y: -8 }}
    >
      <div className="plot-head">
        <div className="plot-title">
          <IconComp size={16} />
          {metric.title}
        </div>
        <span className="plot-hint">
          <Maximize2 size={11} /> Expand
        </span>
      </div>
      <SvgMetricGraph
        data={data}
        metric={metric}
        logScale={logScale}
        chartType={chartType}
        width={wide ? 980 : 340}
        height={wide ? 170 : 175}
      />
      <div className="plot-foot">
        <span>
          FIG.{String(index + 1).padStart(2, "0")} · {metric.unit}
        </span>
        <span>
          Lowest <b>{leader ? getShortAlgoName(leader.algorithm) : "—"}</b>
        </span>
      </div>
    </motion.div>
  );
}

/* 5-Axis Normalized Multi-Algorithm Radar (Spider) Chart */
export function MultiMetricRadarChart({ data }) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const [focus, setFocus] = useState(null);
  const size = 320;
  const center = size / 2;
  const radius = 108;
  const axes = METRIC_CONFIGS;

  const maxPerMetric = {};
  axes.forEach((m) => {
    const vals = data.map((d) => Number(d[m.key]) || 0);
    maxPerMetric[m.key] = Math.max(...vals, 0.001);
  });

  const getCoord = (angleIdx, ratio) => {
    const angle = (Math.PI * 2 * angleIdx) / axes.length - Math.PI / 2;
    return {
      x: center + radius * ratio * Math.cos(angle),
      y: center + radius * ratio * Math.sin(angle),
    };
  };

  const ringPath = (lvl) =>
    axes
      .map((_, idx) => {
        const c = getCoord(idx, lvl);
        return `${idx === 0 ? "M" : "L"}${c.x},${c.y}`;
      })
      .join(" ") + " Z";

  const sweepSlices = Array.from({ length: 14 }, (_, i) => {
    const a0 = (-Math.PI / 2) - (i * 0.05);
    const a1 = (-Math.PI / 2) - ((i + 1) * 0.05);
    const R = radius * 1.05;
    return {
      i,
      d: `M${center},${center} L${center + R * Math.cos(a0)},${center + R * Math.sin(a0)} A${R},${R} 0 0 0 ${
        center + R * Math.cos(a1)
      },${center + R * Math.sin(a1)} Z`,
    };
  });

  return (
    <motion.div
      className="glass z3 radar-card"
      initial={{ opacity: 0, y: 50, filter: "blur(10px)" }}
      whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ type: "spring", stiffness: 110, damping: 20 }}
    >
      <div className="eyebrow" style={{ width: "100%" }}>
        <Radar size={13} color="#3df2ff" />
        <span>
          <b>FIG.00</b> · 5-Axis Footprint
        </span>
      </div>

      <svg viewBox={`0 0 ${size} ${size}`} style={{ width: "100%", maxWidth: "400px", overflow: "visible" }}>
        <defs>
          <clipPath id={`${uid}clip`}>
            <path d={ringPath(1.02)} />
          </clipPath>
          <radialGradient id={`${uid}core`}>
            <stop offset="0%" stopColor="#3df2ff" stopOpacity="0.2" />
            <stop offset="100%" stopColor="#3df2ff" stopOpacity="0" />
          </radialGradient>
          <filter id={`${uid}glow`} x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="3" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <circle cx={center} cy={center} r={radius * 1.1} fill={`url(#${uid}core)`} />

        {/* Concentric Pentagon Webs */}
        {[0.25, 0.5, 0.75, 1].map((lvl, i) => (
          <motion.path
            key={lvl}
            d={ringPath(lvl)}
            fill={lvl === 1 ? "rgba(46,230,166,0.03)" : "none"}
            stroke={lvl === 1 ? "rgba(46,230,166,0.5)" : "rgba(255,255,255,0.1)"}
            strokeWidth="1"
            strokeDasharray={lvl === 1 ? "none" : "2 5"}
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: 1 }}
            transition={{ duration: 1.1, delay: i * 0.12 }}
          />
        ))}

        {/* Radar sweep */}
        <g clipPath={`url(#${uid}clip)`}>
          <g>
            {sweepSlices.map((s) => (
              <path key={s.i} d={s.d} fill="#3df2ff" opacity={0.2 * (1 - s.i / 14)} />
            ))}
            <line
              x1={center}
              y1={center}
              x2={center}
              y2={center - radius * 1.05}
              stroke="#3df2ff"
              strokeWidth="1.2"
              opacity="0.9"
            />
            <animateTransform
              attributeName="transform"
              type="rotate"
              from={`0 ${center} ${center}`}
              to={`360 ${center} ${center}`}
              dur="7s"
              repeatCount="indefinite"
            />
          </g>
        </g>

        {/* Axis Spokes & Labels */}
        {axes.map((m, idx) => {
          const end = getCoord(idx, 1);
          const lbl = getCoord(idx, 1.22);
          const mc = skin(m.color);
          return (
            <g key={m.key}>
              <motion.line
                x1={center}
                y1={center}
                x2={end.x}
                y2={end.y}
                stroke="rgba(255,255,255,0.14)"
                strokeWidth="1"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 0.9, delay: 0.2 + idx * 0.08 }}
              />
              <circle cx={end.x} cy={end.y} r="2.2" fill={mc} />
              <motion.text
                x={lbl.x}
                y={lbl.y}
                textAnchor="middle"
                dominantBaseline="middle"
                fill="#9aaaa3"
                fontSize="8.5"
                fontWeight="500"
                fontFamily="JetBrains Mono, monospace"
                letterSpacing="1"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.8 + idx * 0.08 }}
              >
                {m.title.replace(" (ms)", "").toUpperCase()}
              </motion.text>
            </g>
          );
        })}

        {/* Algorithm Polygons */}
        {data.map((row, ri) => {
          const color = skin(getAlgoColor(row.algorithm));
          const coords = axes.map((m, idx) => {
            const val = Number(row[m.key]) || 0;
            const ratio = normalizeValue(val, maxPerMetric[m.key], true);
            return getCoord(idx, ratio);
          });
          const d = coords.map((c, i) => `${i === 0 ? "M" : "L"}${c.x},${c.y}`).join(" ") + " Z";
          const d0 = coords.map((_, i) => `${i === 0 ? "M" : "L"}${center},${center}`).join(" ") + " Z";
          const dim = focus !== null && focus !== row.algorithm;
          const lit = focus === row.algorithm;
          return (
            <motion.g
              key={row.algorithm}
              animate={{ opacity: dim ? 0.1 : 1 }}
              transition={{ duration: 0.3 }}
            >
              <motion.path
                initial={{ d: d0, fillOpacity: 0, pathLength: 0 }}
                animate={{ d, fillOpacity: lit ? 0.3 : 0.12, pathLength: 1 }}
                transition={{ type: "spring", stiffness: 60, damping: 14, delay: 0.5 + ri * 0.12 }}
                fill={color}
                stroke={color}
                strokeWidth={lit ? 2.8 : 1.8}
                strokeLinejoin="round"
                filter={lit ? `url(#${uid}glow)` : undefined}
              />
              {coords.map((c, i) => (
                <motion.circle
                  key={i}
                  initial={{ cx: center, cy: center, scale: 0 }}
                  animate={{ cx: c.x, cy: c.y, scale: 1 }}
                  transition={{ type: "spring", stiffness: 60, damping: 14, delay: 0.5 + ri * 0.12 }}
                  r="2.6"
                  fill="#050607"
                  stroke={color}
                  strokeWidth="1.6"
                />
              ))}
            </motion.g>
          );
        })}
      </svg>

      <div className="radar-legend">
        {data.map((row) => (
          <motion.span
            key={row.algorithm}
            className="legend-pill"
            style={{ "--c": skin(getAlgoColor(row.algorithm)) }}
            onPointerEnter={() => setFocus(row.algorithm)}
            onPointerLeave={() => setFocus(null)}
            whileHover={{ y: -2 }}
          >
            <i />
            {getShortAlgoName(row.algorithm)}
          </motion.span>
        ))}
      </div>
      <div className="eyebrow" style={{ width: "100%", justifyContent: "center", marginTop: 6 }}>
        Smaller polygon = higher optimality &amp; speed
      </div>
    </motion.div>
  );
}

/* Fullscreen Interactive Plot Modal when any Plot is Clicked */
export function ExpandedPlotModal({ metric, data, logScale, setLogScale, onClose }) {
  const [modalChartType, setModalChartType] = useState("bar");
  const IconComp = metric.icon;
  const mc = skin(metric.color);
  const values = data.map((d) => Number(d[metric.key]) || 0);
  const minVal = Math.min(...values.filter((v) => v > 0), 0.001);

  return (
    <motion.div
      className="modal-backdrop"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        layoutId={`plot-${metric.key}`}
        className="glass z3 modal"
        style={{ "--ac": mc }}
        transition={{ type: "spring", stiffness: 200, damping: 26 }}
        onClick={(e) => e.stopPropagation()}
      >
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16 }}
        >
          <div>
            <div className="eyebrow" style={{ color: mc }}>
              <IconComp size={14} /> <b style={{ color: mc }}>{metric.unit}</b> · Interactive plot
            </div>
            <h2 className="modal-title">
              {metric.title.replace(" (ms)", "")} <em>under the lens</em>
            </h2>
            <p className="modal-desc">{metric.description}</p>
          </div>
          <motion.button
            type="button"
            className="btn btn-ghost btn-icon"
            onClick={onClose}
            whileHover={{ rotate: 90 }}
            whileTap={{ scale: 0.9 }}
            transition={SPRING_SNAP}
            aria-label="Close"
          >
            <X size={18} />
          </motion.button>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.22 }}
          style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10, marginTop: 22 }}
        >
          <Segmented
            layoutKey="modal-type"
            accent={mc}
            value={modalChartType}
            onChange={setModalChartType}
            options={[
              { value: "bar", label: (<><BarChart2 size={13} /> Columns</>) },
              { value: "line", label: (<><TrendingUp size={13} /> Curve</>) },
            ]}
          />
          <Segmented
            layoutKey="modal-scale"
            accent="#2ee6a6"
            value={logScale}
            onChange={setLogScale}
            options={[
              { value: true, label: "Log₁₀" },
              { value: false, label: "Linear 1:1" },
            ]}
          />
        </motion.div>

        <motion.div
          className="hud-frame"
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.28 }}
        >
          <SvgMetricGraph data={data} metric={metric} logScale={logScale} chartType={modalChartType} height={210} />
        </motion.div>

        <motion.div
          className="stat-row"
          initial="hidden"
          animate="show"
          variants={{ hidden: {}, show: { transition: { staggerChildren: 0.07, delayChildren: 0.35 } } }}
        >
          {data.map((row) => {
            const val = Number(row[metric.key]) || 0;
            const ratio = minVal > 0 ? (val / minVal).toFixed(1) : "1.0";
            const color = skin(getAlgoColor(row.algorithm));
            return (
              <motion.div
                key={row.algorithm}
                className="stat"
                style={{ "--c": color }}
                variants={{
                  hidden: { opacity: 0, y: 18 },
                  show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 160, damping: 16 } },
                }}
                whileHover={{ y: -4 }}
              >
                <div className="stat-name">{row.algorithm}</div>
                <div className="stat-val">
                  {metric.key === "running_time_ms" ? val : val.toLocaleString()}
                  {metric.key === "running_time_ms" && <small>ms</small>}
                </div>
                <div className="stat-x">{ratio}× vs best</div>
              </motion.div>
            );
          })}
        </motion.div>

        <motion.div
          className="takeaway"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.6 }}
        >
          <b>Lab Report Takeaway</b>
          {metric.insight}
        </motion.div>
      </motion.div>
    </motion.div>
  );
}