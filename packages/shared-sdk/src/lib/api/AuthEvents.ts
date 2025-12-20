import { AuthToken } from 'shared-types';

/**
 * Known authentication lifecycle events emitted by the SDK.
 */
export type AuthEventType =
  | 'login'
  | 'logout'
  | 'tokenRefreshed'
  | 'userChanged';

/**
 * Payload delivered to auth event listeners.
 * For login/logout, user may be provided depending on availability.
 */
export interface AuthEvent {
  type: AuthEventType;
  user?: AuthToken | null;
}

type Listener = (event: AuthEvent) => void;

const listeners = new Set<Listener>();

/**
 * Subscribe to authentication lifecycle events.
 * @param listener - Callback invoked on each auth event.
 * @returns Unsubscribe function to remove the listener.
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
 * @param event - Auth event payload.
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
