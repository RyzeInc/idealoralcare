"use client";

import styles from "./subtleFlowBackground.module.css";

type Props = {
  /** Set to false for pages that need a perfectly flat background */
  enabled?: boolean;
};

export default function SubtleFlowBackground({ enabled = true }: Props) {
  if (!enabled) return null;

  return (
    <div aria-hidden="true" className={styles.wrap}>
      {/* Base + fog */}
      <div className={styles.base} />
      <div className={styles.fog} />

      {/* Flow lines using Iris → Orchid → Ember */}
      <svg
        className={styles.flow}
        viewBox="0 0 1000 1800"
        preserveAspectRatio="none"
      >
        <defs>
          {/* Iris → Orchid gradient */}
          <linearGradient id="strokeA" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="rgba(79,108,255,0.0)" />
            <stop offset="30%" stopColor="rgba(79,108,255,0.35)" />
            <stop offset="60%" stopColor="rgba(155,63,224,0.30)" />
            <stop offset="100%" stopColor="rgba(155,63,224,0.0)" />
          </linearGradient>

          {/* Orchid → Ember gradient */}
          <linearGradient id="strokeB" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="rgba(155,63,224,0.0)" />
            <stop offset="35%" stopColor="rgba(155,63,224,0.28)" />
            <stop offset="65%" stopColor="rgba(255,138,42,0.25)" />
            <stop offset="100%" stopColor="rgba(255,138,42,0.0)" />
          </linearGradient>

          {/* Soft white highlight */}
          <linearGradient id="strokeC" x1="0.5" y1="0" x2="0.5" y2="1">
            <stop offset="0%" stopColor="rgba(255,255,255,0.0)" />
            <stop offset="40%" stopColor="rgba(255,255,255,0.25)" />
            <stop offset="60%" stopColor="rgba(255,255,255,0.30)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0.0)" />
          </linearGradient>

          <filter id="softGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="12" result="b" />
            <feColorMatrix
              in="b"
              type="matrix"
              values="
                1 0 0 0 0
                0 1 0 0 0
                0 0 1 0 0
                0 0 0 1 0"
            />
          </filter>
        </defs>

        {/* Main sweeping curve - like in the reference */}
        <path
          d="M -100 300 
             C 150 200, 350 350, 500 280
             C 650 210, 750 400, 600 550
             C 450 700, 350 600, 400 750
             C 450 900, 600 850, 550 1000
             C 500 1150, 300 1100, 350 1300
             C 400 1500, 600 1450, 500 1800"
          fill="none"
          stroke="url(#strokeA)"
          strokeWidth="8"
          opacity="0.6"
          filter="url(#softGlow)"
        />

        {/* Secondary curve flowing alongside */}
        <path
          d="M 50 400 
             C 200 320, 400 420, 520 380
             C 640 340, 700 480, 580 620
             C 460 760, 380 680, 420 820
             C 460 960, 580 920, 540 1060
             C 500 1200, 340 1160, 380 1360
             C 420 1560, 560 1520, 480 1800"
          fill="none"
          stroke="url(#strokeB)"
          strokeWidth="5"
          opacity="0.45"
          filter="url(#softGlow)"
        />

        {/* Thin accent curve */}
        <path
          d="M -50 500 
             C 180 380, 380 500, 480 440
             C 580 380, 680 520, 560 680
             C 440 840, 360 740, 400 900
             C 440 1060, 560 1000, 520 1160
             C 480 1320, 320 1280, 360 1480
             C 400 1680, 540 1640, 460 1800"
          fill="none"
          stroke="url(#strokeC)"
          strokeWidth="3"
          opacity="0.35"
          filter="url(#softGlow)"
        />
      </svg>

      {/* Grain/noise (premium "print texture" feel) */}
      <div className={styles.noise} />
    </div>
  );
}
