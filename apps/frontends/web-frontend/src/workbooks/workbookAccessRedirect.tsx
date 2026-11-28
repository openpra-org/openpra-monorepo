import { type JSX, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useToast } from "../toast/toastProvider";
import { NO_WORKBOOK_ROLE_MESSAGE } from "./workbookAccess";

function WorkbookAccessRedirect({ projectId }: { projectId: string | null }): JSX.Element {
  const navigate = useNavigate();
  const { addToast } = useToast();
  const sent = useRef(false);

  useEffect(() => {
    if (sent.current) return;
    sent.current = true;
    addToast({ id: crypto.randomUUID(), type: "info", message: NO_WORKBOOK_ROLE_MESSAGE });
    navigate(projectId === null ? "/projects" : `/projects/${projectId}`, { replace: true });
  }, [addToast, navigate, projectId]);

  return <div className="posw"><main className="posmain" /></div>;
}

export { WorkbookAccessRedirect };
