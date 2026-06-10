import { JSX, ReactNode, useMemo, useState } from "react";
import { SYIcon } from "./syIcons";
import { Badge } from "./syShared";
import { type CommentView, type CcScore } from "./sySelectors";
import { type CapabilityCategory, type SyPersona } from "./syViewData";
import { useSyWorkbook } from "./syWorkbookContext";

interface InternalReviewProps {
  step: "review" | "approval";
  persona: SyPersona;
  cc: CapabilityCategory;
  scores: CcScore;
  comments: CommentView[];
  submitted: boolean;
  approved: boolean;
  actingUsername: string;
  onSubmitToApproval: () => void;
  onAction: (msg: string) => void;
  rosterSlot?: ReactNode;
  signCardSlot?: ReactNode;
  approvalTableSlot?: ReactNode;
}

function bannerVariant(openCount: number, submitted: boolean, approved: boolean): "in_review" | "ready" | "submitted" | "approved" {
  if (approved) return "approved";
  if (submitted) return "submitted";
  if (openCount === 0) return "ready";
  return "in_review";
}

function InternalReviewScreen({
  step, persona, cc, scores, comments, submitted, approved, actingUsername, onSubmitToApproval, onAction, rosterSlot, signCardSlot, approvalTableSlot,
}: InternalReviewProps): JSX.Element {
  const isApprovalStep = step === "approval";
  const isReviewStep = step === "review";
  const isPreparer = persona === "preparer";
  const [filter, setFilter] = useState<"all" | "open" | "resolved">("all");
  const { sy } = useSyWorkbook();
  const approver = sy.metadata.reviewers.find((r) => r.role === "INTERNAL_APPROVER") ?? null;
  const configSnapshotId = sy.configurationControlRecordId ?? "";
  const methodIds = sy.newlyDevelopedMethodIds ?? [];

  const reviewerIds = useMemo(() => sy.metadata.reviewers.filter((r) => r.role === "INTERNAL_REVIEWER").map((r) => r.id), [sy.metadata.reviewers]);
  const approverIds = useMemo(() => sy.metadata.reviewers.filter((r) => r.role === "INTERNAL_APPROVER").map((r) => r.id), [sy.metadata.reviewers]);

  const displayComments = useMemo<CommentView[]>(() => {
    let base: CommentView[];
    if (isApprovalStep) {
      if (persona === "reviewer" || persona === "approver") {
        base = comments.filter((c) => c.authorId === actingUsername);
      } else {
        base = comments.filter((c) => reviewerIds.includes(c.authorId) || approverIds.includes(c.authorId));
      }
    } else {
      base = [...comments].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }
    if (filter === "open") return base.filter((c) => !c.resolved);
    if (filter === "resolved") return base.filter((c) => c.resolved);
    return base;
  }, [comments, isApprovalStep, persona, actingUsername, reviewerIds, approverIds, filter]);

  const openCount = comments.filter((c) => !c.resolved).length;
  const resolvedCount = comments.filter((c) => c.resolved).length;
  const allResolved = openCount === 0 && comments.length > 0;
  const banner = bannerVariant(openCount, submitted, approved);

  const displayOpen = displayComments.filter((c) => !c.resolved).length;
  const displayResolved = displayComments.filter((c) => c.resolved).length;

  const grouped = useMemo<[string, CommentView[]][]>(() => {
    const m = new Map<string, CommentView[]>();
    for (const c of displayComments) {
      const list = m.get(c.section) ?? [];
      list.push(c);
      m.set(c.section, list);
    }
    return Array.from(m.entries());
  }, [displayComments]);

  return (
    <>
      <div className={`posrevbanner posrevbanner--${banner}`}>
        <div className="posrevbanner__icon"><SYIcon.Lock /></div>
        <div className="posrevbanner__main">
          <div className="posrevbanner__eyebrow">
            {approved ? "Approved" : submitted ? "Submitted to approver" : allResolved ? "All comments resolved" : "In review"}
          </div>
          <div className="posrevbanner__title">
            {approved && "Workbook approved · locked from edits"}
            {!approved && submitted && `Awaiting ${approver?.name ?? "approver"}'s signature`}
            {!submitted && !approved && allResolved && (isPreparer ? "Ready to submit for Internal Approval" : "Awaiting submission by preparer")}
            {!submitted && !approved && !allResolved && `${openCount} of ${comments.length} comments still open`}
          </div>
        </div>
        <div className="posrevbanner__counts">
          <span className="posrevbanner__count posrevbanner__count--ok">{resolvedCount} resolved</span>
          {openCount > 0 && <span className="posrevbanner__count posrevbanner__count--warn">{openCount} open</span>}
        </div>
      </div>

      {isReviewStep && rosterSlot}

      <div className="poscard">
        <div className="poscard__head">
          <h3 className="poscard__title">
            {isApprovalStep ? (isPreparer ? "Comments by reviewers & approvers" : "Your comments") : "All review comments"}
          </h3>
          <div className="posrow" style={{ gap: 6 }}>
            <button type="button" className={`poschip${filter === "all" ? " poschip--primary" : ""}`} onClick={() => setFilter("all")}>All ({displayComments.length})</button>
            <button type="button" className={`poschip${filter === "open" ? " poschip--primary" : ""}`} onClick={() => setFilter("open")}>Open ({displayOpen})</button>
            <button type="button" className={`poschip${filter === "resolved" ? " poschip--primary" : ""}`} onClick={() => setFilter("resolved")}>Resolved ({displayResolved})</button>
          </div>
        </div>
        {isReviewStep && <p className="poscard__sub">All comments from all roles, newest first.</p>}
        {displayComments.length === 0 ? (
          <p className="posmuted" style={{ margin: 0 }}>
            {isApprovalStep && (persona === "reviewer" || persona === "approver") ? "You have no comments." : "No comments yet. Reviewers and the approver leave comments from the dock."}
          </p>
        ) : (
          <div className="poscomments">
            {grouped.map(([section, list]) => (
              <div key={section} className="poscomments__group">
                <div className="poscomments__group-head">{section}</div>
                {list.map((c) => (
                  <div key={c.id} className={`poscomment poscomment--${c.severity.toLowerCase()} poscomment--${c.resolved ? "resolved" : "open"}`}>
                    <div className="poscomment__avatar">{c.authorInitials}</div>
                    <div className="poscomment__main">
                      <div className="poscomment__head">
                        <span className="poscomment__author">{c.authorName}</span>
                        {c.authorTitle !== undefined && <span className="poscomment__role">{c.authorTitle}</span>}
                        <span className="poscomment__when">· {c.when}</span>
                        <span className="poscomment__spacer" />
                        {c.severity === "MAJOR" && <span className="posbadge posbadge--block"><span className="posbadge__dot" />Major</span>}
                        {c.severity === "MINOR" && <span className="posbadge posbadge--warn"><span className="posbadge__dot" />Minor</span>}
                        {c.severity === "OBSERVATION" && <span className="posbadge"><span className="posbadge__dot" />Observation</span>}
                        {!c.resolved && <span className="posbadge posbadge--progress"><span className="posbadge__dot" />Open</span>}
                        {c.resolved && <span className="posbadge posbadge--ok"><span className="posbadge__dot" />Resolved</span>}
                      </div>
                      <div className="poscomment__target">
                        <span className="possubtle">Anchored to</span>{" "}
                        <span className="poschip">{c.associatedSr ?? "general"}</span>
                        <span className="poscomment__target-label"> · {c.targetLabel}</span>
                      </div>
                      <p className="poscomment__body">{c.text}</p>
                      {c.resolution !== undefined && <div className="poscomment__resolution"><strong>Resolved.</strong> {c.resolution}</div>}
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>

      {isPreparer && isReviewStep && sy.workflowState !== "INTERNAL_TECHNICAL_REVIEW" && sy.workflowState !== "INTERNAL_APPROVAL" && sy.workflowState !== "FINAL" && (
        <div className="poscard">
          <div className="poscard__head">
            <h3 className="poscard__title">Submit for Internal Approval</h3>
            {allResolved ? <Badge kind="ok">All comments resolved</Badge> : <Badge kind="warn">{openCount} open comment{openCount === 1 ? "" : "s"}</Badge>}
          </div>
          <p className="poscard__sub" style={{ marginBottom: 14 }}>
            The reviewer must mark every comment <strong>resolved</strong> before the workbook can advance to <strong>{approver?.name ?? "the approver"}</strong> for internal approval.
          </p>
          <div className="posrow" style={{ gap: 10, alignItems: "center" }}>
            <span className="poscomment__foot-spacer" />
            {submitted ? (
              <span className="posbadge posbadge--ok"><span className="posbadge__dot" />Submitted · awaiting approver</span>
            ) : (
              <button type="button" className="posnav__btn posnav__btn--primary" disabled={!allResolved} style={!allResolved ? { opacity: 0.5, cursor: "not-allowed" } : undefined} onClick={() => { if (allResolved) onSubmitToApproval(); }}>
                {allResolved ? <SYIcon.Send /> : <SYIcon.Lock />} Submit for Internal Approval
              </button>
            )}
          </div>
        </div>
      )}

      {isApprovalStep && (
        <>
          <div className="poscard">
            <div className="poscard__head"><h3 className="poscard__title">What is being attested</h3></div>
            <div className="posapprove__attest-with-sign">
              <div className="posapprove__attest-grid">
                <div className="posapprove__attest-row"><span className="posapprove__attest-cap">Capability target</span><span className="posapprove__attest-val"><strong>{cc.name}</strong> · {cc.tag}</span></div>
                <div className="posapprove__attest-row"><span className="posapprove__attest-cap">Items satisfied</span><span className="posapprove__attest-val posmono">{scores.met} of {scores.applicable}</span></div>
                <div className="posapprove__attest-row"><span className="posapprove__attest-cap">Review comments</span><span className="posapprove__attest-val posmono">{resolvedCount} of {comments.length} resolved</span></div>
                <div className="posapprove__attest-row">
                  <span className="posapprove__attest-cap">Configuration snapshot</span>
                  {configSnapshotId.length > 0 ? (
                    <button type="button" className="posapprove__attest-val poscclink" onClick={() => onAction("Configuration Control workbook — coming soon")}><SYIcon.Lock /> {configSnapshotId}</button>
                  ) : (
                    <span className="posapprove__attest-val possubtle">Not linked</span>
                  )}
                </div>
                <div className="posapprove__attest-row">
                  <span className="posapprove__attest-cap">Methods invoked</span>
                  {methodIds.length > 0 ? (
                    <div className="posrow posrow--wrap" style={{ gap: 6 }}>{methodIds.map((nmId) => <button key={nmId} type="button" className="poschip poschip--method" onClick={() => onAction(`${nmId} — Newly Developed Method workbook coming soon`)}><SYIcon.Bolt /> {nmId}</button>)}</div>
                  ) : (
                    <span className="posapprove__attest-val possubtle">None</span>
                  )}
                </div>
              </div>
              {signCardSlot != null && <div className="posapprove__sign-col">{signCardSlot}</div>}
            </div>
          </div>
          {approvalTableSlot}
        </>
      )}
    </>
  );
}

interface ReviewerDockProps {
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
  comments: CommentView[];
  onToggleResolved: (id: string) => void;
  onPostComment: (text: string, severity: "MAJOR" | "MINOR" | "OBSERVATION") => void;
  onRequestRevision: () => void;
  canRequestRevision: boolean;
  persona: SyPersona;
  openCount: number;
  resolvedCount: number;
}

function ReviewerCommentDock({ open, onToggle, onClose, comments, onToggleResolved, onPostComment, onRequestRevision, canRequestRevision, persona, openCount, resolvedCount }: ReviewerDockProps): JSX.Element {
  const [draft, setDraft] = useState("");
  const [draftSeverity, setDraftSeverity] = useState<"MAJOR" | "MINOR" | "OBSERVATION">("MINOR");
  const isReviewer = persona === "reviewer";
  return (
    <>
      <button type="button" className={`posrevdock-fab${open ? " posrevdock-fab--open" : ""}`} onClick={onToggle} aria-label="Reviewer comments">
        <SYIcon.History /><span className="posrevdock-fab__label">Comments</span><span className="posrevdock-fab__count">{openCount}</span>
      </button>
      {open && (
        <aside className="posrevdock" role="dialog" aria-label="Reviewer comment dock">
          <div className="posrevdock__head">
            <div><div className="posrevdock__eyebrow">Reviewer comments</div><div className="posrevdock__title">All comments ({comments.length})</div></div>
            <button type="button" className="posdrawer__close" onClick={onClose} aria-label="Close"><SYIcon.Close /></button>
          </div>
          <div className="posrevdock__summary">
            <span className="posrevdock__summary-chip posrevdock__summary-chip--warn">{openCount} open</span>
            <span className="posrevdock__summary-chip posrevdock__summary-chip--ok">{resolvedCount} resolved</span>
          </div>
          <div className="posrevdock__body">
            {comments.length === 0 ? (
              <p className="posrevdock__empty">No comments yet. Use the composer below to add one.</p>
            ) : comments.map((c) => (
              <div key={c.id} className={`posrevdock__item posrevdock__item--${c.resolved ? "resolved" : "open"}`}>
                <div className="posrevdock__item-head">
                  <span className="posrevdock__item-avatar">{c.authorInitials}</span>
                  <span className="posrevdock__item-author">{c.authorName}</span>
                  <span className="posrevdock__item-when">{c.when}</span>
                </div>
                <div className="posrevdock__item-target"><span className="poschip">{c.associatedSr ?? "general"}</span><span className="possubtle"> {c.targetLabel}</span></div>
                <p className="posrevdock__item-body">{c.text}</p>
                {c.resolution !== undefined && <div className="posrevdock__item-resolution">{c.resolution}</div>}
                <div className="posrevdock__item-foot">
                  {c.severity === "MAJOR" && <span className="posbadge posbadge--block"><span className="posbadge__dot" />Major</span>}
                  {c.severity === "MINOR" && <span className="posbadge posbadge--warn"><span className="posbadge__dot" />Minor</span>}
                  {c.severity === "OBSERVATION" && <span className="posbadge"><span className="posbadge__dot" />Observation</span>}
                  <span className="poscomment__foot-spacer" />
                  {isReviewer && (
                    <button type="button" className={`posnav__btn posnav__btn--sm${c.resolved ? "" : " posnav__btn--primary"}`} onClick={() => onToggleResolved(c.id)}>
                      {c.resolved ? <><SYIcon.Close /> Reopen</> : <><SYIcon.Check /> Mark resolved</>}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
          <div className="posrevdock__composer">
            <div className="posrevdock__composer-eyebrow">Add comment</div>
            <textarea className="posfield__textarea" placeholder="Anchor a finding, observation, or recommendation…" value={draft} onChange={(e) => setDraft(e.target.value)} rows={3} />
            <div className="posrevdock__composer-foot">
              <select className="posfield__select" value={draftSeverity} onChange={(e) => setDraftSeverity(e.target.value as "MAJOR" | "MINOR" | "OBSERVATION")} style={{ maxWidth: 140 }}>
                <option value="MAJOR">Major</option><option value="MINOR">Minor</option><option value="OBSERVATION">Observation</option>
              </select>
              <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" disabled={draft.trim() === ""} style={draft.trim() === "" ? { opacity: 0.5 } : undefined} onClick={() => { onPostComment(draft.trim(), draftSeverity); setDraft(""); }}>
                <SYIcon.Send /> Post comment
              </button>
            </div>
            {canRequestRevision && (
              <div style={{ marginTop: 8 }}>
                <button type="button" className="posnav__btn posnav__btn--sm" onClick={onRequestRevision}><SYIcon.Close /> Request revision (return to preparer)</button>
              </div>
            )}
          </div>
        </aside>
      )}
    </>
  );
}

export { InternalReviewScreen, ReviewerCommentDock };
