import { useEffect, useRef, useState } from "react";
import { Eraser } from "lucide-react";
import { Button } from "@/components/ui/button";

// The bitmap is fixed so every signature is the same small size wherever it was drawn; CSS scales
// it to the width available. 500x160 of thin strokes is a few kB as PNG.
const WIDTH = 500;
const HEIGHT = 160;
const INK = "#2A1F0E";

interface SignaturePadProps {
  /** The current drawing as a PNG data URL, if any (restored when the pad mounts). */
  value?: string;
  /** Called with the PNG when a stroke ends, or with undefined when the pad is cleared. */
  onChange: (image: string | undefined) => void;
  disabled?: boolean;
}

/**
 * A box to sign in with a finger, stylus or mouse. Pointer events cover all three, so there is
 * no tablet detection: the same pad works at a desk.
 */
export function SignaturePad({ value, onChange, disabled }: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const last = useRef<{ x: number; y: number } | null>(null);
  const [hasInk, setHasInk] = useState(!!value);

  // Restore a drawing made earlier (the pad unmounts between wizard steps). Only on mount — the
  // canvas is the source of truth while somebody is drawing on it.
  useEffect(() => {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx || !value) return;
    const img = new Image();
    img.onload = () => ctx.drawImage(img, 0, 0, WIDTH, HEIGHT);
    img.src = value;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const point = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * WIDTH,
      y: ((e.clientY - rect.top) / rect.height) * HEIGHT,
    };
  };

  const start = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (disabled) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    drawing.current = true;
    last.current = point(e);
    // A tap leaves a dot, so a short initial still registers.
    const ctx = e.currentTarget.getContext("2d");
    if (ctx) {
      ctx.fillStyle = INK;
      ctx.beginPath();
      ctx.arc(last.current.x, last.current.y, 1.2, 0, Math.PI * 2);
      ctx.fill();
    }
  };

  const move = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current || !last.current) return;
    const ctx = e.currentTarget.getContext("2d");
    if (!ctx) return;
    const p = point(e);
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2.4;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(last.current.x, last.current.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    last.current = p;
  };

  const end = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    drawing.current = false;
    last.current = null;
    setHasInk(true);
    onChange(e.currentTarget.toDataURL("image/png"));
  };

  const clear = () => {
    const canvas = canvasRef.current;
    canvas?.getContext("2d")?.clearRect(0, 0, WIDTH, HEIGHT);
    setHasInk(false);
    onChange(undefined);
  };

  return (
    <div className="space-y-1">
      <div className="relative">
        <canvas
          ref={canvasRef}
          width={WIDTH}
          height={HEIGHT}
          aria-label="Signature"
          className={`block w-full rounded-md border bg-white touch-none ${disabled ? "opacity-60" : "cursor-crosshair"}`}
          style={{ aspectRatio: `${WIDTH} / ${HEIGHT}`, borderColor: "rgba(42,31,14,0.3)" }}
          onPointerDown={start}
          onPointerMove={move}
          onPointerUp={end}
          onPointerCancel={end}
        />
        {!hasInk && (
          <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-[#2A1F0E]/40">
            Sign here with your finger
          </span>
        )}
      </div>
      {!disabled && (
        <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={clear} disabled={!hasInk}>
          <Eraser className="w-3.5 h-3.5 mr-1" /> Clear
        </Button>
      )}
    </div>
  );
}
