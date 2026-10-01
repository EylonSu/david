/** Simple rounded icons for the child screens (no text). */
type P = { size?: number };

export const GridIcon = ({ size = 56 }: P) => (
  <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden>
    {[6, 27].flatMap((x) =>
      [6, 27].map((y) => <rect key={`${x}-${y}`} x={x} y={y} width="15" height="15" rx="4" fill="currentColor" />),
    )}
  </svg>
);

export const OneIcon = ({ size = 56 }: P) => (
  <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden>
    <rect x="9" y="7" width="30" height="34" rx="6" fill="currentColor" opacity="0.35" />
    <path d="M19 16 L32 24 L19 32 Z" fill="currentColor" strokeLinejoin="round" stroke="currentColor" strokeWidth="3" />
  </svg>
);

export const HomeIcon = ({ size = 56 }: P) => (
  <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden>
    <path
      d="M8 23 L24 9 L40 23 V39 a3 3 0 0 1 -3 3 H29 V30 H19 V42 H11 a3 3 0 0 1 -3 -3 Z"
      fill="currentColor"
      strokeLinejoin="round"
      stroke="currentColor"
      strokeWidth="2"
    />
  </svg>
);

export const AgainIcon = ({ size = 56 }: P) => (
  <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden>
    <path d="M38 24 a14 14 0 1 1 -5 -10.7" fill="none" stroke="currentColor" strokeWidth="6" strokeLinecap="round" />
    <path d="M35 5 L36 16 L25 16 Z" fill="currentColor" stroke="currentColor" strokeWidth="3" strokeLinejoin="round" />
  </svg>
);

export const StarIcon = ({ size = 40 }: P) => (
  <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden>
    <path
      d="M24 4 L29.6 16.6 L43 18 L33 27.2 L35.8 40.6 L24 33.8 L12.2 40.6 L15 27.2 L5 18 L18.4 16.6 Z"
      fill="var(--color-star)"
      stroke="#e0a93a"
      strokeWidth="2.5"
      strokeLinejoin="round"
    />
  </svg>
);

export const GearIcon = ({ size = 28 }: P) => (
  <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden>
    <g fill="currentColor">
      {Array.from({ length: 8 }, (_, i) => (
        <rect key={i} x="20" y="3" width="8" height="10" rx="2" transform={`rotate(${i * 45} 24 24)`} />
      ))}
      <circle cx="24" cy="24" r="14" />
    </g>
    <circle cx="24" cy="24" r="6" fill="var(--color-bg)" />
  </svg>
);
