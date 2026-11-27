import { useEffect, useRef } from "react";
import { WORKBOOK_CONFLICT_EVENT, whenWorkbookIdle, workbookClientId } from "../api/client";
import { readWorkbookLive } from "./workbookSharingApi";

const WORKBOOK_REFRESHED_EVENT = "openpra:workbook-refreshed";
const REFRESH_DELAY_MS = 300;
const RETRY_BASE_MS = 2_000;
const RETRY_LIMIT_MS = 30_000;
const STEADY_CONNECTION_MS = 60_000;

function useWorkbookLiveUpdates(workbookId: string | undefined, refresh: () => Promise<void>): void {
  const refreshRef = useRef(refresh);
  useEffect(() => { refreshRef.current = refresh; }, [refresh]);

  useEffect(() => {
    if (workbookId === undefined) return undefined;
    let stopped = false;
    let scheduled = false;
    let refreshTimer = 0;
    let retryTimer = 0;
    let controller: AbortController | null = null;

    const runRefresh = async (): Promise<void> => {
      await whenWorkbookIdle(workbookId);
      scheduled = false;
      if (stopped) return;
      await refreshRef.current().catch(() => undefined);
      window.dispatchEvent(new CustomEvent(WORKBOOK_REFRESHED_EVENT, { detail: workbookId }));
    };

    const schedule = (): void => {
      if (stopped || scheduled) return;
      scheduled = true;
      window.clearTimeout(refreshTimer);
      refreshTimer = window.setTimeout(() => { void runRefresh(); }, REFRESH_DELAY_MS);
    };

    const onConflict = (event: Event): void => {
      if (event instanceof CustomEvent && event.detail === workbookId) schedule();
    };

    const connect = (attempt: number): void => {
      if (stopped) return;
      const current = new AbortController();
      controller = current;
      const startedAt = Date.now();
      if (attempt > 0) schedule();
      const retry = (): void => {
        if (stopped) return;
        const next = Date.now() - startedAt > STEADY_CONNECTION_MS ? 1 : attempt + 1;
        retryTimer = window.setTimeout(() => { connect(next); }, Math.min(RETRY_LIMIT_MS, RETRY_BASE_MS * 2 ** (next - 1)));
      };
      readWorkbookLive(workbookId, current.signal, (event) => { if (event.clientId !== workbookClientId()) schedule(); })
        .then((end) => { if (end !== "refused") retry(); })
        .catch(() => { retry(); });
    };

    window.addEventListener(WORKBOOK_CONFLICT_EVENT, onConflict);
    connect(0);
    return () => {
      stopped = true;
      window.removeEventListener(WORKBOOK_CONFLICT_EVENT, onConflict);
      window.clearTimeout(refreshTimer);
      window.clearTimeout(retryTimer);
      controller?.abort();
    };
  }, [workbookId]);
}

export { WORKBOOK_REFRESHED_EVENT, useWorkbookLiveUpdates };
