## Goals

1. Reject must always complete, even if email fails.
2. Outbound mail uses the existing sales channel `scale@adventurebakery.info` — drop `notify.adventurebakery.info`. No new domains, no extra $20/mo.
3. Same channel everywhere: PRF confirmation, send-documents, and rejection all originate from the same address.

## Approach — mailto handoff (no server send)

Stop trying to send rejection email server-side. Instead:

- Polish the draft with AI as today (`draft-rejection-email`), then **open a `mailto:` link** in the staff member's default desktop mail client, prefilled with To, CC `scale@adventurebakery.info`, Subject, Body.
- Reject + archive happens **immediately on confirm**, independent of whether the mail client actually sends. The dialog shows the prefilled draft, a "Open in mail app" button, and a "Copy to clipboard" fallback for staff on browsers without a mailto handler.
- Delete the `send-rejection-email` edge function entirely — it's the source of the 502 and not needed.

Why mailto over Gmail compose: works for whatever client staff actually uses (Apple Mail, Outlook, Gmail-as-default-handler all honor mailto). Gmail-only would break staff not on Gmail. We can add a secondary "Open in Gmail" link as a fallback (`https://mail.google.com/mail/?view=cm&...`) for one click.

## PRF confirmation + send-documents

Both currently send via Resend from `noreply@notify.adventurebakery.info`. Two changes:

- Switch `from` to `Adventure Bakery <scale@adventurebakery.info>` in both `send-prf-confirmation` and `send-client-documents`. Keep `reply_to` and CC the same.
- This requires `adventurebakery.info` (root) to be verified in Resend. **If it isn't verified yet, the functions will return the same 403** — so the UI must treat email failure as non-fatal: the PRF still saves, the document tokens still mint, the magic link is still shown to staff to copy/paste manually.

Concretely:
- `SalesDocumentsInbox.accept()` already mints the token server-side; on email failure, surface the magic link in a toast + "Copy link" button so staff can paste it into their own email. Lead still advances to "Send Documents".
- PRF confirmation failure is logged but never blocks the submitter.

## Recipient email visibility

The reject draft sometimes lacked the email because the project card only shows the contact name. Fix on the dialog side: show `To: <email>` prominently in the header, and disable the "Open in mail app" button (with a clear message) if `to` is empty — never silently fail.

## Files

- `src/components/sales/RejectEmailDialog.tsx` — replace `supabase.functions.invoke("send-rejection-email", …)` with mailto open + Gmail fallback link + Copy button. Mark PRF rejected + archive lead BEFORE the mailto open, so the flow completes regardless. Show `To:` email in header.
- `supabase/functions/send-rejection-email/` — delete.
- `supabase/functions/send-prf-confirmation/index.ts` — change `from` to `scale@adventurebakery.info`.
- `supabase/functions/send-client-documents/index.ts` — change `from` to `scale@adventurebakery.info`; on Resend non-2xx, still return `success:true` with `magicLink` and an `emailError` field so the UI can surface "email didn't send — copy this link" without aborting the accept flow.
- `src/pages/sales/SalesDocumentsInbox.tsx` (caller of send-client-documents) — handle the `emailError` branch: toast with magic link + Copy button, still advance the lead.

## Out of scope

- Verifying `adventurebakery.info` in Resend (DNS work, user-side).
- Switching to Lovable Emails or any new provider.
- Moving to `orders@adventurebakery.com` (production cutover, later).
