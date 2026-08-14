import { Component, type ErrorInfo, type ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { AlertTriangle, RotateCw } from "lucide-react";

interface Props {
  children: ReactNode;
  /** Optional eyebrow label, e.g. "Sales · PRF Review". */
  label?: string;
}

interface State {
  error: Error | null;
}

/**
 * Catches render/lifecycle errors so one bad component shows a card instead of
 * blanking the whole app. Without this, React 18 unmounts the entire root on an
 * uncaught render throw and all that's left is the body::before background image.
 *
 * Note: only catches errors thrown during render/lifecycle — not rejected
 * promises inside the async useEffect IIFEs used throughout this codebase.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // React only logs the component stack in dev; keep it in prod too.
    console.error("[ErrorBoundary]", error, info.componentStack);
  }

  private reset = () => this.setState({ error: null });

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div
        // `team-portal` supplies the --tp-* custom properties (they're scoped to
        // that class, not :root). The inline background overrides the near-black
        // --tp-bg the same class sets, so this reads correctly in both portals
        // and when it fires outside a layout entirely.
        className="team-portal flex min-h-[50vh] w-full items-center justify-center p-6"
        style={{ background: "transparent" }}
        role="alert"
      >
        <div className="tp-surface w-full max-w-lg space-y-4 rounded-xl p-6">
          <div className="flex items-start gap-3">
            <span
              className="mt-0.5 shrink-0 rounded-full p-2"
              style={{ background: "hsl(var(--tp-gold) / 0.12)" }}
            >
              <AlertTriangle className="h-4 w-4" style={{ color: "hsl(var(--tp-gold-soft))" }} />
            </span>
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-[0.18em] text-[hsl(var(--tp-text-dim))]">
                {this.props.label ?? "Unexpected error"}
              </p>
              <h2 className="font-display text-lg text-[hsl(var(--tp-text))]">
                This section failed to load
              </h2>
            </div>
          </div>

          <pre className="max-h-48 overflow-auto whitespace-pre-wrap break-words rounded-lg border border-[hsl(var(--tp-hairline))] bg-[hsl(var(--tp-surface-2))] p-3 text-xs leading-relaxed text-[hsl(var(--tp-text-muted))]">
            {error.message || String(error)}
          </pre>

          <div className="flex items-center gap-2">
            <button onClick={this.reset} className="tp-btn">
              Try again
            </button>
            <button onClick={() => window.location.reload()} className="tp-btn tp-btn-primary">
              <RotateCw className="h-3.5 w-3.5" />
              Reload
            </button>
          </div>
        </div>
      </div>
    );
  }
}

/**
 * Error boundaries never reset themselves. Without a changing `key`, one crash
 * wedges the subtree until a full reload — even if the user navigates away.
 * Keying on pathname makes navigation a recovery path.
 */
export const RouteErrorBoundary = ({ children, label }: Props) => {
  const { pathname } = useLocation();
  return (
    <ErrorBoundary key={pathname} label={label}>
      {children}
    </ErrorBoundary>
  );
};
