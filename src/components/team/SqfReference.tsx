import { Fragment } from "react";
import { ExternalLink } from "lucide-react";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import type { SqfClause } from "@/lib/sqfClauses";
import { SQF_CLAUSES, lookupSqfClause, sqfPdfHref } from "@/lib/sqfClauses";
import { SQF_FOOD_CLAUSES, lookupSqfFoodClause, sqfFoodPdfHref } from "@/lib/sqfFoodClauses";
import { cn } from "@/lib/utils";

interface SqfReferenceProps {
  /** Comma-delimited SQF clause numbers, e.g. "2.3.1.1, 2.3.2.5". */
  value: string | null | undefined;
  className?: string;
}

interface Resolved {
  clause: SqfClause;
  href: string;
  codeLabel: string;
  /** The clause id actually matched — differs from the token on a section/parent fallback. */
  matchedId: string;
  exact: boolean;
}

/** Numeric (segment-wise) comparison of clause ids, e.g. "11.3.1.1" < "11.3.10". */
function compareIds(a: string, b: string): number {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d) return d;
  }
  return 0;
}

/** Lowest-numbered mapped clause that sits under `token` (its first sub-clause). */
function firstDescendant(token: string, map: Record<string, SqfClause>): string | undefined {
  const prefix = token + ".";
  let best: string | undefined;
  for (const key of Object.keys(map)) {
    if (key.startsWith(prefix) && (best === undefined || compareIds(key, best) < 0)) best = key;
  }
  return best;
}

const QUALITY = { map: SQF_CLAUSES, lookup: lookupSqfClause, href: sqfPdfHref, label: "SQF Code" };
const FOOD = { map: SQF_FOOD_CLAUSES, lookup: lookupSqfFoodClause, href: sqfFoodPdfHref, label: "Food Mfg Code" };
// Quality first, then Food Manufacturing: 11.x lives only in Food; 2.x present in both prefers Quality.
const CODES = [QUALITY, FOOD];

/**
 * Resolve a reference token to a linkable clause:
 *  1. exact match;
 *  2. else the nearest mapped descendant (a section number → its first sub-clause / start page);
 *  3. else the nearest mapped ancestor (an over-specific number → its parent clause).
 */
function resolveToken(token: string): Resolved | null {
  for (const code of CODES) {
    const c = code.lookup(token);
    if (c) return { clause: c, href: code.href(c.page), codeLabel: code.label, matchedId: token, exact: true };
  }
  for (const code of CODES) {
    const id = firstDescendant(token, code.map);
    if (id) {
      const c = code.map[id];
      return { clause: c, href: code.href(c.page), codeLabel: code.label, matchedId: id, exact: false };
    }
  }
  const segs = token.split(".");
  for (let n = segs.length - 1; n >= 3; n--) {
    const anc = segs.slice(0, n).join(".");
    for (const code of CODES) {
      const c = code.lookup(anc);
      if (c) return { clause: c, href: code.href(c.page), codeLabel: code.label, matchedId: anc, exact: false };
    }
  }
  return null;
}

/**
 * Renders a comma-delimited SQF clause reference string. Each resolvable clause becomes a
 * hover target showing the referenced clause text plus a link that opens the matching SQF
 * code PDF at the right page. Section-level numbers (e.g. "11.3") that aren't mapped directly
 * fall back to their nearest sub-clause so the link still opens the right part of the document.
 * Tokens that resolve to nothing render as plain text.
 */
export function SqfReference({ value, className }: SqfReferenceProps) {
  const tokens = (value ?? "")
    .split(",")
    .map(t => t.trim())
    .filter(Boolean);

  if (tokens.length === 0) return <span className={className}>—</span>;

  return (
    <span className={className}>
      {tokens.map((token, i) => {
        const resolved = resolveToken(token);
        const sep = i > 0 ? ", " : "";

        if (!resolved) {
          return <Fragment key={`${token}-${i}`}>{sep}{token}</Fragment>;
        }

        const { clause, href, codeLabel, matchedId, exact } = resolved;

        return (
          <Fragment key={`${token}-${i}`}>
            {sep}
            <HoverCard openDelay={120} closeDelay={120}>
              <HoverCardTrigger asChild>
                <span
                  className="cursor-help font-medium text-[#C89B3C] underline decoration-dotted underline-offset-2 hover:text-[#B8892C]"
                  onClick={e => e.stopPropagation()}
                >
                  {token}
                </span>
              </HoverCardTrigger>
              <HoverCardContent
                align="start"
                className="w-96"
                onClick={e => e.stopPropagation()}
              >
                <div className="space-y-2">
                  <p className="text-sm font-semibold text-[#2A1F0E]">SQF {token}</p>
                  {!exact && (
                    <p className="text-[11px] italic text-[#2A1F0E]/55">
                      Section reference — opening at nearest clause {matchedId}
                    </p>
                  )}
                  <p className="max-h-56 overflow-y-auto whitespace-pre-line text-xs leading-relaxed text-[#2A1F0E]/80">
                    {clause.text}
                  </p>
                  <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={e => e.stopPropagation()}
                    className="inline-flex items-center gap-1 text-xs font-medium text-[#C89B3C] hover:text-[#B8892C]"
                  >
                    View in {codeLabel} (p.{clause.page})
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              </HoverCardContent>
            </HoverCard>
          </Fragment>
        );
      })}
    </span>
  );
}
