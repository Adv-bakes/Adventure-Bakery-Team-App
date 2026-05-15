import { ReactNode, useState } from "react";

interface Props {
  title: string;
  count: number;
  onDrop: (id: string) => void;
  children: ReactNode;
}

export const PipelineColumn = ({ title, count, onDrop, children }: Props) => {
  const [over, setOver] = useState(false);
  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        if (!over) setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        const id = e.dataTransfer.getData("text/plain");
        if (id) onDrop(id);
      }}
      className={`tp-surface flex flex-col min-h-[460px] p-3 transition-all ${over ? "tp-dropzone-active" : ""}`}
    >
      <div className="flex items-center justify-between px-1.5 pb-3 mb-3 border-b border-[hsl(var(--tp-hairline))]">
        <h3 className="font-display text-[13px] font-semibold uppercase tracking-[0.1em] text-[hsl(var(--tp-text))]">
          {title}
        </h3>
        <span className="tp-chip-muted tp-chip">{count}</span>
      </div>
      <div className="space-y-2 flex-1">
        {count === 0 ? (
          <div className="h-full min-h-[120px] flex items-center justify-center text-center">
            <p className="text-[11px] italic text-[hsl(var(--tp-text-dim))]">
              Drag a client here
            </p>
          </div>
        ) : (
          children
        )}
      </div>
    </div>
  );
};
