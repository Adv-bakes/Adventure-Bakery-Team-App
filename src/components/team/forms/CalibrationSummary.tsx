import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { fetchCalibrationEntries } from "@/lib/formResponses";
import { SENSOR_UNITS, lastSensorChecks, type SensorCheck } from "@/lib/calibrationSummary";

const day = (iso: string) => {
  const d = new Date(`${iso}T00:00:00`);
  return Number.isNaN(d.getTime()) ? iso : format(d, "MMM d, yyyy");
};

/**
 * One line per cold-storage unit: when its sensor was last checked on FRM-705 and what was read.
 * Shown inside FRM-401's "Device accuracy" section while the review is being filled in, so the
 * reviewer sees the figures they are confirming without opening the other form. It is a reading of
 * the records, never an answer: the confirmation above it stays the reviewer's.
 *
 * Renders nothing if the records cannot be read - the form works without it.
 */
export function CalibrationSummary() {
  const [state, setState] = useState<{ docId: string; checks: SensorCheck[] } | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchCalibrationEntries()
      .then(r => { if (!cancelled && r) setState({ docId: r.docId, checks: lastSensorChecks(r.entries) }); })
      .catch(() => { /* a summary only: say nothing rather than put an error on the form */ });
    return () => { cancelled = true; };
  }, []);

  if (!state) return null;

  return (
    <div className="rounded-md px-3 py-2.5 space-y-1 bg-[#C89B3C]/5">
      <p className="text-xs font-semibold text-[#2A1F0E]">Last calibration check on FRM-705</p>
      {SENSOR_UNITS.map(({ unit }) => {
        const c = state.checks.find(x => x.unit === unit);
        if (!c) {
          return (
            <p key={unit} className="flex items-start gap-1.5 text-xs text-amber-800">
              <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
              <span><strong>{unit}:</strong> no check recorded on FRM-705 yet.</span>
            </p>
          );
        }
        const Icon = c.passed ? CheckCircle2 : AlertTriangle;
        return (
          <p key={unit} className={`flex items-start gap-1.5 text-xs ${c.passed ? "text-[#2A1F0E]" : "text-red-700"}`}>
            <Icon className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${c.passed ? "text-green-700" : ""}`} />
            <span>
              <strong>{unit}:</strong> {c.outcome} on {day(c.date)}
              {(c.probe || c.sensor) && <> — probe {c.probe || "not recorded"}, sensor {c.sensor || "not recorded"}</>}
              {" "}(
              <Link
                to={`/team/compliance/forms/${state.docId}/entries/${c.responseId}`}
                target="_blank"
                rel="noreferrer"
                className="underline underline-offset-2"
              >
                FRM-705{c.month ? ` ${c.month}` : ""}
              </Link>
              {c.draft ? ", still a draft" : ""})
            </span>
          </p>
        );
      })}
    </div>
  );
}
