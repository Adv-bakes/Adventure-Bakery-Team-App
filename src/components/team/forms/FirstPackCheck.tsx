import { useEffect, useRef, useState } from "react";
import { useWatch, type UseFormReturn } from "react-hook-form";
import { AlertTriangle, Camera, CheckCircle2, Eye, Loader2, MinusCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FIRST_PACK, isPackNote, noteHasMismatch, packVerdict, type PackLine, type PackState } from "@/lib/firstPackCheck";

const ICON: Record<PackState, typeof CheckCircle2> = {
  match: CheckCircle2, mismatch: AlertTriangle, check: Eye, unread: Eye, skipped: MinusCircle,
};
const TONE: Record<PackState, string> = {
  match: "text-[#2A1F0E]", mismatch: "text-red-700 font-medium", check: "text-amber-800", unread: "text-amber-800", skipped: "text-[#2A1F0E]/70",
};
const ICON_TONE: Record<PackState, string> = {
  match: "text-green-700", mismatch: "", check: "", unread: "", skipped: "",
};

interface FirstPackCheckProps {
  form: UseFormReturn<any>;
  /** The signed-in person's name, written to "First pack checked by" when the answer is given. */
  signerName?: string;
  /** The notes of the photos already on the record (their results), oldest first. */
  notes: string[];
  /** Keeps the photo on the record, reads it and compares. Null when it could not be read at all. */
  onPhoto: (file: File) => Promise<PackLine[] | null>;
}

/**
 * FRM-520, under "Code on the pack": photograph the first pack and see, point by point, whether
 * it agrees with the record - the flavor, the lot code, the best-by month and the bar code.
 *
 * It shows evidence; the answer stays the person's (FSQM-021 has a trained person approve the
 * first pack). When every point agrees it offers the answer as one tap; it never gives it.
 */
export function FirstPackCheck({ form, signerName, notes, onPhoto }: FirstPackCheckProps) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [lines, setLines] = useState<PackLine[] | null>(null);
  const answer = String(useWatch({ control: form.control, name: FIRST_PACK.answer }) ?? "");

  // Whoever answers the check is the person who checked: their name goes in when the answer is
  // given, never when the record is merely opened, and never over a name already there.
  const before = useRef<string | null>(null);
  useEffect(() => {
    const was = before.current;
    before.current = answer;
    if (was === null || was !== "" || answer === "" || !signerName) return;
    if (String(form.getValues(FIRST_PACK.checkedBy) ?? "").trim() !== "") return;
    form.setValue(FIRST_PACK.checkedBy, signerName, { shouldDirty: true, shouldValidate: true });
  }, [answer, signerName, form]);

  const take = async (file: File | undefined) => {
    if (!file || busy) return;
    setBusy(true);
    try {
      const result = await onPhoto(file);
      if (result) setLines(result);
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  };

  const verdict = lines ? packVerdict(lines) : null;
  // After a reload the detail is gone but the photos' notes are not: a mismatch still counts.
  const earlier = lines ? notes.slice(0, -1) : notes;
  const lastNoteWrong = !lines && notes.length > 0 && noteHasMismatch(notes[notes.length - 1]);
  const disagrees = answer === FIRST_PACK.matches && (verdict === "mismatch" || lastNoteWrong);

  return (
    <div className="rounded-md px-3 py-2.5 space-y-2 bg-[#C89B3C]/5">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => input.current?.click()}>
          {busy ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Camera className="w-4 h-4 mr-1.5" />}
          {busy ? "Reading the pack..." : notes.length || lines ? "Photograph another pack" : "Photograph the first pack"}
        </Button>
        <p className="text-xs text-[#2A1F0E]/70 flex-1 min-w-[14rem]">
          One photo with the flavor, lot code, best-by date and bar code in view. The photo is kept on this record. Take another after a change of product or a new roll of film.
        </p>
        <input ref={input} type="file" accept="image/*" capture="environment" className="hidden" onChange={e => take(e.target.files?.[0])} />
      </div>

      {lines && (
        <div className="space-y-1">
          {lines.map(l => {
            const Icon = ICON[l.state];
            return (
              <p key={l.point} className={`flex items-start gap-1.5 text-sm ${TONE[l.state]}`}>
                <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${ICON_TONE[l.state]}`} />
                <span>{l.text}</span>
              </p>
            );
          })}
          {verdict === "match" && answer === "" && (
            <Button
              type="button"
              size="sm"
              className="mt-1 bg-[#2E7D32] hover:bg-[#256628] text-white"
              onClick={() => form.setValue(FIRST_PACK.answer, FIRST_PACK.matches, { shouldDirty: true, shouldValidate: true })}
            >
              I checked the pack - it matches
            </Button>
          )}
          {verdict === "incomplete" && (
            <p className="text-xs text-amber-800">Look at the points marked above on the pack itself before answering, or take a clearer photo.</p>
          )}
          {verdict === "mismatch" && (
            <p className="text-xs text-red-700">Stop packing. Correct the coder or the film, then photograph the next first pack. Product already packed with the wrong code is held on FRM-702.</p>
          )}
        </div>
      )}

      {disagrees && (
        <p className="flex items-start gap-1.5 text-sm font-medium text-red-700">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>The last photo does not agree with the answer "{FIRST_PACK.matches}". Photograph the corrected pack, or change the answer.</span>
        </p>
      )}

      {earlier.length > 0 && (
        <div className="space-y-0.5">
          <p className="text-xs font-semibold text-[#2A1F0E]">{lines ? "Earlier photos on this record" : "Photos on this record"}</p>
          {earlier.map((n, i) => (
            <p key={i} className={`text-xs ${noteHasMismatch(n) ? "text-red-700" : "text-[#2A1F0E]/80"}`}>{i + 1}. {n}</p>
          ))}
        </div>
      )}
    </div>
  );
}

export const firstPackNotes = (attachments: { note?: string }[] | null | undefined): string[] =>
  (attachments ?? []).map(a => a.note ?? "").filter(isPackNote);
