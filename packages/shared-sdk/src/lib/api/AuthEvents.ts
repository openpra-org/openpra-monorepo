import { AuthToken } from "shared-types";
export type AuthEventType = "login" | "logout" | "tokenRefreshed" | "userChanged";
export interface AuthEvent {
  type: AuthEventType;
  user?: AuthToken | null;
}
type Listener = (event: AuthEvent) => void;
const listeners = new Set<Listener>();
export function onAuthEvent(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
export function emitAuthEvent(event: AuthEvent): void {
  [...listeners].forEach((l) => {
    try {
      l(event);
    } catch (_e) {}
  });
}
