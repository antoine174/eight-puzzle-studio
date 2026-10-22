import React, { useState } from "react";
import { motion } from "framer-motion";
import { Maximize2, X, BarChart2, TrendingUp, Radar } from "lucide-react";
import { getAlgoColor, getShortAlgoName, METRIC_CONFIGS } from "../utils/puzzleHelpers";

function normalizeValue(val, maxVal, logScale) {
  if (maxVal <= 0) return 0.05;
  if (!logScale) return Math.max(0.04, val / maxVal);
  const sVal = Math.log10(val * 100 + 1);
  const sMax = Math.log10(maxVal * 100 + 1);
  return Math.max(0.04, sVal / Math.max(sMax, 0.0001));
}

export function SvgMetricGraph({ data, metric, logScale, chartType = "bar", height = 175 }) {
  const width = 340;
  const padTop = 24;
  const padBottom = 34;
  const padLeft = 36;
  const padRight = 16;
  const plotW = width - padLeft - padRight;
  const plotH = height - padTop - padBottom;

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
      color: getAlgoColor(d.algorithm),
      isBest: val === minVal,
    };
  });

  const polylineStr = points.map((p) => `${p.x},${p.y}`).join(" ");
  const areaStr =
    points.length > 0
      ? `${points[0].x},${padTop + plotH} ${polylineStr} ${points[points.length - 1].x},${padTop + plotH}`
      : "";

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      style={{ width: "100%", height: "auto", overflow: "visible" }}
    >
      <defs>
        <linearGradient id={`grad-${metric.key}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={metric.color} stopOpacity="0.45" />
          <stop offset="100%" stopColor={metric.color} stopOpacity="0.02" />
        </linearGradient>
      </defs>

      {/* Horizontal Y-Axis Gridlines */}
      {[0, 0.25, 0.5, 0.75, 1].map((g, idx) => {
        const yPos = padTop + plotH * g;
        const pctLabel = `${Math.round((1 - g) * 100)}%`;
        return (
          <g key={idx}>
            <line
              x1={padLeft}
              y1={yPos}
              x2={width - padRight}
              y2={yPos}
              stroke="#1e293b"
              strokeDasharray={g === 1 ? "none" : "3 3"}
              strokeWidth="1"
            />
            <text
              x={padLeft - 6}
              y={yPos + 3}
              textAnchor="end"
              fill="#475569"
              fontSize="8"
              fontFamily="monospace"
            >
              {pctLabel}
            </text>
          </g>
        );
      })}

      {/* BAR CHART MODE */}
      {chartType === "bar" &&
        points.map((p) => {
          const barW = Math.min(34, (plotW / data.length) * 0.58);
          const barH = Math.max(4, padTop + plotH - p.y);
          return (
            <g key={p.algo}>
              <motion.rect
                initial={{ height: 0, y: padTop + plotH }}
                animate={{ height: barH, y: p.y }}
                transition={{ duration: 0.45, ease: "easeOut" }}
                x={p.x - barW / 2}
                width={barW}
                rx="5"
                fill={p.color}
                opacity={p.isBest ? 1 : 0.82}
              />
              {/* Value label above bar */}
              <text
                x={p.x}
                y={p.y - 6}
                textAnchor="middle"
                fill={p.isBest ? "#f8fafc" : "#94a3b8"}
                fontSize="9"
                fontWeight="700"
                fontFamily="monospace"
              >
                {metric.key === "running_time_ms"
                  ? `${p.val}`
                  : p.val > 9999
                  ? `${(p.val / 1000).toFixed(1)}k`
                  : p.val}
              </text>
              {/* X-axis algorithm label */}
              <text
                x={p.x}
                y={padTop + plotH + 16}
                textAnchor="middle"
                fill="#cbd5e1"
                fontSize="9"
                fontWeight="600"
                fontFamily="monospace"
              >
                {p.short}
              </text>
            </g>
          );
        })}

      {/* LINE / AREA TREND PLOT MODE */}
      {chartType === "line" && (
        <g>
          <polygon points={areaStr} fill={`url(#grad-${metric.key})`} />
          <polyline
            fill="none"
            stroke={metric.color}
            strokeWidth="2.5"
            points={polylineStr}
          />
          {points.map((p) => (
            <g key={p.algo}>
              <circle
                cx={p.x}
                cy={p.y}
                r="4.5"
                fill="#090d16"
                stroke={p.color}
                strokeWidth="2.5"
              />
              <text
                x={p.x}
                y={p.y - 8}
                textAnchor="middle"
                fill="#f8fafc"
                fontSize="9"
                fontWeight="700"
                fontFamily="monospace"
              >
                {p.val > 9999 ? `${(p.val / 1000).toFixed(1)}k` : p.val}
              </text>
              <text
                x={p.x}
                y={padTop + plotH + 16}
                textAnchor="middle"
                fill="#cbd5e1"
                fontSize="9"
                fontWeight="600"
                fontFamily="monospace"
              >
                {p.short}
              </text>
            </g>
          ))}
        </g>
      )}
    </svg>
  );
}

