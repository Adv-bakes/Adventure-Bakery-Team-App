import { Checkbox } from "@/components/ui/checkbox";
import { PenLine } from "lucide-react";
import { format } from "date-fns";
import type { SignatureField, SignatureValue } from "@/lib/formSchema";

export interface Signer {
  userId: string;
  name: string;
}

interface SignatureFieldInputProps {
  field: SignatureField;
  value: SignatureValue | null;
  onChange: (value: SignatureValue | null) => void;
  disabled?: boolean;
  isAdmin?: boolean;
  signer?: Signer;
}

/**
 * Typed acknowledgment signature: checking the box stamps the current user's
 * id + name + timestamp (audit-defensible without drawing). Verifier-role
 * signatures can only be signed by admin/owner.
 */
export function SignatureFieldInput({ field, value, onChange, disabled, isAdmin, signer }: SignatureFieldInputProps) {
  const isVerifier = field.role === "verifier";
  const canSign = !disabled && !!signer && (!isVerifier || isAdmin);
  const signed = !!value?.name;

  const toggle = (checked: boolean) => {
    if (!signer) return;
    onChange(checked
      ? { user_id: signer.userId, name: signer.name, signed_at: new Date().toISOString() }
      : null);
  };

  const signedLine = signed
    ? (() => {
        try { return `${value!.name} — ${format(new Date(value!.signed_at), "M/d/yyyy h:mm a")}`; }
        catch { return value!.name; }
      })()
    : null;

  return (
    <div
      className="rounded-md border p-3 space-y-2"
      style={{ borderColor: "rgba(200,155,60,0.35)", background: "rgba(200,155,60,0.04)" }}
    >
      <div className="flex items-center gap-2 text-xs font-medium text-[#9A6F1E]">
        <PenLine className="w-3.5 h-3.5" />
        {field.label}
        {isVerifier && <span className="font-normal text-[#2A1F0E]/50">(verified by — admin only)</span>}
      </div>
      {field.statement && <p className="text-xs text-[#2A1F0E]/70">{field.statement}</p>}
      <div className="flex items-center gap-2">
        <Checkbox
          id={`sig-${field.id}`}
          checked={signed}
          disabled={!canSign}
          onCheckedChange={c => toggle(!!c)}
        />
        <label htmlFor={`sig-${field.id}`} className={`text-sm ${canSign ? "cursor-pointer" : "opacity-60"}`}>
          {signed
            ? <span className="font-medium" style={{ fontFamily: "cursive" }}>{signedLine}</span>
            : isVerifier && !isAdmin
              ? "Awaiting verification"
              : `Sign as ${signer?.name ?? "…"}`}
        </label>
      </div>
    </div>
  );
}
