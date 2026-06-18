import { JSX, useMemo, useState } from "react";
import { POSIcon } from "./posIcons";
import { Badge } from "./posShared";
import {
  internalApproverView,
  nmViewById,
  type CommentView,
} from "./posSelectors";
import { type CapabilityCategory, type CcScore } from "./posViewData";
import { type PosPersona } from "./posViewData";
import { usePosWorkbook } from "./posWorkbookContext";

interface InternalReviewProps {
  step: "review" | "approval";
  persona: PosPersona;
  cc: CapabilityCategory;
  scores: CcScore;
  comments: CommentView[];
  submitted: boolean;
  approved: boolean;
  actingUsername: string;
  onToggleResolved: (commentId: string) => void;
  onSubmitToApproval: () => void;
  onSign: () => void;
  onAction: (msg: string) => void;
  rosterSlot?: import("react").ReactNode;
  signCardSlot?: import("react").ReactNode;
  approvalTableSlot?: import("react").ReactNode;
}

function bannerVariant(openCount: number, submitted: boolean, approved: boolean): "in_review" | "ready" | "submitted" | "approved" {
  if (approved) return "approved";
  if (submitted) return "submitted";
  if (openCount === 0) return "ready";
  return "in_review";
}

function InternalReviewScreen({
  step, persona, cc, scores, comments, submitted, approved, actingUsername,
  onToggleResolved, onSubmitToApproval, onAction, rosterSlot, signCardSlot, approvalTableSlot,
}: InternalReviewProps): JSX.Element {
  const isApprovalStep = step === "approval";
  const isReviewStep = step === "review";
  const isApprover = persona === "approver";
  const isPreparer = persona === "preparer";
  const [filter, setFilter] = useState<"all" | "open" | "resolved">("all");
  const { pos } = usePosWorkbook();
  const approver = internalApproverView(pos);
  const configSnapshotId = pos.configurationControlRecordId ?? "";

  const reviewerIds = useMemo(() => pos.metadata.reviewers.filter((r) => r.role === "INTERNAL_REVIEWER").map((r) => r.id), [pos.metadata.reviewers]);
  const approverIds = useMemo(() => pos.metadata.reviewers.filter((r) => r.role === "INTERNAL_APPROVER").map((r) => r.id), [pos.metadata.reviewers]);

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
        <div className="posrevbanner__icon"><POSIcon.Lock /></div>
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
            {isApprovalStep
              ? (isPreparer ? "Comments by reviewers & approvers" : "Your comments")
              : "All review comments"}
          </h3>
          <div className="posrow" style={{ gap: 6 }}>
            <button type="button" className={`poschip${filter === "all" ? " poschip--primary" : ""}`} onClick={() => setFilter("all")}>All ({displayComments.length})</button>
            <button type="button" className={`poschip${filter === "open" ? " poschip--primary" : ""}`} onClick={() => setFilter("open")}>Open ({displayOpen})</button>
            <button type="button" className={`poschip${filter === "resolved" ? " poschip--primary" : ""}`} onClick={() => setFilter("resolved")}>Resolved ({displayResolved})</button>
          </div>
        </div>
        {isReviewStep && (
          <p className="poscard__sub">All comments from all roles, newest first.</p>
        )}
        <div className="poscomments">
          {grouped.length === 0 ? (
            <p className="posmuted" style={{ margin: 0 }}>
              {isApprovalStep && (persona === "reviewer" || persona === "approver") ? "You have no comments." : "No comments yet."}
            </p>
          ) : grouped.map(([section, list]) => (
            <div key={section} className="poscomments__group">
              <div className="poscomments__group-head">{section}</div>
              {list.map((c) => (
                <CommentCard
                  key={c.id}
                  comment={c}
                  persona={persona}
                  actingUsername={actingUsername}
                  step={step}
                  onAction={onAction}
                  onToggleResolved={onToggleResolved}
                />
              ))}
            </div>
          ))}
        </div>
      </div>

      {isPreparer && isReviewStep && pos.workflowState !== "INTERNAL_TECHNICAL_REVIEW" && pos.workflowState !== "INTERNAL_APPROVAL" && pos.workflowState !== "FINAL" && (
        <div className="poscard">
          <div className="poscard__head">
            <h3 className="poscard__title">Submit for Internal Approval</h3>
            {allResolved
              ? <Badge kind="ok">All comments resolved</Badge>
              : <Badge kind="warn">{openCount} open comment{openCount === 1 ? "" : "s"}</Badge>}
          </div>
          <p className="poscard__sub" style={{ marginBottom: 14 }}>
            The reviewer must mark every comment <strong>resolved</strong> before the workbook can advance to <strong>{approver?.name ?? "the approver"}</strong> for internal approval.
          </p>
          <div className="posrow" style={{ gap: 10, alignItems: "center" }}>
            <button type="button" className="posnav__btn" onClick={() => onAction("Ping sent to reviewers")}>
              <POSIcon.Send /> Ping reviewers
            </button>
            <span className="poscomment__foot-spacer" />
            {submitted ? (
              <span className="posbadge posbadge--ok"><span className="posbadge__dot" />Submitted · awaiting approver</span>
            ) : (
              <button
                type="button"
                className="posnav__btn posnav__btn--primary"
                disabled={!allResolved}
                style={!allResolved ? { opacity: 0.5, cursor: "not-allowed" } : undefined}
                onClick={() => { if (allResolved) onSubmitToApproval(); }}
              >
                {allResolved ? <POSIcon.Send /> : <POSIcon.Lock />} Submit for Internal Approval
              </button>
            )}
          </div>
          {!allResolved && (
            <p className="posapprove__signhint" style={{ marginTop: 10 }}>
              <POSIcon.Lock /> Submission is gated by the reviewer marking comments resolved.
            </p>
          )}
        </div>
      )}

      {isApprovalStep && (
        <>
          <div className="poscard">
            <div className="poscard__head">
              <h3 className="poscard__title">What is being attested</h3>
            </div>
            <div className="posapprove__attest-with-sign">
              <div className="posapprove__attest-grid">
                <div className="posapprove__attest-row">
                  <span className="posapprove__attest-cap">Capability target</span>
                  <span className="posapprove__attest-val"><strong>{cc.name}</strong> · {cc.tag}</span>
                </div>
                <div className="posapprove__attest-row">
                  <span className="posapprove__attest-cap">Items satisfied</span>
                  <span className="posapprove__attest-val posmono">{scores.met} of {scores.applicable}</span>
                </div>
                <div className="posapprove__attest-row">
                  <span className="posapprove__attest-cap">Review comments</span>
                  <span className="posapprove__attest-val posmono">{resolvedCount} of {comments.length} resolved</span>
                </div>
                <div className="posapprove__attest-row">
                  <span className="posapprove__attest-cap">Configuration snapshot</span>
                  {configSnapshotId.length > 0 ? (
                    <button type="button" className="posapprove__attest-val poscclink" onClick={() => onAction("Configuration Control workbook — coming soon")}>
                      <POSIcon.Lock /> {configSnapshotId}
                    </button>
                  ) : (
                    <span className="posapprove__attest-val possubtle">Not linked</span>
                  )}
                </div>
              </div>
              {signCardSlot != null && (
                <div className="posapprove__sign-col">
                  {signCardSlot}
                </div>
              )}
            </div>
          </div>

          {approvalTableSlot}

          {approved && (
            <div className="poscard posapprove__handoff">
              <div className="poscard__head">
                <h3 className="poscard__title">After approval — external workflows</h3>
                <Badge kind="draft">View + comment only</Badge>
              </div>
              <p className="poscard__sub">
                External reviewers and auditors pick this workbook up from <strong>Ready for review</strong> on the project page. They cannot edit the artifact — they can only comment.
              </p>
              <div className="posapprove__handoff-grid">
                <button type="button" className="posapprove__handoff-card" onClick={() => onAction("Peer Review workflow — coming soon")}>
                  <div className="posapprove__handoff-card-head">
                    <div className="posapprove__handoff-card-icon"><POSIcon.Eye /></div>
                    <div>
                      <div className="posapprove__handoff-card-eyebrow">External · Section 6</div>
                      <div className="posapprove__handoff-card-title">Peer Review</div>
                    </div>
                  </div>
                  <div className="posapprove__handoff-card-foot"><span>Release to peer review</span><POSIcon.ArrowR /></div>
                </button>
                <button type="button" className="posapprove__handoff-card" onClick={() => onAction("Audit workflow — coming soon")}>
                  <div className="posapprove__handoff-card-head">
                    <div className="posapprove__handoff-card-icon"><POSIcon.Lock /></div>
                    <div>
                      <div className="posapprove__handoff-card-eyebrow">External · NQA-1 aligned</div>
                      <div className="posapprove__handoff-card-title">Audit</div>
                    </div>
                  </div>
                  <div className="posapprove__handoff-card-foot"><span>Release to audit</span><POSIcon.ArrowR /></div>
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </>
  );
}

function CommentCard({
  comment, persona, actingUsername, step, onAction, onToggleResolved,
}: {
  comment: CommentView;
  persona: PosPersona;
  actingUsername: string;
  step: "review" | "approval";
  onAction: (msg: string) => void;
  onToggleResolved: (id: string) => void;
}): JSX.Element {
  const { nms: nmInstances } = usePosWorkbook();
  const isApprover = persona === "approver";
  const isPreparer = persona === "preparer";
  const isMyComment = comment.authorId === actingUsername;
  const sevClass = comment.severity.toLowerCase();
  const statusClass = comment.resolved ? "resolved" : "open";
  return (
    <div className={`poscomment poscomment--${sevClass} poscomment--${statusClass}`}>
      <div className="poscomment__avatar">{comment.authorInitials}</div>
      <div className="poscomment__main">
        <div className="poscomment__head">
          <span className="poscomment__author">{comment.authorName}</span>
          {comment.authorTitle !== undefined && <span className="poscomment__role">{comment.authorTitle}</span>}
          <span className="poscomment__when">· {comment.when}</span>
          <span className="poscomment__spacer" />
          {comment.severity === "MAJOR" && <span className="posbadge posbadge--block"><span className="posbadge__dot" />Major</span>}
          {comment.severity === "MINOR" && <span className="posbadge posbadge--warn"><span className="posbadge__dot" />Minor</span>}
          {comment.severity === "OBSERVATION" && <span className="posbadge"><span className="posbadge__dot" />Observation</span>}
          {!comment.resolved && <span className="posbadge posbadge--progress"><span className="posbadge__dot" />Open</span>}
          {comment.resolved && <span className="posbadge posbadge--ok"><span className="posbadge__dot" />Resolved</span>}
        </div>
        <div className="poscomment__target">
          <span className="possubtle">Anchored to</span>{" "}
          <span className="poschip">{comment.associatedSr ?? "general"}</span>
          <span className="poscomment__target-label"> · {comment.targetLabel}</span>
        </div>
        <p className="poscomment__body">{comment.text}</p>
        {comment.resolution !== undefined && (
          <div className="poscomment__resolution"><strong>Resolved.</strong> {comment.resolution}</div>
        )}
        <div className="poscomment__foot">
          {comment.linkedNM !== undefined && (
            <button
              type="button"
              className="poschip poschip--method"
              onClick={() => {
                const view = nmViewById(nmInstances, comment.linkedNM!);
                onAction(`${view?.id ?? comment.linkedNM} — Newly Developed Method workbook coming soon`);
              }}
            >
              <POSIcon.Bolt /> {comment.linkedNM}
            </button>
          )}
          <span className="poscomment__foot-spacer" />
          {isPreparer && step === "review" && !comment.resolved && (
            <>
              <button type="button" className="posnav__btn posnav__btn--sm" onClick={() => onAction("Reply composer opened")}>
                <POSIcon.Sparkle /> Reply
              </button>
              <span className="poscomment__lockhint"><POSIcon.Lock /> Author marks resolved</span>
            </>
          )}
          {isPreparer && step === "review" && comment.resolved && (
            <span className="poscomment__lockhint poscomment__lockhint--ok"><POSIcon.Check /> Resolved</span>
          )}
          {isMyComment && !isPreparer && (
            <button
              type="button"
              className={`posnav__btn posnav__btn--sm${comment.resolved ? "" : " posnav__btn--primary"}`}
              onClick={() => onToggleResolved(comment.id)}
            >
              {comment.resolved ? <><POSIcon.Close /> Reopen</> : <><POSIcon.Check /> Mark resolved</>}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

const STEP_SECTION: Record<string, string[]> = {
  setup: ["Documentation"],
  documents: ["Documentation"],
  evolutions: ["Plant evolutions"],
  states: ["Operating states"],
  interviews: ["Interviews & walkdowns"],
  screening: ["Screening & grouping"],
  grouping: ["Screening & grouping"],
  frequency: ["Frequencies & duration"],
  decayheat: ["Frequencies & duration"],
};

interface ReviewerDockProps {
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
  stepId: string;
  comments: CommentView[];
  onToggleResolved: (id: string) => void;
  onPostComment: (text: string, severity: "MAJOR" | "MINOR" | "OBSERVATION") => void;
  onRequestRevision: () => void;
  canRequestRevision: boolean;
  onSignReview?: () => void;
  canSignReview: boolean;
  onAction: (msg: string) => void;
}

function ReviewerCommentDock({ open, onToggle, onClose, stepId, comments, onToggleResolved, onPostComment, onRequestRevision, canRequestRevision, onAction }: ReviewerDockProps): JSX.Element {
  const scopeSections = STEP_SECTION[stepId] ?? [];
  const onThisStep = comments.filter((c) => scopeSections.includes(c.section));
  const stepOpenCount = onThisStep.filter((c) => !c.resolved).length;
  const [draft, setDraft] = useState("");
  const [draftSeverity, setDraftSeverity] = useState<"MAJOR" | "MINOR" | "OBSERVATION">("MINOR");
  return (
    <>
      <button
        type="button"
        className={`posrevdock-fab${open ? " posrevdock-fab--open" : ""}`}
        onClick={onToggle}
        aria-label="Reviewer comments"
      >
        <POSIcon.Mic />
        <span className="posrevdock-fab__label">Comments</span>
        <span className="posrevdock-fab__count">{stepOpenCount}</span>
      </button>
      {open && (
        <aside className="posrevdock" role="dialog" aria-label="Reviewer comment dock">
          <div className="posrevdock__head">
            <div>
              <div className="posrevdock__eyebrow">Reviewer comments</div>
              <div className="posrevdock__title">On this step ({onThisStep.length})</div>
            </div>
            <button type="button" className="posdrawer__close" onClick={onClose} aria-label="Close"><POSIcon.Close /></button>
          </div>
          <div className="posrevdock__body">
            {onThisStep.length === 0 ? (
              <p className="posrevdock__empty">No comments anchored to this step yet. Use the composer below to add one.</p>
            ) : onThisStep.map((c) => (
              <div key={c.id} className={`posrevdock__item posrevdock__item--${c.resolved ? "resolved" : "open"}`}>
                <div className="posrevdock__item-head">
                  <span className="posrevdock__item-avatar">{c.authorInitials}</span>
                  <span className="posrevdock__item-author">{c.authorName}</span>
                  <span className="posrevdock__item-when">{c.when}</span>
                </div>
                <div className="posrevdock__item-target">
                  <span className="poschip">{c.associatedSr ?? "general"}</span>
                  <span className="possubtle"> {c.targetLabel}</span>
                </div>
                <p className="posrevdock__item-body">{c.text}</p>
                {c.resolution !== undefined && <div className="posrevdock__item-resolution">{c.resolution}</div>}
                <div className="posrevdock__item-foot">
                  {c.severity === "MAJOR" && <span className="posbadge posbadge--block"><span className="posbadge__dot" />Major</span>}
                  {c.severity === "MINOR" && <span className="posbadge posbadge--warn"><span className="posbadge__dot" />Minor</span>}
                  {c.severity === "OBSERVATION" && <span className="posbadge"><span className="posbadge__dot" />Observation</span>}
                  <span className="poscomment__foot-spacer" />
                  <button
                    type="button"
                    className={`posnav__btn posnav__btn--sm${c.resolved ? "" : " posnav__btn--primary"}`}
                    onClick={() => onToggleResolved(c.id)}
                  >
                    {c.resolved ? <><POSIcon.Close /> Reopen</> : <><POSIcon.Check /> Mark resolved</>}
                  </button>
                </div>
              </div>
            ))}
          </div>
          <div className="posrevdock__composer">
            <div className="posrevdock__composer-eyebrow">Add comment to this step</div>
            <textarea
              className="posfield__textarea"
              placeholder="Anchor a finding, observation, or recommendation to this step…"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={3}
            />
            <div className="posrevdock__composer-foot">
              <select
                className="posfield__select"
                value={draftSeverity}
                onChange={(e) => setDraftSeverity(e.target.value as "MAJOR" | "MINOR" | "OBSERVATION")}
                style={{ maxWidth: 140 }}
              >
                <option value="MAJOR">Major</option>
                <option value="MINOR">Minor</option>
                <option value="OBSERVATION">Observation</option>
              </select>
              <button
                type="button"
                className="posnav__btn posnav__btn--sm posnav__btn--primary"
                disabled={draft.trim() === ""}
                style={draft.trim() === "" ? { opacity: 0.5 } : undefined}
                onClick={() => { onPostComment(draft.trim(), draftSeverity); setDraft(""); }}
              >
                <POSIcon.Send /> Post comment
              </button>
            </div>
            <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" }}>
              {canRequestRevision && (
                <button
                  type="button"
                  className="posnav__btn posnav__btn--sm"
                  onClick={onRequestRevision}
                >
                  <POSIcon.Close /> Request revision (return to preparer)
                </button>
              )}
            </div>
          </div>
        </aside>
      )}
    </>
  );
}

export { InternalReviewScreen, ReviewerCommentDock };
