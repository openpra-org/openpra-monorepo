import { JSX, useMemo, useState } from "react";
import { POSIcon } from "./posIcons";
import { Badge, Stat } from "./posShared";
import {
  ccSnapshotView,
  internalApproverView,
  internalReviewersView,
  nmViewById,
  nmViews,
  type CommentView,
  type ReviewerView,
} from "./posSelectors";
import { type CapabilityCategory, type CcScore } from "./posViewData";
import { type PosPersona } from "./posViewData";

interface InternalReviewProps {
  persona: PosPersona;
  cc: CapabilityCategory;
  scores: CcScore;
  comments: CommentView[];
  submitted: boolean;
  approved: boolean;
  onToggleResolved: (commentId: string) => void;
  onSubmitToApproval: () => void;
  onSign: () => void;
  onAction: (msg: string) => void;
}

function bannerVariant(openCount: number, submitted: boolean, approved: boolean): "in_review" | "ready" | "submitted" | "approved" {
  if (approved) return "approved";
  if (submitted) return "submitted";
  if (openCount === 0) return "ready";
  return "in_review";
}

function InternalReviewScreen({
  persona, cc, scores, comments, submitted, approved,
  onToggleResolved, onSubmitToApproval, onSign, onAction,
}: InternalReviewProps): JSX.Element {
  const isApprover = persona === "approver";
  const isPreparer = persona === "preparer";
  const [filter, setFilter] = useState<"all" | "open" | "resolved">(isApprover ? "all" : "open");
  const openCount = comments.filter((c) => !c.resolved).length;
  const resolvedCount = comments.filter((c) => c.resolved).length;
  const allResolved = openCount === 0 && comments.length > 0;
  const major = comments.filter((c) => c.severity === "MAJOR" && !c.resolved).length;
  const banner = bannerVariant(openCount, submitted, approved);
  const canApprove = isApprover && allResolved && scores.blocked === 0;
  const reviewers = internalReviewersView();
  const approver = internalApproverView();
  const snapshot = ccSnapshotView();
  const nms = nmViews();

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

      <div className="posstats">
        <Stat num={comments.length} cap="Reviewer comments" sub={`${reviewers.length} reviewers`} />
        <Stat num={openCount} cap="Open" sub={openCount === 0 ? "All addressed" : `${major} major · ${openCount - major} other`} kind={openCount > 0 ? "warn" : "ok"} />
        <Stat num={resolvedCount} cap="Resolved" kind="ok" />
        <Stat num={major} cap="Major findings" sub={major > 0 ? "Blocking approval" : "None"} kind={major > 0 ? "block" : "ok"} />
      </div>

      <div className="poscard">
        <div className="poscard__head">
          <h3 className="poscard__title">Reviewers</h3>
          <span className="possubtle">Independent of authoring team · internal to {approver?.organization ?? "the organisation"}</span>
        </div>
        <div className="posreviewers">
          {reviewers.map((r) => <ReviewerRow key={r.id} reviewer={r} />)}
        </div>
      </div>

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
            : "Reply to each comment. Only the reviewer can mark a comment resolved — the workbook can be submitted for approval once they do."}
        </p>
        <div className="poscomments">
          {grouped.map(([section, list]) => (
            <div key={section} className="poscomments__group">
              <div className="poscomments__group-head">{section}</div>
              {list.map((c) => (
                <CommentCard key={c.id} comment={c} persona={persona} onAction={onAction} onToggleResolved={onToggleResolved} />
              ))}
            </div>
          ))}
        </div>
      </div>

      {isPreparer && (
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
              <POSIcon.Lock /> Submission is gated by the reviewer marking comments resolved — not by you.
            </p>
          )}
        </div>
      )}

      {isApprover && approver !== null && (
        <>
          <div className="posapprove__attest">
            <div className="poscard">
              <div className="poscard__head">
                <h3 className="poscard__title">What is being attested</h3>
                <Badge kind="progress">Target {cc.name}</Badge>
              </div>
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
                  <button type="button" className="posapprove__attest-val poscclink" onClick={() => onAction("Configuration Control workbook — coming soon")}>
                    <POSIcon.Lock /> {snapshot.id}
                    <span className="possubtle"> · {snapshot.label}</span>
                  </button>
                </div>
                <div className="posapprove__attest-row">
                  <span className="posapprove__attest-cap">Methods invoked</span>
                  <div className="posrow posrow--wrap" style={{ gap: 6 }}>
                    {nms.map((n) => (
                      <button key={n.id} type="button" className="poschip poschip--method" onClick={() => onAction(`${n.id} — Newly Developed Method workbook coming soon`)}>
                        <POSIcon.Bolt /> {n.id}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="poscard">
              <div className="poscard__head">
                <h3 className="poscard__title">Sign &amp; approve</h3>
                {approved
                  ? <Badge kind="ok">Signed</Badge>
                  : canApprove ? <Badge kind="progress">Awaiting signature</Badge> : <Badge kind="warn">Signature withheld</Badge>}
              </div>
              <div className="posapprove__signer">
                <div className="posapprove__signer-avatar">{approver.initials}</div>
                <div className="posapprove__signer-main">
                  <div className="posapprove__signer-name">{approver.name}</div>
                  <div className="posapprove__signer-role">{approver.title} · {approver.organization}</div>
                  {approver.qualification !== undefined && (
                    <div className="posapprove__signer-qual"><POSIcon.Lock /> {approver.qualification}</div>
                  )}
                </div>
              </div>
              <div className="posapprove__sigblock">
                <div className="posapprove__sigblock-line">
                  {approved && <span className="posapprove__sigblock-sig">{approver.name}</span>}
                </div>
                <div className="posapprove__sigblock-cap">
                  {approved ? "Signed today · stamped at the configuration freeze" : "Signature · today's date will be stamped on click"}
                </div>
              </div>
              <button
                type="button"
                className="posnav__btn posnav__btn--primary posapprove__signbtn"
                disabled={!canApprove || approved}
                style={(!canApprove || approved) ? { opacity: 0.5, cursor: "not-allowed" } : undefined}
                onClick={() => { if (canApprove && !approved) onSign(); }}
              >
                <POSIcon.Check /> {approved ? "Approved" : "Sign & approve workbook"}
              </button>
              {!canApprove && !approved && (
                <p className="posapprove__signhint">
                  Signature is unlocked once the reviewer has marked every comment resolved.
                </p>
              )}
            </div>
          </div>

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

function ReviewerRow({ reviewer }: { reviewer: ReviewerView }): JSX.Element {
  return (
    <div className="posreviewer">
      <span className="posreviewer__avatar">{reviewer.initials}</span>
      <div>
        <div className="posreviewer__name">{reviewer.name}</div>
        <div className="posreviewer__role">{reviewer.title ?? "Reviewer"}</div>
      </div>
    </div>
  );
}

function CommentCard({
  comment, persona, onAction, onToggleResolved,
}: {
  comment: CommentView;
  persona: PosPersona;
  onAction: (msg: string) => void;
  onToggleResolved: (id: string) => void;
}): JSX.Element {
  const isApprover = persona === "approver";
  const isPreparer = persona === "preparer";
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
                const view = nmViewById(comment.linkedNM!);
                onAction(`${view?.id ?? comment.linkedNM} — Newly Developed Method workbook coming soon`);
              }}
            >
              <POSIcon.Bolt /> {comment.linkedNM}
            </button>
          )}
          <span className="poscomment__foot-spacer" />
          {isPreparer && !comment.resolved && (
            <>
              <button type="button" className="posnav__btn posnav__btn--sm" onClick={() => onAction("Reply composer opened")}>
                <POSIcon.Sparkle /> Reply
              </button>
              <span className="poscomment__lockhint"><POSIcon.Lock /> Reviewer marks resolved</span>
            </>
          )}
          {isPreparer && comment.resolved && (
            <span className="poscomment__lockhint poscomment__lockhint--ok"><POSIcon.Check /> Closed by reviewer</span>
          )}
          {isApprover && (
            <button type="button" className="posnav__btn posnav__btn--sm" onClick={() => onAction("Approver remark composer opened")}>
              Leave remark
            </button>
          )}
          {persona === "reviewer" && (
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
  onAction: (msg: string) => void;
}

function ReviewerCommentDock({ open, onToggle, onClose, stepId, comments, onToggleResolved, onAction }: ReviewerDockProps): JSX.Element {
  const scopeSections = STEP_SECTION[stepId] ?? [];
  const onThisStep = comments.filter((c) => scopeSections.includes(c.section));
  const stepOpenCount = onThisStep.filter((c) => !c.resolved).length;
  const [draft, setDraft] = useState("");
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
              <select className="posfield__select" defaultValue="MINOR" style={{ maxWidth: 140 }}>
                <option value="MAJOR">Major</option>
                <option value="MINOR">Minor</option>
                <option value="OBSERVATION">Observation</option>
              </select>
              <button
                type="button"
                className="posnav__btn posnav__btn--sm posnav__btn--primary"
                disabled={draft.trim() === ""}
                style={draft.trim() === "" ? { opacity: 0.5 } : undefined}
                onClick={() => { onAction("Comment posted"); setDraft(""); }}
              >
                <POSIcon.Send /> Post comment
              </button>
            </div>
          </div>
        </aside>
      )}
    </>
  );
}

export { InternalReviewScreen, ReviewerCommentDock };
