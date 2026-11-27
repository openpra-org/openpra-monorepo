import { useCallback } from "react";
import { useParams } from "react-router-dom";
import type { WorkbookLinkedRevision } from "interfaces-shared-types/workbooks";
import { getWorkbookLinkedRevisions } from "./workbookReviewApi";

function useLinkedRevisionsReader(): () => Promise<WorkbookLinkedRevision[]> {
  const { id } = useParams<{ id: string }>();
  return useCallback(async (): Promise<WorkbookLinkedRevision[]> => {
    if (id === undefined) return [];
    try {
      return (await getWorkbookLinkedRevisions(id)).current;
    } catch {
      return [];
    }
  }, [id]);
}

export { useLinkedRevisionsReader };
