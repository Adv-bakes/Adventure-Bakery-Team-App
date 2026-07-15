import { AlertTriangle, MapPin } from "lucide-react";
import { docNumberIssue, stageForSopNumber } from "@/lib/docNumber";

/**
 * Advisory helper shown under a `sop_number` input. Renders the derived process stage
 * (so admins see where a number lands) and a non-blocking warning when the value strays
 * from the TYPE-NNN convention (legacy `-N` revision suffix, bad padding, etc.).
 * Purely informational — never disables saving.
 */
export function DocNumberHint({ value }: { value: string | null | undefined }) {
  const issue = docNumberIssue(value);
  const stage = stageForSopNumber(value);
  if (!issue && !stage) return null;
  return (
    <div className="mt-1 space-y-1 text-xs">
      {stage && (
        <p className="flex items-center gap-1 text-muted-foreground">
          <MapPin className="w-3 h-3" />
          {stage.label}
        </p>
      )}
      {issue && (
        <p className="flex items-start gap-1 text-amber-700">
          <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" />
          <span>{issue}</span>
        </p>
      )}
    </div>
  );
}
