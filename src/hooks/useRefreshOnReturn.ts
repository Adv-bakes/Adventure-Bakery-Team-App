// Read a page's records again when the person comes back to it (owner, 2026-10-15).
//
// The Today page and the lot / batch pages read the records once. Somebody who records a load on
// the tablet and then looks at the computer saw the computer's old copy until they reloaded it.
// Now a page re-reads when its tab or window comes back into view after being away a while, and
// offers the same re-read as a refresh icon beside its title.
//
// Hidden or blurred is not enough on its own: a computer left showing the Today page while the
// person works on the tablet never loses focus, so nothing fired (owner, 2026-10-15). So a page
// with no mouse, keyboard or touch for IDLE_MS also counts as left, and the first movement re-reads.
//
// The re-read is quiet: the page is never swapped for a spinner, so a step in hand, an open
// pop-up and anything being typed stay where they are.

import { useCallback, useEffect, useRef, useState } from "react";

/** Away less than this (a photo taken with the camera, a quick look elsewhere) and nothing is re-read. */
const AWAY_MS = 10_000;
/** No mouse, keyboard or touch on the page for this long, and the next one re-reads. */
const IDLE_MS = 30_000;
const ACTIVITY = ["pointermove", "pointerdown", "keydown", "wheel", "touchstart"] as const;

/**
 * `load` re-reads the page's records. Returns `refresh` (for the icon) and `refreshing` (to spin it).
 * Two re-reads never run at once.
 */
export function useRefreshOnReturn(load: () => Promise<unknown>) {
  const [refreshing, setRefreshing] = useState(false);
  const running = useRef(false);
  const loadRef = useRef(load);
  loadRef.current = load;

  const refresh = useCallback(async () => {
    if (running.current) return;
    running.current = true;
    setRefreshing(true);
    try { await loadRef.current(); }
    finally { running.current = false; setRefreshing(false); }
  }, []);

  useEffect(() => {
    let leftAt: number | null = document.visibilityState === "hidden" ? Date.now() : null;
    let lastActive = Date.now();
    const away = () => { if (leftAt == null) leftAt = Date.now(); };
    const back = () => {
      if (leftAt == null) return;
      const gone = Date.now() - leftAt;
      leftAt = null;
      lastActive = Date.now(); // coming back is activity: the first movement after it is not a second re-read
      if (gone >= AWAY_MS) void refresh();
    };
    const onVisibility = () => { if (document.visibilityState === "hidden") away(); else back(); };
    const active = () => {
      const now = Date.now();
      const idle = now - lastActive;
      lastActive = now;
      if (idle >= IDLE_MS && leftAt == null && document.visibilityState === "visible") void refresh();
    };
    ACTIVITY.forEach(e => window.addEventListener(e, active, { passive: true, capture: true }));
    // A computer with two windows side by side never hides the page: focus is what changes there.
    window.addEventListener("blur", away);
    window.addEventListener("focus", back);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("blur", away);
      window.removeEventListener("focus", back);
      document.removeEventListener("visibilitychange", onVisibility);
      ACTIVITY.forEach(e => window.removeEventListener(e, active, { capture: true }));
    };
  }, [refresh]);

  return { refresh, refreshing };
}
