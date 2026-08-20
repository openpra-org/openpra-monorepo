import { type ReviewComment } from "interfaces-mef-types/core/pra-common";
import { type JSX, type ReactNode, useMemo, useState } from "react";
import { WorkbookSectionHeading } from "../../workbooks/workbookSectionHeading";
import { POSIcon } from "../../pos-workbooks/posIcons";
import { Badge } from "../../pos-workbooks/posShared";
import { type InternalFloodPraPersona } from "../internalFloodPraWorkbench";
import { useInternalFloodPraWorkbook } from "../internalFloodPraWorkbookContext";
import { type InternalFloodWorkflowActions } from "./draftScreen";

const REVIEW_SECTIONS: Record<string, string> = {
  FLPP: "Plant partitioning",
  FLSO: "Flood sources",
  FLSN: "Scenarios and screening",
  FLEV: "Initiating-event frequency",
  FLPR: "Plant response",
  FLHR: "Human reliability",
  FLESQ: "Quantification and uncertainty",
};

function sectionFor(comment: ReviewComment): string {
  const prefix = comment.associatedSr?.split("-")[0];
  return prefix === undefined ? "General review" : REVIEW_SECTIONS[prefix] ?? "Integrated analysis";
}

function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("");
}

function reviewDate(value: string): string {
  return new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

interface ReviewCommentsProps {
  comments: ReviewComment[];
  persona: InternalFloodPraPersona;
  actions?: InternalFloodWorkflowActions;
  approvalView?: boolean;
  title?: string;
  description?: string;
}

export function ReviewComments({
  comments,
  persona,
  actions,
  approvalView = false,
  title = "All review comments",
  description = "Review all technical comments from every assigned role, newest first, and track each one to resolution before approval.",
}: ReviewCommentsProps): JSX.Element {
  const { mef, mutate } = useInternalFloodPraWorkbook();
  const [filter, setFilter] = useState<"all" | "open" | "resolved">("all");
  const scoped = useMemo(() => {
    const newestFirst = (records: ReviewComment[]): ReviewComment[] => [...records].sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime());
    if (!approvalView || persona === "preparer") return newestFirst(comments);
    const role = persona === "approver" ? "INTERNAL_APPROVER" : "INTERNAL_REVIEWER";
    return newestFirst(comments.filter((comment) => comment.authorRole === role));
  }, [approvalView, comments, persona]);
  const visible = useMemo(() => scoped.filter((comment) => filter === "all" || (filter === "open" ? !comment.resolved : comment.resolved)), [filter, scoped]);
  const groups = useMemo(() => {
    const grouped = new Map<string, ReviewComment[]>();
    for (const comment of visible) grouped.set(sectionFor(comment), [...(grouped.get(sectionFor(comment)) ?? []), comment]);
    return [...grouped.entries()];
  }, [visible]);
  const open = scoped.filter((comment) => !comment.resolved).length;
  const resolved = scoped.length - open;

  function toggleResolved(comment: ReviewComment): void {
    const nextResolved = !comment.resolved;
    const operation = actions?.toggleResolve?.(comment.uuid, nextResolved);
    if (operation !== undefined) return;
    mutate((current) => {
      const nextComments = current.internalReviewComments.comments.map((entry) => {
        if (entry.uuid !== comment.uuid) return entry;
        if (nextResolved) {
          return {
            ...entry,
            resolved: true,
            resolution: entry.resolution ?? "The responsible analyst incorporated the review disposition and the comment author verified the revised flood-analysis record.",
            resolvedAt: new Date().toISOString(),
            resolvedBy: persona === "approver" ? "Internal Flood approver" : "Internal Flood technical reviewer",
          };
        }
        return { ...entry, resolved: false, resolution: undefined, resolvedAt: undefined, resolvedBy: undefined };
      });
      return {
        ...current,
        internalReviewComments: {
          comments: nextComments,
          openCount: nextComments.filter((entry) => !entry.resolved).length,
          resolvedCount: nextComments.filter((entry) => entry.resolved).length,
        },
      };
    });
  }

  return <div className="poscard">
    <div className="poscard__head">
      <WorkbookSectionHeading workbook="FLOOD" title={title} description={description} />
      <div className="posrow" style={{ gap: 6 }}>
        <button type="button" className={`poschip${filter === "all" ? " poschip--primary" : ""}`} onClick={() => setFilter("all")}>All ({scoped.length})</button>
        <button type="button" className={`poschip${filter === "open" ? " poschip--primary" : ""}`} onClick={() => setFilter("open")}>Open ({open})</button>
        <button type="button" className={`poschip${filter === "resolved" ? " poschip--primary" : ""}`} onClick={() => setFilter("resolved")}>Resolved ({resolved})</button>
      </div>
    </div>
    <div className="poscomments">
      {groups.length === 0 ? <p className="posmuted" style={{ margin: 0 }}>{approvalView && persona !== "preparer" ? "You have no comments." : "No comments yet."}</p> : groups.map(([section, records]) => <div key={section} className="poscomments__group">
        <div className="poscomments__group-head">{section}</div>
        {records.map((comment) => {
          const author = mef.metadata.reviewers.find((reviewer) => reviewer.id === comment.authorId);
          const severity = comment.severity ?? "OBSERVATION";
          const canToggle = (persona === "reviewer" && comment.authorRole === "INTERNAL_REVIEWER") || (persona === "approver" && comment.authorRole === "INTERNAL_APPROVER");
          return <div key={comment.uuid} className={`poscomment poscomment--${severity.toLowerCase()} poscomment--${comment.resolved ? "resolved" : "open"}`}>
            <div className="poscomment__avatar">{initials(author?.name ?? comment.authorId)}</div>
            <div className="poscomment__main">
              <div className="poscomment__head">
                <span className="poscomment__author">{author?.name ?? comment.authorId}</span>
                {author?.title !== undefined && <span className="poscomment__role">{author.title}</span>}
                <span className="poscomment__when">· {reviewDate(comment.createdAt)}</span>
                <span className="poscomment__spacer" />
                {severity === "MAJOR" && <span className="posbadge posbadge--block"><span className="posbadge__dot" />Major</span>}
                {severity === "MINOR" && <span className="posbadge posbadge--warn"><span className="posbadge__dot" />Minor</span>}
                {severity === "OBSERVATION" && <span className="posbadge"><span className="posbadge__dot" />Observation</span>}
                <span className={`posbadge ${comment.resolved ? "posbadge--ok" : "posbadge--progress"}`}><span className="posbadge__dot" />{comment.resolved ? "Resolved" : "Open"}</span>
              </div>
              <div className="poscomment__target"><span className="possubtle">Anchored to</span>{" "}<span className="poschip">{comment.associatedSr ?? "general"}</span>{comment.associatedField !== undefined && <span className="poscomment__target-label"> · {comment.associatedField}</span>}</div>
              <p className="poscomment__body">{comment.text}</p>
              {comment.resolution !== undefined && <div className="poscomment__resolution"><strong>Resolved.</strong> {comment.resolution}</div>}
              <div className="poscomment__foot">
                <span className="poscomment__foot-spacer" />
                {persona === "preparer" && !comment.resolved && <span className="poscomment__lockhint"><POSIcon.Lock /> Author marks resolved</span>}
                {persona === "preparer" && comment.resolved && <span className="poscomment__lockhint poscomment__lockhint--ok"><POSIcon.Check /> Resolved</span>}
                {canToggle && <button type="button" className={`posnav__btn posnav__btn--sm${comment.resolved ? "" : " posnav__btn--primary"}`} onClick={() => toggleResolved(comment)}>{comment.resolved ? <><POSIcon.Close /> Reopen</> : <><POSIcon.Check /> Mark resolved</>}</button>}
              </div>
            </div>
          </div>;
        })}
      </div>)}
    </div>
  </div>;
}

