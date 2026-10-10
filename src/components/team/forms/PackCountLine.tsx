import { useWatch, type UseFormReturn } from "react-hook-form";
import { AlertTriangle, CheckCircle2, Info } from "lucide-react";
import { PACK_COUNTS, packCounts } from "@/lib/packCounts";

/**
 * FRM-520, under the packing counts: the app adds the three counts up and says whether the rack
 * count is accounted for. The counts themselves stay the person's - nothing is filled in.
 */
export function PackCountLine({ form }: { form: UseFormReturn<any> }) {
  const [racked, packed, notPacked, notes] = useWatch({
    control: form.control,
    name: [PACK_COUNTS.racked, PACK_COUNTS.packed, PACK_COUNTS.notPacked, PACK_COUNTS.notes],
  });
  const r = packCounts({
    [PACK_COUNTS.racked]: racked, [PACK_COUNTS.packed]: packed, [PACK_COUNTS.notPacked]: notPacked, [PACK_COUNTS.notes]: notes,
  });
  const ok = r.state === "adds_up";
  const quiet = r.state === "incomplete";
  const Icon = ok ? CheckCircle2 : quiet ? Info : AlertTriangle;
  const tone = ok ? "text-[#2A1F0E]" : quiet ? "text-[#2A1F0E]/70" : r.needsNote ? "text-red-700 font-medium" : "text-amber-800";
  return (
    <p className={`flex items-start gap-1.5 rounded-md px-3 py-2 text-sm bg-[#C89B3C]/5 ${tone}`}>
      <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${ok ? "text-green-700" : ""}`} />
      <span>{r.text}</span>
    </p>
  );
}
