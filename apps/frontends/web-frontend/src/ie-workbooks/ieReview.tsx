import { JSX, useEffect, useMemo, useState } from "react";
import { IEIcon } from "./ieIcons";
import { Badge, Stat } from "./ieShared";
import { type CommentView, type CcScore } from "./ieSelectors";
import { type CapabilityCategory, type IePersona } from "./ieViewData";
import { useIeWorkbook } from "./ieWorkbookContext";

interface InternalReviewProps {
  step: "review" | "approval";
  persona: IePersona;
  cc: CapabilityCategory;
  scores: CcScore;
  comments: CommentView[];
  submitted: boolean;
  approved: boolean;
  onSubmitToApproval: () => void;
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
  step, persona, cc, scores, comments, submitted, approved, onSubmitToApproval, onAction, rosterSlot, signCardSlot, approvalTableSlot,
}: InternalReviewProps): JSX.Element {
  const isApprovalStep = step === "approval";
  const isReviewStep = step === "review";
  const isApprover = persona === "approver";
  const isPreparer = persona === "preparer";
  const [filter, setFilter] = useState<"all" | "open" | "resolved">(isApprover ? "all" : "open");
  const openCount = comments.filter((c) => !c.resolved).length;
  const resolvedCount = comments.filter((c) => c.resolved).length;
  const allResolved = openCount === 0 && comments.length > 0;
  const major = comments.filter((c) => c.severity === "MAJOR" && !c.resolved).length;
  const banner = bannerVariant(openCount, submitted, approved);
  const { ie } = useIeWorkbook();
  const reviewerCount = ie.metadata.reviewers.filter((r) => r.role === "INTERNAL_REVIEWER").length;
  const approver = ie.metadata.reviewers.find((r) => r.role === "INTERNAL_APPROVER") ?? null;
  const configSnapshotId = ie.configurationControlRecordId ?? "";
  const methodIds = ie.newlyDevelopedMethodIds ?? [];

  const filtered = useMemo(() => {
    if (filter === "all") return comments;
    if (filter === "open") return comments.filter((c) => !c.resolved);
    return comments.filter((c) => c.resolved);
  }, [filter, comments]);

  const grouped = useMemo<[string, CommentView[]][]>(() => {
    const m = new Map<string, CommentView[]>();
    for (const c of filtered) {
      const list = m.get(c.section) ?? [];
      list.push(c);
      m.set(c.section, list);
    }
    return Array.from(m.entries());
  }, [filtered]);

  return (
    <>
      <div className={`posrevbanner posrevbanner--${banner}`}>
        <div className="posrevbanner__icon"><IEIcon.Lock /></div>
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

      <div className="posstats">
        <Stat num={comments.length} cap="Reviewer comments" sub={`${reviewerCount} reviewers`} />
        <Stat num={openCount} cap="Open" sub={openCount === 0 ? "All addressed" : `${major} major · ${openCount - major} other`} kind={openCount > 0 ? "warn" : "ok"} />
        <Stat num={resolvedCount} cap="Resolved" kind="ok" />
        <Stat num={major} cap="Major findings" sub={major > 0 ? "Blocking approval" : "None"} kind={major > 0 ? "block" : "ok"} />
      </div>

      {isReviewStep && rosterSlot}

      <div className="poscard">
        <div className="poscard__head">
          <h3 className="poscard__title">Review comments</h3>
          <div className="posrow" style={{ gap: 6 }}>
            <button type="button" className={`poschip${filter === "all" ? " poschip--primary" : ""}`} onClick={() => setFilter("all")}>All ({comments.length})</button>
            <button type="button" className={`poschip${filter === "open" ? " poschip--primary" : ""}`} onClick={() => setFilter("open")}>Open ({openCount})</button>
            <button type="button" className={`poschip${filter === "resolved" ? " poschip--primary" : ""}`} onClick={() => setFilter("resolved")}>Resolved ({resolvedCount})</button>
          </div>
        </div>
        <p className="poscard__sub">
          {isApprover
            ? "All comments are read-only here. The reviewer has marked them resolved before submission."
            : "Reply to each comment. Only the reviewer can mark a comment resolved. The workbook can be submitted for approval once they do."}
        </p>
        {comments.length === 0 ? (
          <p className="posmuted" style={{ margin: 0 }}>No comments yet. Reviewers and the approver leave comments from the dock.</p>
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

      {isReviewStep && signCardSlot}

      {isPreparer && isReviewStep && (
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
                {allResolved ? <IEIcon.Send /> : <IEIcon.Lock />} Submit for Internal Approval
              </button>
            )}
          </div>
        </div>
      )}

      {isApprovalStep && (
        <>
          <div className="poscard">
            <div className="poscard__head">
              <h3 className="poscard__title">What is being attested</h3>
              <Badge kind="progress">Target {cc.name}</Badge>
            </div>
            <div className="posapprove__attest-grid">
              <div className="posapprove__attest-row"><span className="posapprove__attest-cap">Capability target</span><span className="posapprove__attest-val"><strong>{cc.name}</strong> · {cc.tag}</span></div>
              <div className="posapprove__attest-row"><span className="posapprove__attest-cap">Items satisfied</span><span className="posapprove__attest-val posmono">{scores.met} of {scores.applicable}</span></div>
              <div className="posapprove__attest-row"><span className="posapprove__attest-cap">Review comments</span><span className="posapprove__attest-val posmono">{resolvedCount} of {comments.length} resolved</span></div>
              <div className="posapprove__attest-row">
                <span className="posapprove__attest-cap">Configuration snapshot</span>
                {configSnapshotId.length > 0 ? (
                  <button type="button" className="posapprove__attest-val poscclink" onClick={() => onAction("Configuration Control workbook — coming soon")}><IEIcon.Lock /> {configSnapshotId}</button>
                ) : (
                  <span className="posapprove__attest-val possubtle">Not linked</span>
                )}
              </div>
              <div className="posapprove__attest-row">
                <span className="posapprove__attest-cap">Methods invoked</span>
                {methodIds.length > 0 ? (
                  <div className="posrow posrow--wrap" style={{ gap: 6 }}>{methodIds.map((nmId) => <button key={nmId} type="button" className="poschip poschip--method" onClick={() => onAction(`${nmId} — Newly Developed Method workbook coming soon`)}><IEIcon.Bolt /> {nmId}</button>)}</div>
                ) : (
                  <span className="posapprove__attest-val possubtle">None</span>
                )}
              </div>
            </div>
          </div>

          {signCardSlot}

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
  persona: IePersona;
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
        <IEIcon.Mic /><span className="posrevdock-fab__label">Comments</span><span className="posrevdock-fab__count">{openCount}</span>
      </button>
      {open && (
        <aside className="posrevdock" role="dialog" aria-label="Reviewer comment dock">
          <div className="posrevdock__head">
            <div><div className="posrevdock__eyebrow">Reviewer comments</div><div className="posrevdock__title">All comments ({comments.length})</div></div>
            <button type="button" className="posdrawer__close" onClick={onClose} aria-label="Close"><IEIcon.Close /></button>
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
                      {c.resolved ? <><IEIcon.Close /> Reopen</> : <><IEIcon.Check /> Mark resolved</>}
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
                <IEIcon.Send /> Post comment
              </button>
            </div>
            {canRequestRevision && (
              <div style={{ marginTop: 8 }}>
                <button type="button" className="posnav__btn posnav__btn--sm" onClick={onRequestRevision}><IEIcon.Close /> Request revision (return to preparer)</button>
              </div>
            )}
          </div>
        </aside>
      )}
    </>
  );
}

export { InternalReviewScreen, ReviewerCommentDock };
