## Two small fixes

### 1. Coach orb covers the page (Templates upload button)

The floating "Manufacturing Coach" orb is 110×110 px and sits at `bottom-12 right-12`, overlapping the right side of the Templates page. On the current 993×583 viewport it covers the "Upload new version" button on the PSS Workbook card and there is no way to scroll it out of the way.

Fix in `src/components/CoachChat.tsx`:
- Shrink the orb to 72×72 px (still readable, no longer dominant).
- Move it to `bottom-6 right-6`.
- Scale the progress ring + percentage label down proportionally.
- Add `pointer-events-none` padding-bottom (`pb-24`) on the Templates page card list so the last row clears the orb even at the new size, as a belt-and-suspenders measure.

No behavior change to the chat panel itself.

### 2. Uploaded templates can't be opened / downloaded

`Templates.tsx` builds a signed URL and triggers it with a hidden `<a download>` click. Two issues:
- For PDFs, browsers ignore the `download` attribute on cross-origin signed URLs and silently do nothing in some cases.
- There's no way to just *view* the uploaded file inline to confirm it's the right one.

Fix in `src/pages/team/Templates.tsx`:
- Replace the single "Download" button with two actions per row:
  - **View** — opens the signed URL in a new tab (`window.open(url, "_blank")`).
  - **Download** — fetches the signed URL as a blob and saves via `URL.createObjectURL` + anchor click, which works reliably across browsers regardless of content-type.
- Lengthen the signed-URL expiry from 300 s to 600 s.
- Surface any storage error via toast instead of failing silently.

No DB or bucket changes; this is presentation + a more robust client-side download.

### Files touched
- `src/components/CoachChat.tsx` — orb size + position.
- `src/pages/team/Templates.tsx` — View/Download actions + bottom padding.

### Out of scope
- Reworking the orb into a dock/minimizable widget (can do later if you want).
- Changing the bucket to public or adding a permanent CDN URL.
