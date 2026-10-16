// Whether a downloaded SOP / FSQM PDF carries its Revision History (owner, 2026-10-16).
//
//  - Admin / owner: their own choice, the "Include Rev History" checkbox beside Download PDF,
//    unchecked to start, remembered per person for every document (user_preferences, so it follows
//    them to any device).
//  - Other staff: included (an internal reader).
//  - The auditor, or anyone without a team role: never included.
//
// Every Download PDF button reads this, so the list icons follow the choice made in the drawer.

import { isInternalReader, useUserRole } from "@/hooks/useUserRole";
import { useUserPref } from "@/lib/userPrefs";

export const PDF_REV_HISTORY = "pdf.includeRevHistory";

export function useSopPdfOptions() {
  const { role, roles } = useUserRole();
  const canChoose = role === "admin" || role === "owner";
  const [include, setInclude] = useUserPref<boolean>(PDF_REV_HISTORY, false);
  const revisionHistory = canChoose ? include === true : isInternalReader(roles);
  return { pdfOpts: { revisionHistory }, canChoose, include: include === true, setInclude };
}
