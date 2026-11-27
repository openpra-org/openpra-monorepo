import { useEffect, useRef } from "react";

function editingWindowOpen(): boolean {
  return document.querySelector("[aria-modal=\"true\"]") !== null;
}

function useLinkedWorkbookRefresh(refresh: () => Promise<void>): void {
  const refreshRef = useRef(refresh);

  useEffect(() => {
    refreshRef.current = refresh;
  }, [refresh]);

  useEffect(() => {
    let running = false;
    let waiting: MutationObserver | null = null;

    const stopWaiting = (): void => {
      waiting?.disconnect();
      waiting = null;
    };

    const start = (): void => {
      if (running) return;
      running = true;
      refreshRef.current()
        .catch(() => undefined)
        .finally(() => { running = false; });
    };

    const onReturn = (): void => {
      if (document.visibilityState !== "visible") return;
      if (!editingWindowOpen()) {
        stopWaiting();
        start();
        return;
      }
      if (waiting !== null) return;
      waiting = new MutationObserver(() => {
        if (editingWindowOpen()) return;
        stopWaiting();
        start();
      });
      waiting.observe(document.body, { childList: true, subtree: true });
    };

    document.addEventListener("visibilitychange", onReturn);
    window.addEventListener("focus", onReturn);
    return () => {
      document.removeEventListener("visibilitychange", onReturn);
      window.removeEventListener("focus", onReturn);
      stopWaiting();
    };
  }, []);
}

export { useLinkedWorkbookRefresh };
