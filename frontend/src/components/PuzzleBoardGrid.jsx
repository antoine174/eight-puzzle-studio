import React from "react";
import {
  motion,
  useMotionValue,
  useSpring,
  useTransform,
  useMotionTemplate,
} from "framer-motion";
import { getTileDistance } from "../utils/puzzleHelpers";

const LAYOUT_SPRING = { type: "spring", stiffness: 350, damping: 28 };

/**
 * A single physical slab. Pointer position drives a spring-damped 3D tilt and
 * a specular glare; dragging stretches the tile elastically and it snaps home.
 */
function Tile({ tile, idx, dist, compact, animateLayout }) {
  const px = useMotionValue(0.5);
  const py = useMotionValue(0.5);

  const rotY = useSpring(useTransform(px, [0, 1], [-18, 18]), { stiffness: 260, damping: 16, mass: 0.6 });
  const rotX = useSpring(useTransform(py, [0, 1], [18, -18]), { stiffness: 260, damping: 16, mass: 0.6 });
  const gx = useTransform(px, (v) => v * 100);
  const gy = useTransform(py, (v) => v * 100);
  const glare = useMotionTemplate`radial-gradient(circle at ${gx}% ${gy}%, rgba(255,255,255,0.34), rgba(255,255,255,0) 58%)`;

  const handleMove = (e) => {
    if (compact) return;
    const r = e.currentTarget.getBoundingClientRect();
    px.set((e.clientX - r.left) / r.width);
    py.set((e.clientY - r.top) / r.height);
  };
  const handleLeave = () => {
    px.set(0.5);
    py.set(0.5);
  };

  return (
    <motion.div
      className="slot"
      layout={animateLayout}
      transition={LAYOUT_SPRING}
      initial={{ opacity: 0, scale: 0.55, y: 24 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      onPointerMove={handleMove}
      onPointerLeave={handleLeave}
      style={{ perspective: 760 }}
    >
      <motion.div
        className={`tile d${Math.min(dist, 2)}`}
        style={{ rotateX: compact ? 0 : rotX, rotateY: compact ? 0 : rotY }}
        whileHover={compact ? undefined : { scale: 1.07, y: -7 }}
        whileTap={compact ? undefined : { scale: 0.94 }}
        drag={!compact}
        dragSnapToOrigin
        dragElastic={0.32}
        dragMomentum={false}
        transition={{ type: "spring", stiffness: 320, damping: 20 }}
      >
        <motion.span className="tile-glare" style={{ backgroundImage: glare }} />
        {!compact && <span className="tile-idx">{String(idx).padStart(2, "0")}</span>}
        <span className="tile-num">{tile}</span>
        <span className="tile-delta">{compact ? dist : `Δ${dist}`}</span>
      </motion.div>
    </motion.div>
  );
}

export default function PuzzleBoardGrid({
  board,
  size = 310,
  compact = false,
  animateLayout = true,
}) {
  const solved = board.every((v, i) => v === i);

  // whole-tray parallax so the board feels like a held object
  const tx = useMotionValue(0.5);
  const ty = useMotionValue(0.5);
  const trayRY = useSpring(useTransform(tx, [0, 1], [-5, 5]), { stiffness: 90, damping: 18 });
  const trayRX = useSpring(useTransform(ty, [0, 1], [5, -5]), { stiffness: 90, damping: 18 });

  const onTrayMove = (e) => {
    if (compact) return;
    const r = e.currentTarget.getBoundingClientRect();
    tx.set((e.clientX - r.left) / r.width);
    ty.set((e.clientY - r.top) / r.height);
  };
  const onTrayLeave = () => {
    tx.set(0.5);
    ty.set(0.5);
  };

  return (
    <div
      className="tray-stage"
      style={{ margin: compact ? "4px auto" : "12px auto", width: size + (compact ? 0 : 60), padding: compact ? 0 : "20px 30px" }}
      onPointerMove={onTrayMove}
      onPointerLeave={onTrayLeave}
    >
      <motion.div
        className={`tray ${compact ? "compact" : ""} ${solved ? "solved" : ""}`}
        style={{
          "--s": `${size}px`,
          width: `${size}px`,
          height: `${size}px`,
          rotateX: compact ? 0 : trayRX,
          rotateY: compact ? 0 : trayRY,
        }}
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 90, damping: 16 }}
      >
        {board.map((tile, idx) => {
          if (tile === 0) {
            return (
              <motion.div
                key="blank-tile"
                className="socket"
                layout={animateLayout}
                transition={LAYOUT_SPRING}
              >
                <i />
                <i />
                <i />
                <span>{compact ? "0" : "BLANK·0"}</span>
              </motion.div>
            );
          }
          const dist = getTileDistance(tile, idx);
          return (
            <Tile
              key={tile}
              tile={tile}
              idx={idx}
              dist={dist}
              compact={compact}
              animateLayout={animateLayout}
            />
          );
        })}
      </motion.div>
    </div>
  );
}