// A person's own settings for the app (public.user_preferences): one row per key, a JSON value.
//
// Use it for anything that should follow the PERSON across devices and not be shared by whoever
// else uses the same tablet - the first use is which helper texts of a form they have hidden.
// A new setting is a new key; it needs no migration. Namespace the key by its owner:
// "form.helpHidden:<document id>".
//
// THESE ARE CONVENIENCES, NEVER RECORDS. A setting that fails to load or save must never stop a
// page working, so nothing here throws: on any failure the screen keeps its default (or the last
// value this browser saw) and carries on.
//
// HOW IT STAYS QUICK. All of a person's settings are read once per page load. A copy is kept in
// localStorage, tagged with the user id, so a page opens already in the person's arrangement
// instead of flashing the default and then changing. If somebody else is signed in, their copy
// is not used.

import { useCallback, useState, useSyncExternalStore } from "react";
import { supabase } from "@/integrations/supabase/client";

const CACHE_KEY = "userPrefs.cache";
type Snapshot = { userId: string; values: Record<string, unknown> };

function readCache(): Snapshot | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    return parsed && typeof parsed.userId === "string" && parsed.values && typeof parsed.values === "object" ? parsed : null;
  } catch { return null; }
}
function writeCache() {
  try {
    if (snapshot) localStorage.setItem(CACHE_KEY, JSON.stringify(snapshot));
    else localStorage.removeItem(CACHE_KEY);
  } catch { /* no storage: this page load only */ }
}

let snapshot: Snapshot | null = readCache();
let loading: Promise<void> | null = null;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach(l => l());
const table = () => (supabase as any).from("user_preferences");

/** Read the signed-in person's settings, once per page load (and again when the account changes). */
function load(): Promise<void> {
  if (loading) return loading;
  loading = (async () => {
    try {
      const { data } = await supabase.auth.getSession();
      const userId = data?.session?.user?.id ?? null;
      if (!userId) { snapshot = null; return; }
      // Another person's copy from this browser is not this person's arrangement.
      if (snapshot?.userId !== userId) snapshot = { userId, values: {} };
      const { data: rows, error } = await table().select("key, value").eq("user_id", userId);
      if (error) throw error;
      snapshot = { userId, values: Object.fromEntries((rows ?? []).map((r: any) => [r.key, r.value])) };
    } catch {
      // The table is not there yet, or the network is down: keep what this browser has.
    } finally {
      writeCache();
      notify();
    }
  })();
  return loading;
}

// Signing out, or in as somebody else, on a shared tablet: read again for whoever it is now.
supabase.auth.onAuthStateChange((_event, session) => {
  const userId = session?.user?.id ?? null;
  if ((snapshot?.userId ?? null) === userId && loading) return;
  if (!userId) { snapshot = null; writeCache(); notify(); }
  loading = null;
  void load();
});

function subscribe(listener: () => void) {
  listeners.add(listener);
  void load();
  return () => { listeners.delete(listener); };
}

/** Save one setting. The screen changes at once; the save follows and is not waited for. */
export function setUserPref(key: string, value: unknown): void {
  if (snapshot) {
    snapshot = { ...snapshot, values: { ...snapshot.values, [key]: value } };
    writeCache();
    notify();
  }
  void (async () => {
    try {
      await load();
      const userId = snapshot?.userId;
      if (!userId) return;
      if (snapshot && snapshot.values[key] !== value) {
        snapshot = { ...snapshot, values: { ...snapshot.values, [key]: value } };
        writeCache();
        notify();
      }
      const { error } = await table().upsert({ user_id: userId, key, value }, { onConflict: "user_id,key" });
      if (error) throw error;
    } catch (e) {
      console.warn("A setting could not be saved; it is kept on this device only.", e);
    }
  })();
}

/**
 * One of the signed-in person's settings, and a function to change it. `key` null means there is
 * nothing to remember it against (a preview): the value then lives for the visit only.
 * `fallback` must be a stable value (a constant), since it is returned as-is while nothing is set.
 */
export function useUserPref<T>(key: string | null, fallback: T): [T, (value: T) => void] {
  const stored = useSyncExternalStore(subscribe, () => (key && snapshot ? snapshot.values[key] : undefined));
  const [local, setLocal] = useState<T | undefined>(undefined);
  const set = useCallback((value: T) => {
    setLocal(value);
    if (key) setUserPref(key, value);
  }, [key]);
  // Before the person's settings are known (or with no key), the last value set on this screen stands.
  const value = (key && stored !== undefined ? stored : local !== undefined ? local : fallback) as T;
  return [value, set];
}
