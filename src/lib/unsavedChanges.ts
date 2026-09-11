// Which open form entry, if any, is holding unsaved edits.
//
// This app runs on BrowserRouter, which has no navigation blocker, so an in-app link away from a
// half-filled entry discards it silently (FormEntry's beforeunload guard only covers a reload or a
// closed tab). The voice panel navigates, so it has to be able to ask first. FormEntry reports its
// dirty state here; the panel reads it before leaving a DIFFERENT entry. Deliberately a module
// variable rather than context: there is only ever one FormEntry mounted, and nothing re-renders on it.

let dirtyResponseId: string | null = null;

export function setUnsavedForm(responseId: string, isDirty: boolean): void {
  if (isDirty) dirtyResponseId = responseId;
  else if (dirtyResponseId === responseId) dirtyResponseId = null;
}

/** The entry with unsaved edits, or null. */
export function unsavedFormId(): string | null {
  return dirtyResponseId;
}
