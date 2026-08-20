import { useCallback, useEffect, useState } from "react";
import { type Workbook } from "interfaces-shared-types";
import { createWorkbook, listWorkbooks } from "./workbookApi";

interface UseWorkbooks {
  workbooks: Workbook[];
  loading: boolean;
  create: (name: string) => Promise<void>;
}

function useWorkbooks(
  projectId: string,
  elementCode: string,
  onError: (message: string) => void,
): UseWorkbooks {
  const [workbooks, setWorkbooks] = useState<Workbook[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    listWorkbooks(projectId, elementCode)
      .then((res) => { if (!cancelled) setWorkbooks(res.workbooks); })
      .catch((err: unknown) => {
        if (cancelled) return;
        onError((err as { message?: string }).message ?? "Could not load workbooks");
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [projectId, elementCode, onError]);

  const create = useCallback(
    async (name: string): Promise<void> => {
      const created = await createWorkbook(projectId, { elementCode, name });
      setWorkbooks((prev) => [created, ...prev]);
    },
    [projectId, elementCode],
  );

  return { workbooks, loading, create };
}

export { useWorkbooks };
