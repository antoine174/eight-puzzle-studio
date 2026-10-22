import React, { useEffect, useRef, useState } from "react";
import {
  motion,
  animate,
  useMotionValue,
  useSpring,
  useMotionTemplate,
} from "framer-motion";

/* ---------- motion vocabulary ---------- */
export const stagger = (s = 0.07, d = 0) => ({
  hidden: {},
  show: { transition: { staggerChildren: s, delayChildren: d } },
  exit: { transition: { staggerChildren: 0.03, staggerDirection: -1 } },
});

export const rise = {
  hidden: { opacity: 0, y: 30, filter: "blur(10px)" },
  show: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { type: "spring", stiffness: 130, damping: 20 },
  },
  exit: { opacity: 0, y: -18, filter: "blur(8px)", transition: { duration: 0.25 } },
};

export const slideIn = (x = -40) => ({
  hidden: { opacity: 0, x, filter: "blur(10px)" },
  show: {
    opacity: 1,
    x: 0,
    filter: "blur(0px)",
    transition: { type: "spring", stiffness: 110, damping: 20 },
  },
  exit: { opacity: 0, x: x / 2, filter: "blur(8px)", transition: { duration: 0.22 } },
});

export const SPRING_SNAP = { type: "spring", stiffness: 420, damping: 34 };

/* ---------- volumetric environment ---------- */
export function Stage() {
  const mx = useMotionValue(-600);
  const my = useMotionValue(-600);
  const sx = useSpring(mx, { stiffness: 55, damping: 20, mass: 1.2 });
  const sy = useSpring(my, { stiffness: 55, damping: 20, mass: 1.2 });

  useEffect(() => {
    const onMove = (e) => {
      mx.set(e.clientX);
      my.set(e.clientY);
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => window.removeEventListener("pointermove", onMove);
  }, [mx, my]);

  const spot = useMotionTemplate`radial-gradient(560px circle at ${sx}px ${sy}px, rgba(61,242,255,0.085), rgba(46,230,166,0.04) 38%, transparent 70%)`;

  return (
    <div className="stage" aria-hidden="true">
      <div className="stage-base" />
      <div className="blob b1" />
      <div className="blob b2" />
      <div className="blob b3" />
      <div className="beam be1" />
      <div className="beam be2" />
      <div className="beam be3" />
      <div className="floor" />
      <motion.div className="spot" style={{ background: spot }} />
      <div className="grain" />
      <div className="vignette" />
    </div>
  );
}

/* ---------- typography motion ---------- */
export function Digits({ value, className = "" }) {
  const s = String(value);
  return (
    <span className={`digits ${className}`}>
      {[...s].map((ch, i) => (
        <motion.span
          key={`${s.length - i}-${ch}`}
          className="digit"
          initial={{ y: "-42%", opacity: 0, filter: "blur(6px)" }}
          animate={{ y: 0, opacity: 1, filter: "blur(0px)" }}
          transition={{ type: "spring", stiffness: 440, damping: 30 }}
        >
          {ch}
        </motion.span>
      ))}
    </span>
  );
}

export function AnimatedNumber({ value, duration = 0.95, className = "" }) {
  const n = Number(value);
  const numeric = value !== null && value !== undefined && value !== "" && Number.isFinite(n);
  const dec = numeric && !Number.isInteger(n) ? Math.min(3, (String(n).split(".")[1] || "").length) : 0;
  const [shown, setShown] = useState(numeric ? 0 : value);
  const last = useRef(0);

  useEffect(() => {
    if (!numeric) {
      setShown(value);
      return undefined;
    }
    const ctrl = animate(last.current, n, {
      duration,
      ease: [0.16, 0.8, 0.2, 1],
      onUpdate: (v) => {
        last.current = v;
        setShown(v);
      },
    });
    return () => ctrl.stop();
  }, [value, numeric, n, duration]);

  if (!numeric) {
    return (
      <motion.span
        key={String(value)}
        className={className}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      >
        {String(shown)}
      </motion.span>
    );
  }
  return (
    <span className={className}>
      {Number(shown).toLocaleString(undefined, {
        minimumFractionDigits: dec,
        maximumFractionDigits: dec,
      })}
    </span>
  );
}

/* ---------- liquid segmented control ---------- */
export function Segmented({ options, value, onChange, layoutKey, accent = "var(--emerald)", small = false }) {
  return (
    <div className={`seg ${small ? "seg-sm" : ""}`} role="tablist" style={{ "--seg": accent }}>
      {options.map((o) => {
        const on = value === o.value;
        return (
          <button
            key={String(o.value)}
            type="button"
            role="tab"
            aria-selected={on}
            className={on ? "on" : ""}
            title={o.title}
            onClick={() => onChange(o.value)}
          >
            {on && <motion.span layoutId={`seg-${layoutKey}`} className="seg-pill" transition={SPRING_SNAP} />}
            <span className="seg-label">{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}
