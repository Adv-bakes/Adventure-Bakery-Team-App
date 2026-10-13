// The rum cake that waves a visitor goodbye on the entrance tablet (owner's request, 2026-10-13).
//
// Drawn here as SVG and moved with CSS, so there is no image or animation file to load and it is
// sharp at any size. It is decoration only: the words beside it carry the message, and somebody who
// has asked their device for less motion gets the same cake standing still.

const CSS = `
.rcw-bob  { animation: rcw-bob 1.8s ease-in-out infinite; transform-origin: 120px 200px; }
.rcw-arm  { animation: rcw-wave 0.7s ease-in-out infinite alternate; transform-origin: 176px 138px; }
.rcw-blink{ animation: rcw-blink 3.6s infinite; transform-origin: 120px 132px; }
.rcw-pop  { animation: rcw-pop 0.5s cubic-bezier(.2,1.4,.4,1) both; transform-origin: 120px 200px; }
.rcw-spark{ animation: rcw-spark 1.4s ease-in-out infinite; }
.rcw-spark.b { animation-delay: .5s; }
.rcw-spark.c { animation-delay: .9s; }
@keyframes rcw-bob   { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-5px) } }
@keyframes rcw-wave  { from { transform: rotate(-12deg) } to { transform: rotate(26deg) } }
@keyframes rcw-blink { 0%,92%,100% { transform: scaleY(1) } 96% { transform: scaleY(.1) } }
@keyframes rcw-pop   { from { transform: scale(.4); opacity: 0 } to { transform: scale(1); opacity: 1 } }
@keyframes rcw-spark { 0%,100% { opacity: .15; transform: scale(.7) } 50% { opacity: 1; transform: scale(1) } }
@media (prefers-reduced-motion: reduce) {
  .rcw-bob, .rcw-arm, .rcw-blink, .rcw-pop, .rcw-spark { animation: none; }
}
`;

const CAKE = "#C98B3B";
const CAKE_DARK = "#A66E28";
const GLAZE = "#FBF1DC";
const INK = "#2A1F0E";

function Spark({ x, y, className }: { x: number; y: number; className: string }) {
  return (
    <path
      className={className}
      style={{ transformOrigin: `${x}px ${y}px` }}
      d={`M${x} ${y - 9} L${x + 2.5} ${y - 2.5} L${x + 9} ${y} L${x + 2.5} ${y + 2.5} L${x} ${y + 9} L${x - 2.5} ${y + 2.5} L${x - 9} ${y} L${x - 2.5} ${y - 2.5} Z`}
      fill="#E8B84B"
    />
  );
}

export function RumCakeWave({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 240 240" className={className} role="img" aria-label="A smiling rum cake waving goodbye">
      <style>{CSS}</style>
      <g className="rcw-pop">
        {/* plate */}
        <ellipse cx="120" cy="206" rx="92" ry="13" fill="#2A1F0E" opacity=".12" />
        <ellipse cx="120" cy="200" rx="86" ry="11" fill="#FFFFFF" stroke="#D9CDB4" strokeWidth="2" />

        <g className="rcw-bob">
          {/* the arm that stays down, behind the cake */}
          <path d="M62 150 Q40 160 44 180" fill="none" stroke={CAKE_DARK} strokeWidth="9" strokeLinecap="round" />
          <circle cx="44" cy="182" r="8" fill={CAKE} stroke={CAKE_DARK} strokeWidth="2" />

          {/* the waving arm */}
          <g className="rcw-arm">
            <path d="M176 138 Q200 120 204 92" fill="none" stroke={CAKE_DARK} strokeWidth="9" strokeLinecap="round" />
            <circle cx="205" cy="86" r="10" fill={CAKE} stroke={CAKE_DARK} strokeWidth="2" />
          </g>

          {/* the cake: a fluted ring */}
          <path
            d="M48 196 C40 150 52 96 120 92 C188 96 200 150 192 196 Z"
            fill={CAKE} stroke={CAKE_DARK} strokeWidth="3" strokeLinejoin="round"
          />
          {[72, 96, 144, 168].map(x => (
            <path
              key={x}
              d={`M${x} 196 Q${x < 120 ? x - 6 : x + 6} 150 ${x < 120 ? x + 8 : x - 8} 108`}
              fill="none" stroke={CAKE_DARK} strokeWidth="2.5" strokeLinecap="round" opacity=".55"
            />
          ))}

          {/* glaze running down from the top */}
          <path
            d="M70 112 C84 86 156 86 170 112 C172 124 164 130 160 120 C156 112 150 128 146 140
               C142 150 134 148 134 136 C134 124 126 122 122 132 C118 146 108 146 106 134
               C104 122 96 118 92 130 C88 142 78 138 78 126 C78 118 70 122 70 112 Z"
            fill={GLAZE} stroke="#E6D5B0" strokeWidth="2" strokeLinejoin="round"
          />
          <ellipse cx="120" cy="100" rx="20" ry="6" fill={CAKE_DARK} opacity=".7" />
          {/* a pecan on top */}
          <ellipse cx="146" cy="98" rx="8" ry="5" fill="#8A5524" transform="rotate(-18 146 98)" />
          <path d="M139 99 L153 96" stroke="#5E3814" strokeWidth="1.5" transform="rotate(-18 146 98)" />

          {/* face */}
          <g className="rcw-blink">
            <circle cx="100" cy="160" r="6" fill={INK} />
            <circle cx="140" cy="160" r="6" fill={INK} />
            <circle cx="102" cy="158" r="2" fill="#FFFFFF" />
            <circle cx="142" cy="158" r="2" fill="#FFFFFF" />
          </g>
          <ellipse cx="86" cy="172" rx="8" ry="5" fill="#E9967A" opacity=".55" />
          <ellipse cx="154" cy="172" rx="8" ry="5" fill="#E9967A" opacity=".55" />
          <path d="M106 172 Q120 188 134 172" fill="#7A2E1E" stroke={INK} strokeWidth="2.5" strokeLinejoin="round" />
        </g>

        <Spark x={38} y={96} className="rcw-spark" />
        <Spark x={214} y={150} className="rcw-spark b" />
        <Spark x={62} y={58} className="rcw-spark c" />
      </g>
    </svg>
  );
}
