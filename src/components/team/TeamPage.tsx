import { ReactNode } from "react";

interface TeamPageProps {
  title: string;
  eyebrow?: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
}

export const TeamPage = ({ title, eyebrow, description, actions, children }: TeamPageProps) => (
  <div className="tp-fade-up">
    <header className="flex items-end justify-between mb-8 gap-6 flex-wrap">
      <div>
        {eyebrow && (
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[hsl(var(--tp-text-dim))] mb-2">
            {eyebrow}
          </p>
        )}
        <h1 className="font-display text-3xl md:text-4xl tp-h1-underline text-[hsl(var(--tp-text))]">
          {title}
        </h1>
        {description && (
          <p className="text-sm mt-3 max-w-xl text-[hsl(var(--tp-text-muted))]">
            {description}
          </p>
        )}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </header>
    {children}
  </div>
);

interface KpiTileProps {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  emphasis?: boolean;
  className?: string;
}

export const KpiTile = ({ label, value, hint, emphasis, className = "" }: KpiTileProps) => (
  <div className={`tp-kpi ${className}`}>
    <p className="text-[11px] uppercase tracking-[0.14em] text-[hsl(var(--tp-text-dim))] mb-2">
      {label}
    </p>
    <p
      className={`font-display ${emphasis ? "text-4xl text-[hsl(var(--tp-gold-soft))]" : "text-3xl text-[hsl(var(--tp-text))]"}`}
    >
      {value}
    </p>
    {hint && <p className="text-xs mt-2 text-[hsl(var(--tp-text-muted))]">{hint}</p>}
  </div>
);
