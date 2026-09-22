import { useSyncExternalStore } from "react";

export interface CoachSource { id: string; number: string; title: string }
export interface CoachMessage { role: "user" | "assistant"; content: string; sources?: CoachSource[] }

/**
 * The Coach conversation lives outside React on purpose. The Coach's Sheet unmounts its content
 * on close, and every route in App.tsx wraps its own <TeamLayout>, so layout state is rebuilt on
 * each page change. A module-level store survives both and resets on reload (session-only by
 * design). A reply that arrives after the panel closed still lands here.
 */
let messages: CoachMessage[] = [];
const listeners = new Set<() => void>();

export function getCoachMessages(): CoachMessage[] {
  return messages;
}

export function setCoachMessages(next: CoachMessage[]): void {
  messages = next;
  listeners.forEach((l) => l());
}

/** Called on sign-out so the next person on a shared tablet starts clean. */
export function clearCoachConversation(): void {
  setCoachMessages([]);
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useCoachMessages(): CoachMessage[] {
  return useSyncExternalStore(subscribe, getCoachMessages);
}
