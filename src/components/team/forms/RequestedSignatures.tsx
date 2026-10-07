// Signature lines that belong to a person named on the record (SignatureField.signedBy) - the
// employee's acknowledgment on FRM-952. Shown under the form on the entry page, one block per line
// still unsigned:
//
//   - the person filling the record in chooses a team member and sends the request (or withdraws it);
//   - the person asked sees the statement and signs from their own log-in.
//
// The signature is written by the server (sign_response_field), which changes that one answer and
// nothing else - so the person signing cannot alter the record they are putting their name to, and
// nobody can tick the line on their behalf. Everything shown here reads the SAVED entry.

import { useEffect, useState } from "react";
import { format } from "date-fns";
import { Loader2, PenLine } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { requestedSignatureFields, type FormSchema, type SignatureField, type SignatureValue } from "@/lib/formSchema";
import {
  fetchTeamSigners, openFieldSignatureRequests, requestFieldSignature, signRequestedField,
  withdrawFieldSignatureRequests, type AppNotification, type Signatory,
} from "@/lib/notifications";

interface RequestedSignaturesProps {
  schema: FormSchema;
  responseId: string;
  /** The entry as saved. */
  data: Record<string, unknown>;
  me?: { userId: string; name: string };
  /** The viewer may edit this draft (its filler, or an admin) - so may ask and withdraw. */
  canEdit: boolean;
  /** Unsaved changes on screen: the person asked would read the saved entry, not these. */
  dirty: boolean;
  /** A signature was written to the entry; the page reloads it. */
  onSigned: () => void;
}

const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

export function RequestedSignatures({ schema, responseId, data, me, canEdit, dirty, onSigned }: RequestedSignaturesProps) {
  const fields = requestedSignatureFields(schema)
    .filter(f => !(data[f.id] as SignatureValue | null | undefined)?.name);
  const [requests, setRequests] = useState<Record<string, AppNotification>>({});
  const [people, setPeople] = useState<Signatory[]>([]);
  const wanted = fields.length > 0;

  const refresh = async () => {
    try { setRequests(await openFieldSignatureRequests(responseId)); }
    catch { /* The blocks fall back to "not asked yet". */ }
  };
  useEffect(() => {
    if (!wanted) return;
    void refresh();
    fetchTeamSigners().then(setPeople).catch(() => toast.error("Could not load the team list"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [responseId, wanted]);

  if (!wanted) return null;
  return (
    <div className="space-y-3">
      {fields.map(f => (
        <Line
          key={f.id}
          field={f}
          responseId={responseId}
          request={requests[f.id] ?? null}
          people={people}
          named={f.signedBy?.nameField ? String(data[f.signedBy.nameField] ?? "") : ""}
          me={me}
          canEdit={canEdit}
          dirty={dirty}
          onChanged={refresh}
          onSigned={onSigned}
        />
      ))}
    </div>
  );
}

function Line({ field, responseId, request, people, named, me, canEdit, dirty, onChanged, onSigned }: {
  field: SignatureField; responseId: string; request: AppNotification | null; people: Signatory[];
  named: string; me?: { userId: string; name: string }; canEdit: boolean; dirty: boolean;
  onChanged: () => Promise<void>; onSigned: () => void;
}) {
  const [who, setWho] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  // Suggest the person named on the record, once the team list is in. Never overrides a choice.
  useEffect(() => {
    if (who || !named) return;
    const match = people.find(p => same(p.name, named));
    if (match) setWho(match.id);
  }, [people, named, who]);

  const run = async (work: () => Promise<void>, done: string) => {
    setBusy(true);
    try { await work(); toast.success(done); }
    catch (e: any) { toast.error(e.message ?? "That did not go through"); }
    finally { setBusy(false); }
  };

  const askedOf = request ? people.find(p => p.id === request.assigned_to)?.name ?? "a team member" : "";
  const forMe = !!request && !!me && request.assigned_to === me.userId;
  if (!forMe && !canEdit) return null;

  return (
    <Card className="p-4 space-y-3" style={{ borderColor: "rgba(200,155,60,0.5)" }}>
      <div className="flex items-center gap-2 text-sm font-medium text-[#9A6F1E]">
        <PenLine className="w-4 h-4" />{field.label}
      </div>

      {forMe ? (
        <>
          <p className="text-sm">You have been asked to sign this record. Read it first.</p>
          {field.statement && <p className="text-sm text-[#2A1F0E]/85">{field.statement}</p>}
          <Button
            type="button" disabled={busy}
            onClick={() => run(async () => { await signRequestedField(responseId, field.id); onSigned(); }, "Signed")}
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Sign as {me!.name}</>}
          </Button>
        </>
      ) : request ? (
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-sm">
            Asked of <span className="font-medium">{askedOf}</span> on{" "}
            {format(new Date(request.created_at), "M/d/yyyy h:mm a")}. It is in their notifications.
          </p>
          <Button
            type="button" variant="outline" size="sm" disabled={busy}
            onClick={() => run(async () => {
              await withdrawFieldSignatureRequests(responseId, field.id, "Withdrawn by the requester");
              await onChanged();
            }, "Request withdrawn")}
          >
            Withdraw
          </Button>
        </div>
      ) : (
        <>
          <p className="text-sm text-[#2A1F0E]/85">
            This line is signed by the person themselves, from their own log-in. Choose who to ask;
            they get it in their notifications with a link to this record.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <label className="text-xs font-medium">Who should sign it</label>
              <Select value={who} onValueChange={setWho}>
                <SelectTrigger><SelectValue placeholder="Choose a person" /></SelectTrigger>
                <SelectContent>
                  {people.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium">Note (optional)</label>
              <Textarea rows={1} value={note} onChange={e => setNote(e.target.value)} />
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button
              type="button" disabled={busy || !who || dirty}
              onClick={() => run(async () => {
                await requestFieldSignature(responseId, field.id, who, note);
                setNote("");
                await onChanged();
              }, "Signature requested")}
            >
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : "Request signature"}
            </Button>
            {dirty && <p className="text-xs text-amber-700">Save the draft first - they will see what has been saved.</p>}
          </div>
        </>
      )}
    </Card>
  );
}