export function MetricPlotCard({ metric, data, logScale, chartType, onExpand }) {
  const IconComp = metric.icon;

  return (
    <motion.div
      whileHover={{ y: -4, borderColor: metric.color }}
      onClick={onExpand}
      style={{
        backgroundColor: "#0f1523",
        border: "1px solid #1e293b",
        borderRadius: "14px",
        padding: "16px",
        cursor: "pointer",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        gap: "8px",
        boxShadow: "0 4px 20px rgba(0,0,0,0.25)",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <IconComp size={16} color={metric.color} />
          <span style={{ fontWeight: 800, fontSize: "13px", color: "#f8fafc" }}>
            {metric.title}
          </span>
        </div>
        <span
          style={{
            display: "flex",
            alignItems: "center",
            gap: "4px",
            fontSize: "10px",
            color: "#64748b",
            fontFamily: "monospace",
            backgroundColor: "#141c2e",
            padding: "3px 7px",
            borderRadius: "6px",
          }}
        >
          <Maximize2 size={11} /> Click to Expand
        </span>
      </div>

      <SvgMetricGraph
        data={data}
        metric={metric}
        logScale={logScale}
        chartType={chartType}
      />
    </motion.div>
  );
}

/* 5-Axis Normalized Multi-Algorithm Radar (Spider) Chart */
export function MultiMetricRadarChart({ data }) {
  const size = 300;
  const center = size / 2;
  const radius = 102;
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

  return (
    <div
      style={{
        backgroundColor: "#0f1523",
        border: "1px solid #1e293b",
        borderRadius: "14px",
        padding: "16px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "space-between",
      }}
    >
      <div
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          gap: "8px",
          marginBottom: "4px",
        }}
      >
        <Radar size={16} color="#38bdf8" />
        <span style={{ fontWeight: 800, fontSize: "13px" }}>
          5-Dimension Telemetry Radar Footprint
        </span>
      </div>

      <svg viewBox={`0 0 ${size} ${size}`} style={{ width: "100%", maxWidth: "260px" }}>
        {/* Concentric Pentagon Webs */}
        {[0.25, 0.5, 0.75, 1].map((lvl) => {
          const pts = axes
            .map((_, idx) => {
              const c = getCoord(idx, lvl);
              return `${c.x},${c.y}`;
            })
            .join(" ");
          return (
            <polygon
              key={lvl}
              points={pts}
              fill="none"
              stroke="#1e293b"
              strokeWidth="1"
            />
          );
        })}

        {/* Axis Spokes & Labels */}
        {axes.map((m, idx) => {
          const end = getCoord(idx, 1);
          const lbl = getCoord(idx, 1.24);
          return (
            <g key={m.key}>
              <line
                x1={center}
                y1={center}
                x2={end.x}
                y2={end.y}
                stroke="#26324d"
                strokeWidth="1"
              />
              <text
                x={lbl.x}
                y={lbl.y}
                textAnchor="middle"
                dominantBaseline="middle"
                fill="#94a3b8"
                fontSize="8.5"
                fontWeight="700"
                fontFamily="monospace"
              >
                {m.title.replace(" (ms)", "")}
              </text>
            </g>
          );
        })}

        {/* Algorithm Polygons */}
        {data.map((row) => {
          const color = getAlgoColor(row.algorithm);
          const pts = axes
            .map((m, idx) => {
              const val = Number(row[m.key]) || 0;
              const ratio = normalizeValue(val, maxPerMetric[m.key], true);
              const c = getCoord(idx, ratio);
              return `${c.x},${c.y}`;
            })
            .join(" ");
          return (
            <polygon
              key={row.algorithm}
              points={pts}
              fill={color}
              fillOpacity="0.14"
              stroke={color}
              strokeWidth="2"
            />
          );
        })}
      </svg>

      <div style={{ fontSize: "10px", color: "#64748b", textAlign: "center", fontFamily: "monospace" }}>
        Smaller polygon = Higher overall optimality &amp; speed
      </div>
    </div>
  );
}

