import { useCallback, useEffect, useMemo, useState } from "react";
import type { WorkbookShareAccess } from "interfaces-shared-types/workbooks";
import { getWorkbookShares } from "./workbookSharingApi";
import { WORKBOOK_REFRESHED_EVENT } from "./useWorkbookLiveUpdates";

interface WorkbookSharing {
  loaded: boolean;
  access: WorkbookShareAccess | null;
  canShare: boolean;
  preparerView: boolean;
  authoring: boolean;
  sharedOnly: boolean;
  shareOpen: boolean;
  openShare: () => void;
  closeShare: () => void;
  reload: () => void;
}

interface SharingState {
  workbookId: string;
  access: WorkbookShareAccess | null;
  canShare: boolean;
}

function useWorkbookSharing(workbookId: string | undefined, roles: readonly string[]): WorkbookSharing {
  const [state, setState] = useState<SharingState | null>(null);
  const [generation, setGeneration] = useState(0);
  const [shareOpen, setShareOpen] = useState(false);

  useEffect(() => {
    if (workbookId === undefined) return undefined;
    let cancelled = false;
    getWorkbookShares(workbookId)
      .then((shares) => { if (!cancelled) setState({ workbookId, access: shares.myAccess, canShare: shares.canShare }); })
      .catch(() => { if (!cancelled) setState({ workbookId, access: null, canShare: false }); });
    return () => { cancelled = true; };
  }, [workbookId, generation]);

  useEffect(() => {
    if (workbookId === undefined) return undefined;
    const onRefreshed = (event: Event): void => {
      if (event instanceof CustomEvent && event.detail === workbookId) setGeneration((count) => count + 1);
    };
    window.addEventListener(WORKBOOK_REFRESHED_EVENT, onRefreshed);
    return () => { window.removeEventListener(WORKBOOK_REFRESHED_EVENT, onRefreshed); };
  }, [workbookId]);

  const reload = useCallback((): void => { setGeneration((count) => count + 1); }, []);
  const openShare = useCallback((): void => { setShareOpen(true); }, []);
  const closeShare = useCallback((): void => { setShareOpen(false); }, []);

  return useMemo((): WorkbookSharing => {
    const current = state !== null && state.workbookId === workbookId ? state : null;
    const access = current?.access ?? null;
    const preparer = roles.includes("preparer") || roles.includes("co_preparer");
    return {
      loaded: current !== null,
      access,
      canShare: current?.canShare ?? false,
      preparerView: preparer || access !== null,
      authoring: preparer || access === "edit",
      sharedOnly: !preparer && access !== null,
      shareOpen,
      openShare,
      closeShare,
      reload,
    };
  }, [state, workbookId, roles, shareOpen, openShare, closeShare, reload]);
}

export { useWorkbookSharing, type WorkbookSharing };