export function ReviewBanner(): JSX.Element {
  const { mef } = useInternalFloodPraWorkbook();
  const comments = mef.internalReviewComments.comments;
  const open = comments.filter((comment) => !comment.resolved).length;
  const resolved = comments.length - open;
  const submitted = mef.workflowState === "INTERNAL_APPROVAL" || mef.workflowState === "FINAL";
  const approved = mef.workflowState === "FINAL";
  const allResolved = comments.length > 0 && open === 0;
  const variant = approved ? "approved" : submitted ? "submitted" : allResolved ? "ready" : "in_review";
  return <div className={`posrevbanner posrevbanner--${variant}`}>
    <div className="posrevbanner__icon"><POSIcon.Lock /></div>
    <div className="posrevbanner__main">
      <div className="posrevbanner__eyebrow">{approved ? "Approved" : submitted ? "Submitted to approver" : allResolved ? "All comments resolved" : "In review"}</div>
      <div className="posrevbanner__title">{approved ? "Workbook approved · locked from edits" : submitted ? "Awaiting the assigned approver's signature" : allResolved ? "Ready to submit for Internal Approval" : `${String(open)} of ${String(comments.length)} comments still open`}</div>
    </div>
    <div className="posrevbanner__counts"><span className="posrevbanner__count posrevbanner__count--ok">{resolved} resolved</span>{open > 0 && <span className="posrevbanner__count posrevbanner__count--warn">{open} open</span>}</div>
  </div>;
}