/* Fullscreen Interactive Plot Modal when any Plot is Clicked */
export function ExpandedPlotModal({ metric, data, logScale, setLogScale, onClose }) {
  const [modalChartType, setModalChartType] = useState("bar");
  const IconComp = metric.icon;
  const values = data.map((d) => Number(d[metric.key]) || 0);
  const minVal = Math.min(...values.filter((v) => v > 0), 0.001);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(5, 8, 17, 0.86)",
        backdropFilter: "blur(8px)",
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
      }}
    >
      <motion.div
        initial={{ scale: 0.92, y: 16 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.92, y: 16 }}
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: "880px",
          backgroundColor: "#0f1523",
          border: `1.5px solid ${metric.color}`,
          borderRadius: "18px",
          padding: "26px",
          boxShadow: "0 24px 60px rgba(0,0,0,0.8)",
        }}
      >
        {/* Modal Header */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            marginBottom: "16px",
          }}
        >
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <IconComp size={22} color={metric.color} />
              <h2 style={{ margin: 0, fontSize: "20px", fontWeight: 800 }}>
                {metric.title} — Interactive Graphical Plot
              </h2>
            </div>
            <p style={{ margin: "6px 0 0 0", fontSize: "13px", color: "#94a3b8" }}>
              {metric.description}
            </p>
          </div>

          <button
            onClick={onClose}
            style={{
              background: "#161f33",
              border: "1px solid #334155",
              color: "#cbd5e1",
              borderRadius: "8px",
              padding: "6px",
              cursor: "pointer",
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Plot Toolbar: Chart Type + Scale Mode */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "16px",
            flexWrap: "wrap",
            gap: "10px",
          }}
        >
          <div style={{ display: "flex", gap: "8px" }}>
            <button
              onClick={() => setModalChartType("bar")}
              style={{
                padding: "6px 12px",
                borderRadius: "8px",
                border: "1px solid #26324d",
                cursor: "pointer",
                fontSize: "12px",
                fontWeight: 700,
                display: "flex",
                alignItems: "center",
                gap: "6px",
                backgroundColor: modalChartType === "bar" ? metric.color : "#141c2e",
                color: modalChartType === "bar" ? "#052e16" : "#94a3b8",
              }}
            >
              <BarChart2 size={14} /> Vertical Column Plot
            </button>
            <button
              onClick={() => setModalChartType("line")}
              style={{
                padding: "6px 12px",
                borderRadius: "8px",
                border: "1px solid #26324d",
                cursor: "pointer",
                fontSize: "12px",
                fontWeight: 700,
                display: "flex",
                alignItems: "center",
                gap: "6px",
                backgroundColor: modalChartType === "line" ? metric.color : "#141c2e",
                color: modalChartType === "line" ? "#052e16" : "#94a3b8",
              }}
            >
              <TrendingUp size={14} /> Area / Curve Plot
            </button>
          </div>

          <div style={{ display: "flex", gap: "8px" }}>
            <button
              onClick={() => setLogScale(true)}
              style={{
                padding: "6px 12px",
                borderRadius: "8px",
                border: "1px solid #26324d",
                cursor: "pointer",
                fontSize: "12px",
                fontWeight: 700,
                backgroundColor: logScale ? "#10b981" : "#141c2e",
                color: logScale ? "#052e16" : "#94a3b8",
              }}
            >
              Log₁₀ Scale
            </button>
            <button
              onClick={() => setLogScale(false)}
              style={{
                padding: "6px 12px",
                borderRadius: "8px",
                border: "1px solid #26324d",
                cursor: "pointer",
                fontSize: "12px",
                fontWeight: 700,
                backgroundColor: !logScale ? "#10b981" : "#141c2e",
                color: !logScale ? "#052e16" : "#94a3b8",
              }}
            >
              Linear (1:1)
            </button>
          </div>
        </div>

        {/* Large Interactive SVG Canvas */}
        <div
          style={{
            backgroundColor: "#090d16",
            border: "1px solid #1e293b",
            borderRadius: "14px",
            padding: "20px 28px",
            marginBottom: "16px",
          }}
        >
          <SvgMetricGraph
            data={data}
            metric={metric}
            logScale={logScale}
            chartType={modalChartType}
            height={210}
          />
        </div>

        {/* Exact Numerical Breakdown Badges */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(5, 1fr)",
            gap: "10px",
            marginBottom: "16px",
          }}
        >
          {data.map((row) => {
            const val = Number(row[metric.key]) || 0;
            const ratio = minVal > 0 ? (val / minVal).toFixed(1) : "1.0";
            const color = getAlgoColor(row.algorithm);
            return (
              <div
                key={row.algorithm}
                style={{
                  backgroundColor: "#090d16",
                  border: `1px solid ${color}55`,
                  borderRadius: "10px",
                  padding: "10px",
                  textAlign: "center",
                  fontFamily: "monospace",
                }}
              >
                <div style={{ fontSize: "11px", color: "#94a3b8", marginBottom: "4px" }}>
                  {row.algorithm}
                </div>
                <div style={{ fontSize: "15px", fontWeight: 800, color }}>
                  {metric.key === "running_time_ms"
                    ? `${val} ms`
                    : val.toLocaleString()}
                </div>
                <div style={{ fontSize: "10px", color: "#64748b", marginTop: "3px" }}>
                  {ratio}x vs best
                </div>
              </div>
            );
          })}
        </div>

        <div
          style={{
            padding: "12px 16px",
            borderRadius: "10px",
            backgroundColor: "rgba(16, 185, 129, 0.08)",
            border: "1px solid rgba(16, 185, 129, 0.3)",
            fontSize: "13px",
            color: "#d1fae5",
          }}
        >
          <strong style={{ color: "#34d399" }}>Lab Report Takeaway: </strong>
          {metric.insight}
        </div>
      </motion.div>
    </motion.div>
  );
}