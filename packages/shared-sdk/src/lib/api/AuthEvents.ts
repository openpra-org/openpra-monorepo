import { AuthToken } from "shared-types";

export type AuthEventType = "login" | "logout" | "tokenRefreshed" | "userChanged";

export interface AuthEvent {
  type: AuthEventType;
  user?: AuthToken | null;
}

type Listener = (event: AuthEvent) => void;

const listeners = new Set<Listener>();

/**
 * Subscribe to authentication lifecycle events.
 * Returns an unsubscribe function.
 */
export function onAuthEvent(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Emit an authentication event to all subscribers.
 * SDK internals should call this when auth state changes.
 */
export function emitAuthEvent(event: AuthEvent): void {
  // Copy to array to avoid issues if a listener unsubscribes during iteration
  [...listeners].forEach((l) => {
    try {
      l(event);
    } catch (_e) {
      // Swallow listener errors to avoid breaking emit chain
    }
  });
}
