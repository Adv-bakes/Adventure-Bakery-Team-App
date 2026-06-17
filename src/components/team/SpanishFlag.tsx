// A tiny SVG Spanish flag (red-yellow-red). Drawn as SVG rather than the 🇪🇸
// emoji because Windows' emoji font has no flag glyphs and renders it as "ES".
export function SpanishFlag({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 22 15"
      width="22"
      height="15"
      role="img"
      aria-label="Español"
      className={className}
      style={{ borderRadius: 2, border: "0.5px solid rgba(0,0,0,0.15)", display: "inline-block" }}
    >
      <rect width="22" height="15" fill="#C60B1E" />
      <rect y="3.75" width="22" height="7.5" fill="#FFC400" />
    </svg>
  );
}
