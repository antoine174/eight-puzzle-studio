import React from "react";
import { motion } from "framer-motion";
import { getTileDistance } from "../utils/puzzleHelpers";

export default function PuzzleBoardGrid({
  board,
  size = 310,
  compact = false,
  animateLayout = true,
}) {
  return (
    <div
      style={{
        width: `${size}px`,
        height: `${size}px`,
        margin: compact ? "4px auto" : "12px auto",
        padding: compact ? "10px" : "16px",
        backgroundColor: "#090d16",
        borderRadius: compact ? "14px" : "20px",
        border: "1px solid #1e293b",
        display: "grid",
        gridTemplateColumns: "repeat(3, 1fr)",
        gridTemplateRows: "repeat(3, 1fr)",
        gap: compact ? "7px" : "12px",
        boxShadow: "inset 0 2px 12px rgba(0,0,0,0.6)",
        boxSizing: "border-box",
      }}
    >
      {board.map((tile, idx) => {
        if (tile === 0) {
          return (
            <div
              key="blank-tile"
              style={{
                borderRadius: compact ? "9px" : "14px",
                border: "1px dashed #26324d",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#475569",
                fontFamily: "monospace",
                fontSize: compact ? "9px" : "11px",
              }}
            >
              {compact ? "0" : "BLANK (0)"}
            </div>
          );
        }

        const dist = getTileDistance(tile, idx);
        const borderColor =
          dist === 0 ? "#10b981" : dist === 1 ? "#f59e0b" : "#f43f5e";
        const bgColor =
          dist === 0
            ? "rgba(16, 185, 129, 0.12)"
            : dist === 1
            ? "rgba(245, 158, 11, 0.12)"
            : "rgba(244, 63, 94, 0.12)";

        return (
          <motion.div
            key={tile}
            layout={animateLayout}
            transition={{ type: "spring", stiffness: 350, damping: 28 }}
            style={{
              borderRadius: compact ? "9px" : "14px",
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
                fontSize: compact ? "16px" : "26px",
                fontWeight: 800,
                color: "#f8fafc",
                lineHeight: 1.05,
              }}
            >
              {tile}
            </span>
            <span
              style={{
                fontSize: compact ? "8px" : "10px",
                fontFamily: "monospace",
                color: "#94a3b8",
                marginTop: compact ? "2px" : "4px",
              }}
            >
              Δ={dist}
            </span>
          </motion.div>
        );
      })}
    </div>
  );
}