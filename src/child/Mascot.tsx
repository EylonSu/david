export type MascotState = 'idle' | 'listening' | 'cheer';

/** Cute bear cub with idle / listening / cheer animations (CSS in child.css). */
export function Mascot({ state, size = 160 }: { state: MascotState; size?: number }) {
  return (
    <svg
      className={`mascot mascot--${state}`}
      width={size}
      height={size}
      viewBox="0 0 200 200"
      aria-hidden
    >
      <g className="mascot-all">
        <ellipse className="mascot-shadow" cx="100" cy="193" rx="50" ry="6" fill="rgba(61,58,75,0.12)" />
        <g className="mascot-body">
          <ellipse cx="100" cy="152" rx="54" ry="40" fill="#e3a06a" />
          <ellipse cx="100" cy="160" rx="32" ry="25" fill="#fbe3c4" />
          <ellipse cx="74" cy="188" rx="17" ry="9" fill="#d18e58" />
          <ellipse cx="126" cy="188" rx="17" ry="9" fill="#d18e58" />
        </g>
        <g className="mascot-arm mascot-arm--l">
          <ellipse cx="52" cy="146" rx="14" ry="23" fill="#d18e58" />
        </g>
        <g className="mascot-arm mascot-arm--r">
          <ellipse cx="148" cy="146" rx="14" ry="23" fill="#d18e58" />
        </g>
        <g className="mascot-head">
          <circle cx="54" cy="44" r="22" fill="#e3a06a" />
          <circle cx="54" cy="44" r="12" fill="#f7c9a0" />
          <g className="mascot-ear--r">
            <circle cx="146" cy="44" r="22" fill="#e3a06a" />
            <circle cx="146" cy="44" r="12" fill="#f7c9a0" />
          </g>
          <circle cx="100" cy="84" r="58" fill="#e9ab74" />
          <g className="mascot-eyes">
            <circle cx="78" cy="78" r="8" fill="#3d3a4b" />
            <circle cx="122" cy="78" r="8" fill="#3d3a4b" />
            <circle cx="81" cy="75" r="2.6" fill="#fff" />
            <circle cx="125" cy="75" r="2.6" fill="#fff" />
          </g>
          <path className="mascot-happy-eyes" d="M69 80 q9 -11 18 0 M113 80 q9 -11 18 0" stroke="#3d3a4b" strokeWidth="5" strokeLinecap="round" fill="none" />
          <ellipse cx="66" cy="100" rx="10" ry="6" fill="#e76f51" opacity="0.35" />
          <ellipse cx="134" cy="100" rx="10" ry="6" fill="#e76f51" opacity="0.35" />
          <ellipse cx="100" cy="104" rx="21" ry="16" fill="#fbe3c4" />
          <ellipse cx="100" cy="97" rx="7.5" ry="5.5" fill="#3d3a4b" />
          <path className="mascot-smile" d="M90 107 q10 9 20 0" stroke="#3d3a4b" strokeWidth="3.5" strokeLinecap="round" fill="none" />
          <path className="mascot-open" d="M88 106 q12 18 24 0 Z" fill="#c4505a" stroke="#3d3a4b" strokeWidth="3" strokeLinejoin="round" />
        </g>
        <g className="mascot-waves" stroke="var(--color-accent)" strokeWidth="5" strokeLinecap="round" fill="none">
          <path d="M176 30 q8 14 0 28" />
          <path d="M188 22 q13 22 0 44" />
        </g>
        <g className="mascot-sparkles" fill="var(--color-star)">
          <path d="M28 20 l4 9 9 4 -9 4 -4 9 -4 -9 -9 -4 9 -4 z" />
          <path d="M174 96 l3 7 7 3 -7 3 -3 7 -3 -7 -7 -3 7 -3 z" />
          <path d="M18 112 l3 6 6 3 -6 3 -3 6 -3 -6 -6 -3 6 -3 z" />
        </g>
      </g>
    </svg>
  );
}
