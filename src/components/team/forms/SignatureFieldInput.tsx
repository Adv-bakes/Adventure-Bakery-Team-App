import { DocRefText } from "./DocRefText";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { PenLine } from "lucide-react";
import { format } from "date-fns";
import { SIGNATURE_IMAGE_RE, type SignatureField, type SignatureValue } from "@/lib/formSchema";
import { SignaturePad } from "./SignaturePad";

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
  /** Drawn signatures only: the name to start with, e.g. the visitor's name typed earlier. */
  defaultName?: string;
}

/**
 * Typed acknowledgment signature: checking the box stamps the current user's
 * id + name + timestamp (audit-defensible without drawing). Verifier-role
 * signatures can only be signed by admin/owner.
 *
 * A `capture: "drawn"` field is the exception: it is signed by somebody with no account, who
 * types their name and draws. The signed-in user is recorded as the witness, not the signer.
 */
export function SignatureFieldInput(props: SignatureFieldInputProps) {
  return props.field.capture === "drawn" ? <DrawnSignature {...props} /> : <StampSignature {...props} />;
}

const boxStyle = { borderColor: "rgba(200,155,60,0.35)", background: "rgba(200,155,60,0.04)" };

function signedLineOf(value: SignatureValue | null): string | null {
  if (!value?.name) return null;
  try { return `${value.name} — ${format(new Date(value.signed_at), "M/d/yyyy h:mm a")}`; }
  catch { return value.name; }
}

function DrawnSignature({ field, value, onChange, disabled, signer, defaultName }: SignatureFieldInputProps) {
  const name = value?.name ?? defaultName ?? "";
  const image = value?.image && SIGNATURE_IMAGE_RE.test(value.image) ? value.image : undefined;

  // Name and drawing are one value; it is null only when both are empty, so a half-finished
  // signature survives a draft save and still fails the submit check.
  const emit = (nextName: string, nextImage: string | undefined) => {
    if (!nextName.trim() && !nextImage) { onChange(null); return; }
    onChange({
      user_id: null,
      name: nextName,
      signed_at: new Date().toISOString(),
      ...(nextImage ? { image: nextImage } : {}),
      ...(signer ? { witnessed_by: signer.userId } : {}),
    });
  };

  return (
    <div className="rounded-md border p-3 space-y-2" style={boxStyle}>
      <div className="flex items-center gap-2 text-xs font-medium text-[#9A6F1E]">
        <PenLine className="w-3.5 h-3.5" />
        <DocRefText text={field.label} />
      </div>
      {field.statement && <p className="text-xs text-[#2A1F0E]/85"><DocRefText text={field.statement} /></p>}
      {disabled ? (
        <>
          {image
            ? <img src={image} alt={`Signature of ${name}`} className="h-16 rounded border bg-white" />
            : <p className="text-sm opacity-60">Not signed</p>}
          {signedLineOf(value) && <p className="text-sm font-medium">{signedLineOf(value)}</p>}
        </>
      ) : (
        <>
          <Input
            aria-label={`${field.label} — name`}
            placeholder="Full name"
            value={name}
            onChange={e => emit(e.target.value, image)}
          />
          <SignaturePad value={image} onChange={img => emit(name, img)} />
        </>
      )}
    </div>
  );
}

function StampSignature({ field, value, onChange, disabled, isAdmin, signer }: SignatureFieldInputProps) {
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
        <DocRefText text={field.label} />
        {isVerifier && <span className="font-normal text-[#2A1F0E]/65">(verified by — admin only)</span>}
      </div>
      {field.statement && <p className="text-xs text-[#2A1F0E]/85"><DocRefText text={field.statement} /></p>}
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
