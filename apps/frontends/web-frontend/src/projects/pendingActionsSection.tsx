import { JSX } from "react";
import { useNavigate } from "react-router-dom";
import { useDemoIdentity, type DemoPersona } from "../demo/demoIdentity";
import "./css/pendingActionsSection.css";

// hardcoded — demo queue surface that simulates how a reviewer or approver
// would receive the POS workbook via a notification / inbox link rather than
// through their own project list.

interface PendingItem {
  workbookName: string;
  projectName: string;
  action: "REVIEW" | "APPROVE";
  fromName: string;
  when: string;
  route: string;
}

const QUEUE: Record<Exclude<DemoPersona, "preparer">, PendingItem[]> = {
  reviewer: [
    {
      workbookName: "POS Workbook 1",
      projectName: "Generic-1 Reactor — Pre-operational PRA",
      action: "REVIEW",
      fromName: "Aakash Patel",
      when: "2 days ago",
      route: "/pos-demo",
    },
  ],
  approver: [
    {
      workbookName: "POS Workbook 1",
      projectName: "Generic-1 Reactor — Pre-operational PRA",
      action: "APPROVE",
      fromName: "Aakash Patel",
      when: "earlier today",
      route: "/pos-demo",
    },
  ],
};

function PendingActionsSection(): JSX.Element | null {
  const { current } = useDemoIdentity();
  const navigate = useNavigate();
  if (current.persona === "preparer") return null;
  const items = QUEUE[current.persona];
  if (items.length === 0) return null;
  const eyebrow = current.persona === "reviewer" ? "Awaiting your review" : "Awaiting your approval";
  return (
    <section className={`pendact pendact--${current.persona}`} aria-label="Pending actions">
      <header className="pendact__head">
        <div>
          <div className="pendact__eyebrow">{eyebrow}</div>
          <h2 className="pendact__title">Workbooks routed to you</h2>
          <p className="pendact__sub">
            {current.persona === "reviewer"
              ? "View + comment only. You are independent of the authoring team — mark each comment resolved when its issue is addressed."
              : "View + comment + sign. Review the comment record, then sign and approve."}
          </p>
        </div>
      </header>
      <div className="pendact__grid">
        {items.map((it) => (
          <button
            key={`${it.workbookName}-${it.action}`}
            type="button"
            className="pendact__card"
            onClick={() => { navigate(it.route); }}
          >
            <div className="pendact__card-head">
              <span className={`pendact__action pendact__action--${current.persona}`}>
                {it.action === "REVIEW" ? "REVIEW REQUESTED" : "APPROVAL REQUESTED"}
              </span>
              <span className="pendact__when">{it.when}</span>
            </div>
            <div className="pendact__card-title">{it.workbookName}</div>
            <div className="pendact__card-project">{it.projectName}</div>
            <div className="pendact__card-foot">
              <span className="pendact__from">From {it.fromName}</span>
              <span className="pendact__open">Open workbook →</span>
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}

export { PendingActionsSection };
