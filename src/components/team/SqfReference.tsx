import { Fragment } from "react";
import { ExternalLink } from "lucide-react";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { lookupSqfClause, sqfPdfHref } from "@/lib/sqfClauses";
import { cn } from "@/lib/utils";

interface SqfReferenceProps {
  /** Comma-delimited SQF clause numbers, e.g. "2.3.1.1, 2.3.2.5". */
  value: string | null | undefined;
  className?: string;
}

/**
 * Renders a comma-delimited SQF clause reference string. Each known clause becomes a
 * hover target showing the referenced clause text plus a link that opens the SQF Quality
 * Code PDF at the matching page. Unknown tokens render as plain text.
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
        const clause = lookupSqfClause(token);
        const sep = i > 0 ? ", " : "";

        if (!clause) {
          return <Fragment key={`${token}-${i}`}>{sep}{token}</Fragment>;
        }

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
                  <p className="max-h-56 overflow-y-auto whitespace-pre-line text-xs leading-relaxed text-[#2A1F0E]/80">
                    {clause.text}
                  </p>
                  <a
                    href={sqfPdfHref(clause.page)}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={e => e.stopPropagation()}
                    className="inline-flex items-center gap-1 text-xs font-medium text-[#C89B3C] hover:text-[#B8892C]"
                  >
                    View in SQF Code (p.{clause.page})
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
