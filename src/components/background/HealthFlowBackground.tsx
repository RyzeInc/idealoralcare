import styles from "./healthFlowBackground.module.css";

type Props = {
  /** Set to false for pages that need a perfectly flat background */
  enabled?: boolean;
};

export default function HealthFlowBackground({ enabled = true }: Props) {
  if (!enabled) return null;

  return (
    <div aria-hidden="true" className={styles.wrap}>
      {/* Base + fog */}
      <div className={styles.base} />
      <div className={styles.fog} />

      {/* Flow lines (SVG with blue-green gradient) */}
      <svg
        className={styles.flow}
        viewBox="0 0 1000 1800"
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id="healthStrokeA" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="rgba(59,130,246,0.0)" />
            <stop offset="40%" stopColor="rgba(14,165,233,0.20)" />
            <stop offset="70%" stopColor="rgba(20,184,166,0.18)" />
            <stop offset="100%" stopColor="rgba(16,185,129,0.12)" />
          </linearGradient>

          <linearGradient id="healthStrokeB" x1="1" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgba(20,184,166,0.0)" />
            <stop offset="45%" stopColor="rgba(14,165,233,0.18)" />
            <stop offset="75%" stopColor="rgba(59,130,246,0.14)" />
            <stop offset="100%" stopColor="rgba(16,185,129,0.10)" />
          </linearGradient>

          <filter id="healthBlurGlow" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="10" result="b" />
            <feColorMatrix
              in="b"
              type="matrix"
              values="
                1 0 0 0 0
                0 1 0 0 0
                0 0 1 0 0
                0 0 0 0.9 0"
            />
          </filter>
        </defs>

        {/* Big gentle arc */}
        <path
          d="M -50 420 C 320 260, 620 340, 1080 140
             C 760 620, 520 820, 1030 1040
             C 680 1200, 360 1320, -40 1760"
          fill="none"
          stroke="url(#healthStrokeA)"
          strokeWidth="6"
          opacity="0.35"
          filter="url(#healthBlurGlow)"
        />

        {/* Secondary thinner arc */}
        <path
          d="M 30 560 C 300 420, 560 460, 980 300
             C 760 760, 520 980, 980 1220
             C 700 1420, 420 1540, 120 1800"
          fill="none"
          stroke="url(#healthStrokeB)"
          strokeWidth="4"
          opacity="0.28"
          filter="url(#healthBlurGlow)"
        />

        {/* Very faint third line for depth */}
        <path
          d="M 0 820 C 260 720, 520 740, 980 620
             C 780 980, 560 1180, 900 1460
             C 640 1620, 360 1700, 220 1800"
          fill="none"
          stroke="rgba(255,255,255,0.10)"
          strokeWidth="2"
          opacity="0.18"
          filter="url(#healthBlurGlow)"
        />
      </svg>

      {/* Grain/noise (premium "print texture" feel) */}
      <div className={styles.noise} />
    </div>
  );
}
