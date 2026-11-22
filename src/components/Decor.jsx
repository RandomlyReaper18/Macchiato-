export function Bean({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <ellipse cx="12" cy="12" rx="7" ry="10" transform="rotate(35 12 12)" fill="#B77A3F" stroke="#2D1B12" strokeWidth="1.5" />
      <path d="M7 6c4 3 6 9 10 12" stroke="#2D1B12" strokeWidth="1.5" fill="none" strokeLinecap="round" />
    </svg>
  );
}

export function Cup({ color = "#B77A3F" }) {
  return (
    <svg viewBox="0 0 40 52" width="70%" aria-hidden="true" focusable="false">
      <rect x="6" y="3" width="28" height="7" rx="3" fill="#F4E8CD" stroke="#2D1B12" strokeWidth="2" />
      <path d="M8 10h24l-3 38a3 3 0 0 1-3 2H14a3 3 0 0 1-3-2z" fill={color} stroke="#2D1B12" strokeWidth="2" />
      <path d="M10 24h20" stroke="#F4E8CD" strokeWidth="2" strokeDasharray="3 3" />
    </svg>
  );
}

export function Cat() {
  return (
    <svg viewBox="0 0 220 230" role="img" aria-label="A cat waving a paw" className="cat">
      <path d="M150 200c42 0 48-52 18-66" fill="none" stroke="#B77A3F" strokeWidth="14" strokeLinecap="round" />
      <ellipse cx="100" cy="178" rx="54" ry="44" fill="#E0BE8E" stroke="#2D1B12" strokeWidth="3" />
      <ellipse cx="156" cy="128" rx="13" ry="24" transform="rotate(-18 156 128)" fill="#E0BE8E" stroke="#2D1B12" strokeWidth="3" />
      <path d="M58 76 52 26l40 28zM142 76l6-50-40 28z" fill="#E0BE8E" stroke="#2D1B12" strokeWidth="3" strokeLinejoin="round" />
      <path d="M62 62 59 40l17 12zM138 62l3-22-17 12z" fill="#A34732" />
      <circle cx="100" cy="102" r="50" fill="#E0BE8E" stroke="#2D1B12" strokeWidth="3" />
      <path d="M72 100q9-10 18 0M110 100q9-10 18 0" fill="none" stroke="#2D1B12" strokeWidth="4" strokeLinecap="round" />
      <path d="M95 114h10l-5 6z" fill="#A34732" />
      <path d="M100 120q-6 9-14 4M100 120q6 9 14 4" fill="none" stroke="#2D1B12" strokeWidth="3" strokeLinecap="round" />
      <path d="M62 114l-22-4M62 122l-22 6M138 114l22-4M138 122l22 6" stroke="#2D1B12" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function DemoTag() {
  return <span className="demo-tag">Demo data</span>;
}
