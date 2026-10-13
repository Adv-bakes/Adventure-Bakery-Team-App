import { useWatch, type UseFormReturn } from "react-hook-form";
import { AlertTriangle, CheckCircle2, Info } from "lucide-react";
import { PACK_WEIGHTS, packWeights } from "@/lib/packWeights";

/**
 * FRM-520 (from v2), under the three pack weights: the app takes the empty packaging off, averages
 * the three and says whether that is at or above the net weight on the label. The weights stay the
 * person's - nothing is filled in - and a short weight is said, never refused.
 */
export function PackWeightLine({ form }: { form: UseFormReturn<any> }) {
  const names = [PACK_WEIGHTS.declared, PACK_WEIGHTS.tare, PACK_WEIGHTS.unit, ...PACK_WEIGHTS.weights];
  const watched = useWatch({ control: form.control, name: names });
  const r = packWeights(Object.fromEntries(names.map((n, i) => [n, watched[i]])));
  const ok = r.state === "ok";
  const quiet = r.state === "incomplete";
  const Icon = ok ? CheckCircle2 : quiet ? Info : AlertTriangle;
  const tone = ok ? "text-[#2A1F0E]" : quiet ? "text-[#2A1F0E]/70" : "text-red-700 font-medium";
  return (
    <p className={`flex items-start gap-1.5 rounded-md px-3 py-2 text-sm bg-[#C89B3C]/5 ${tone}`}>
      <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${ok ? "text-green-700" : ""}`} />
      <span>{r.text}</span>
    </p>
  );
}
