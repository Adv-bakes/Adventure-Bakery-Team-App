import { ReactNode } from "react";

interface Props {
  title: string;
  subtitle?: string;
  stages?: string[];
  children?: ReactNode;
}

const SectionPlaceholder = ({ title, subtitle, stages, children }: Props) => (
  <div className="max-w-5xl">
    <h1 className="text-3xl font-semibold mb-2" style={{ color: "#F5F1E6" }}>
      {title}
    </h1>
    {subtitle && (
      <p className="text-sm mb-8" style={{ color: "rgba(245,241,230,0.6)" }}>
        {subtitle}
      </p>
    )}

    {stages && (
      <div className="mb-8">
        <p
          className="text-[10px] font-bold uppercase tracking-wider mb-3"
          style={{ color: "rgba(245,241,230,0.4)" }}
        >
          Pipeline stages
        </p>
        <div className="flex flex-wrap gap-2">
          {stages.map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              <span
                className="px-3 py-1.5 rounded-md text-sm border"
                style={{
                  background: "rgba(200,155,60,0.08)",
                  borderColor: "rgba(200,155,60,0.25)",
                  color: "#F5F1E6",
                }}
              >
                {s}
              </span>
              {i < stages.length - 1 && (
                <span style={{ color: "rgba(200,155,60,0.4)" }}>→</span>
              )}
            </div>
          ))}
        </div>
      </div>
    )}

    <div
      className="rounded-lg border p-6"
      style={{
        background: "rgba(200,155,60,0.04)",
        borderColor: "rgba(200,155,60,0.15)",
        color: "rgba(245,241,230,0.7)",
      }}
    >
      {children ?? (
        <p className="text-sm">
          This section is scaffolded. Content will be wired up in the next
          implementation phase per the approved plan.
        </p>
      )}
    </div>
  </div>
);

export default SectionPlaceholder;