export function ReviewScreen({ persona, actions, renderRoster }: { persona: InternalFloodPraPersona; actions?: InternalFloodWorkflowActions; renderRoster?: () => ReactNode }): JSX.Element {
  const { mef, mutate } = useInternalFloodPraWorkbook();
  const [busy, setBusy] = useState(false);
  const [pinged, setPinged] = useState(false);
  const comments = mef.internalReviewComments.comments;
  const open = comments.filter((comment) => !comment.resolved).length;
  const allResolved = comments.length > 0 && open === 0;
  const submitted = mef.workflowState === "INTERNAL_APPROVAL" || mef.workflowState === "FINAL";

  function submit(): void {
    setBusy(true);
    const operation = actions?.submitForApproval?.();
    if (operation !== undefined) operation.finally(() => setBusy(false));
    else {
      mutate((current) => ({
        ...current,
        workflowState: "INTERNAL_APPROVAL",
        workflowHistory: [...current.workflowHistory, { state: "INTERNAL_APPROVAL", enteredAt: new Date().toISOString(), actor: current.owner ?? "Internal Flood PRA Team" }],
      }));
      setBusy(false);
    }
  }

  return <>
    <ReviewBanner />
    {renderRoster?.()}
    <ReviewComments comments={comments} persona={persona} actions={actions} />
    {persona === "preparer" && <div className="poscard">
      <div className="poscard__head">
        <WorkbookSectionHeading workbook="FLOOD" title="Submit for Internal Approval" description="Advance the reviewed workbook to the assigned approver only after every technical comment has been resolved." />
        {allResolved ? <Badge kind="ok">All comments resolved</Badge> : <Badge kind="warn">{open} open comment{open === 1 ? "" : "s"}</Badge>}
      </div>
      <div className="posrow" style={{ gap: 10, alignItems: "center" }}>
        <button type="button" className="posnav__btn" onClick={() => setPinged(true)}><POSIcon.Send /> {pinged ? "Reviewers notified" : "Ping reviewers"}</button>
        <span className="poscomment__foot-spacer" />
        {submitted ? <span className="posbadge posbadge--ok"><span className="posbadge__dot" />Submitted · awaiting approver</span> : <button type="button" className="posnav__btn posnav__btn--primary" disabled={!allResolved || busy} onClick={submit}>{allResolved ? <POSIcon.Send /> : <POSIcon.Lock />} {busy ? "Submitting…" : "Submit for Internal Approval"}</button>}
      </div>
      {!allResolved && <p className="posapprove__signhint" style={{ marginTop: 10 }}><POSIcon.Lock /> Submission is gated by the reviewer marking every comment resolved.</p>}
    </div>}
  </>;
}
