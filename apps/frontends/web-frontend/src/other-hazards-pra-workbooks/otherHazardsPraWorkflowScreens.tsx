import { type ReviewComment } from "interfaces-mef-types/core/pra-common";
import { reviewBlockingOtherHazardsPraDiagnostics } from "interfaces-mef-types/other-hazards/other-hazards-pra-validation";
import { type JSX, type ReactNode, useMemo, useState } from "react";
import { POSIcon } from "../pos-workbooks/posIcons";
import { Badge } from "../pos-workbooks/posShared";
import { WorkbookSectionHeading } from "../workbooks/workbookSectionHeading";
import {
  otherHazardsConformanceItems,
  otherHazardsConformanceScore,
} from "./otherHazardsPraConformance";
import { downloadOtherHazardsPraJson, generateOtherHazardsPraReport } from "./otherHazardsPraDocx";
import { useOtherHazardsPraWorkbook } from "./otherHazardsPraWorkbookContext";

export type OtherHazardsPraPersona = "preparer" | "reviewer" | "approver";
export interface OtherHazardsWorkflowActions {
  submitForReview?: () => Promise<void>;
  requestRevision?: () => Promise<void>;
  submitForApproval?: () => Promise<void>;
  toggleResolve?: (commentId: string, resolved: boolean) => Promise<void>;
}

const REPORT_TOC = [
  ["Executive summary", 1],
  ["Analysis basis, scope, and interfaces", 4],
  ["Controlled site and evidence basis", 10],
  ["Retained hazard groups", 20],
  ["Hazard source and effect characterization", 31],
  ["Occurrence and frequency analysis", 44],
  ["Secondary and combined hazards", 57],
  ["Hazard curves, intervals, and uncertainty", 70],
  ["Preliminary plant response and SSC scope", 84],
  ["Plant investigation and configuration confirmation", 99],
  ["SSC screening and fragility basis", 113],
  ["SSC and functional fragility analysis", 126],
  ["Initiating events and scenario development", 142],
  ["Plant-response model", 158],
  ["Human reliability analysis", 175],
  ["Event-sequence quantification", 191],
  ["Uncertainty, sensitivity, and risk interpretation", 208],
  ["Risk integration and controlled baseline", 222],
  ["Conformance matrix and peer-review readiness", 238],
  ["Controlled references and appendices", 255],
] as const;

export function OtherHazardsDraftScreen({
  actions,
}: {
  actions?: OtherHazardsWorkflowActions;
}): JSX.Element {
  const { mef, editable, mutate } = useOtherHazardsPraWorkbook();
  const [busy, setBusy] = useState(false);
  const blockers = useMemo(() => reviewBlockingOtherHazardsPraDiagnostics(mef), [mef]);
  const score = useMemo(
    () => otherHazardsConformanceScore(otherHazardsConformanceItems(mef)),
    [mef],
  );
  const canSubmit =
    editable && (mef.workflowState === "DRAFT" || mef.workflowState === "REVISION_REQUIRED");
  function submit(): void {
    setBusy(true);
    const operation = actions?.submitForReview?.();
    if (operation !== undefined) operation.finally(() => setBusy(false));
    else {
      mutate((current) => ({
        ...current,
        workflowState: "INTERNAL_TECHNICAL_REVIEW",
        workflowHistory: [
          ...current.workflowHistory,
          {
            state: "INTERNAL_TECHNICAL_REVIEW",
            enteredAt: new Date().toISOString(),
            actor: current.owner ?? "Other Hazards PRA Team",
          },
        ],
      }));
      setBusy(false);
    }
  }
  return (
    <div className="posgen">
      <div
        className="posgen__preview"
        aria-hidden="true"
      >
        <div className="posgen__preview-eyebrow">Generated preview · Word output</div>
        <h1>{mef.name}</h1>
        <h2>Other Hazards Probabilistic Risk Assessment</h2>
        <h3>Table of contents</h3>
        <div className="posgen__preview-toc">
          {REPORT_TOC.map(([title, page]) => (
            <div
              key={title}
              className="posgen__preview-toc-row"
            >
              <span>{title}</span>
              <span>{page}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="posgen__side">
        <div className="posgen__readout">
          <WorkbookSectionHeading
            workbook="O"
            title="Conformance check"
            description="Summarizes whether the populated analysis satisfies the applicable OHA, OFR, and OPR requirements before controlled review."
            className="posgen__readout-h"
          />
          <div className="posgen__bar">
            <span className="posgen__bar-label">Capability category</span>
            <strong>{mef.capabilityCategory}</strong>
          </div>
          <div className="posgen__bar">
            <span className="posgen__bar-label">Plant stage</span>
            <strong>{mef.plantStage.replace(/_/g, " ")}</strong>
          </div>
          <div className="posgen__bar">
            <span className="posgen__bar-label">Requirements satisfied</span>
            <span className="posmono">
              {score.met} / {score.applicable}
            </span>
          </div>
          {score.warn > 0 && (
            <div className="posgen__bar">
              <span
                className="posgen__bar-label"
                style={{ color: "var(--color-warning)" }}
              >
                Needs attention
              </span>
              <span className="posmono">{score.warn}</span>
            </div>
          )}
          {score.blocked > 0 && (
            <div className="posgen__bar">
              <span
                className="posgen__bar-label"
                style={{ color: "#b73b3b" }}
              >
                Blocked
              </span>
              <span className="posmono">{score.blocked}</span>
            </div>
          )}
        </div>
        <div className="posgen__readout">
          <WorkbookSectionHeading
            workbook="O"
            title={canSubmit ? "Hand-off to internal review" : "Read-only draft preview"}
            description="Generates the controlled analysis package and advances it to technical review after every blocking validation issue is resolved."
            className="posgen__readout-h"
          />
          <p className="posmuted">
            {blockers.length === 0 ?
              "The analysis passes the review-blocking checks and is ready for controlled hand-off."
            : `${String(blockers.length)} blocking validation issue${blockers.length === 1 ? "" : "s"} remain.`
            }
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {canSubmit && (
              <button
                type="button"
                className="posnav__btn posnav__btn--primary"
                disabled={blockers.length > 0 || busy}
                onClick={submit}
              >
                {blockers.length === 0 ?
                  <POSIcon.Send />
                : <POSIcon.Lock />}{" "}
                {busy ? "Submitting…" : "Submit draft to internal review"}
              </button>
            )}
            <button
              type="button"
              className="posnav__btn"
              onClick={() => void generateOtherHazardsPraReport(mef, false)}
            >
              <POSIcon.Download /> Download draft (.docx)
            </button>
            <button
              type="button"
              className="posnav__btn"
              onClick={() => downloadOtherHazardsPraJson(mef)}
            >
              <POSIcon.Download /> Download JSON
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

const REVIEW_AREAS: Record<string, string> = {
  OHA: "Other Hazards Analysis",
  OFR: "Other Hazards Fragility Analysis",
  OPR: "Other Hazards Plant Response Analysis",
};
function sectionFor(comment: ReviewComment): string {
  const prefix = comment.associatedSr?.split("-")[0];
  return prefix === undefined ? "Integrated analysis" : (
      (REVIEW_AREAS[prefix] ?? "Integrated analysis")
    );
}
function reviewDate(value: string): string {
  return new Date(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function ReviewComments({
  persona,
  actions,
  approvalView = false,
  title = "All review comments",
  description = "Groups technical comments by OHA, OFR, OPR, or integrated analysis and tracks each finding through resolution.",
}: {
  persona: OtherHazardsPraPersona;
  actions?: OtherHazardsWorkflowActions;
  approvalView?: boolean;
  title?: string;
  description?: string;
}): JSX.Element {
  const { mef, mutate } = useOtherHazardsPraWorkbook();
  const [filter, setFilter] = useState<"all" | "open" | "resolved">("all");
  const allComments = mef.internalReviewComments.comments;
  const comments = [
    ...(approvalView && persona !== "preparer" ?
      allComments.filter(
        (comment) =>
          comment.authorRole ===
          (persona === "approver" ? "INTERNAL_APPROVER" : "INTERNAL_REVIEWER"),
      )
    : allComments),
  ].sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime());
  const visible = comments.filter(
    (comment) => filter === "all" || (filter === "open" ? !comment.resolved : comment.resolved),
  );
  const groups = new Map<string, ReviewComment[]>();
  for (const comment of visible)
    groups.set(sectionFor(comment), [...(groups.get(sectionFor(comment)) ?? []), comment]);
  const open = comments.filter((comment) => !comment.resolved).length;
  function toggle(comment: ReviewComment): void {
    const resolved = !comment.resolved;
    const operation = actions?.toggleResolve?.(comment.uuid, resolved);
    if (operation !== undefined) return;
    mutate((current) => {
      const next = current.internalReviewComments.comments.map((item) =>
        item.uuid !== comment.uuid ? item
        : resolved ?
          {
            ...item,
            resolved: true,
            resolution:
              item.resolution ??
              "The responsible analyst incorporated the disposition and the comment author verified the revised Other Hazards record.",
            resolvedAt: new Date().toISOString(),
            resolvedBy: `${persona} user`,
          }
        : {
            ...item,
            resolved: false,
            resolution: undefined,
            resolvedAt: undefined,
            resolvedBy: undefined,
          },
      );
      return {
        ...current,
        internalReviewComments: {
          comments: next,
          openCount: next.filter((item) => !item.resolved).length,
          resolvedCount: next.filter((item) => item.resolved).length,
        },
      };
    });
  }
  return (
    <div className="poscard">
      <div className="poscard__head">
        <WorkbookSectionHeading
          workbook="O"
          title={title}
          description={description}
        />
        <div
          className="posrow"
          style={{ gap: 6 }}
        >
          {(["all", "open", "resolved"] as const).map((item) => (
            <button
              key={item}
              type="button"
              className={`poschip${filter === item ? " poschip--primary" : ""}`}
              onClick={() => setFilter(item)}
            >
              {item[0]!.toUpperCase() + item.slice(1)} (
              {item === "all" ?
                comments.length
              : item === "open" ?
                open
              : comments.length - open}
              )
            </button>
          ))}
        </div>
      </div>
      <div className="poscomments">
        {groups.size === 0 ?
          <p className="posmuted">
            {approvalView && persona !== "preparer" ?
              "You have no comments."
            : "No review comments recorded."}
          </p>
        : [...groups.entries()].map(([area, records]) => (
            <div
              className="poscomments__group"
              key={area}
            >
              <div className="poscomments__group-head">{area}</div>
              {records.map((comment) => {
                const canToggle =
                  (persona === "reviewer" && comment.authorRole === "INTERNAL_REVIEWER") ||
                  (persona === "approver" && comment.authorRole === "INTERNAL_APPROVER");
                return (
                  <div
                    key={comment.uuid}
                    className={`poscomment poscomment--${comment.resolved ? "resolved" : "open"}`}
                  >
                    <div className="poscomment__main">
                      <div className="poscomment__head">
                        <strong>{comment.authorId}</strong>
                        <span className="poscomment__when">· {reviewDate(comment.createdAt)}</span>
                        <span className="poscomment__spacer" />
                        <span
                          className={`posbadge ${comment.resolved ? "posbadge--ok" : "posbadge--progress"}`}
                        >
                          <span className="posbadge__dot" />
                          {comment.resolved ? "Resolved" : "Open"}
                        </span>
                      </div>
                      <div className="poscomment__target">
                        <span className="poschip">{comment.associatedSr ?? "general"}</span>
                        {comment.associatedField !== undefined && (
                          <span> · {comment.associatedField}</span>
                        )}
                      </div>
                      <p className="poscomment__body">{comment.text}</p>
                      {comment.resolution !== undefined && (
                        <div className="poscomment__resolution">
                          <strong>Resolution.</strong> {comment.resolution}
                        </div>
                      )}
                      <div className="poscomment__foot">
                        <span className="poscomment__foot-spacer" />
                        {canToggle && (
                          <button
                            type="button"
                            className={`posnav__btn posnav__btn--sm${comment.resolved ? "" : " posnav__btn--primary"}`}
                            onClick={() => toggle(comment)}
                          >
                            {comment.resolved ?
                              <>
                                <POSIcon.Close /> Reopen
                              </>
                            : <>
                                <POSIcon.Check /> Mark resolved
                              </>
                            }
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ))
        }
      </div>
    </div>
  );
}

function ReviewBanner(): JSX.Element {
  const { mef } = useOtherHazardsPraWorkbook();
  const comments = mef.internalReviewComments.comments;
  const open = comments.filter((item) => !item.resolved).length;
  const resolved = comments.length - open;
  const approved = mef.workflowState === "FINAL";
  const submitted = mef.workflowState === "INTERNAL_APPROVAL";
  return (
    <div
      className={`posrevbanner posrevbanner--${
        approved ? "approved"
        : submitted ? "submitted"
        : open === 0 ? "ready"
        : "in_review"
      }`}
    >
      <div className="posrevbanner__icon">
        <POSIcon.Lock />
      </div>
      <div className="posrevbanner__main">
        <div className="posrevbanner__eyebrow">
          {approved ?
            "Approved"
          : submitted ?
            "Submitted to approver"
          : open === 0 ?
            "All comments resolved"
          : "In review"}
        </div>
        <div className="posrevbanner__title">
          {approved ?
            "Workbook approved · locked from edits"
          : submitted ?
            "Awaiting the assigned approver's signature"
          : open === 0 ?
            "Ready to submit for Internal Approval"
          : `${String(open)} of ${String(comments.length)} comments still open`}
        </div>
      </div>
      <div className="posrevbanner__counts">
        <span className="posrevbanner__count posrevbanner__count--ok">{resolved} resolved</span>
        {open > 0 && (
          <span className="posrevbanner__count posrevbanner__count--warn">{open} open</span>
        )}
      </div>
    </div>
  );
}

export function OtherHazardsReviewScreen({
  persona,
  actions,
  renderRoster,
}: {
  persona: OtherHazardsPraPersona;
  actions?: OtherHazardsWorkflowActions;
  renderRoster?: () => ReactNode;
}): JSX.Element {
  const { mef, mutate } = useOtherHazardsPraWorkbook();
  const [busy, setBusy] = useState(false);
  const [pinged, setPinged] = useState(false);
  const open = mef.internalReviewComments.comments.filter((item) => !item.resolved).length;
  function submit(): void {
    setBusy(true);
    const operation = actions?.submitForApproval?.();
    if (operation !== undefined) operation.finally(() => setBusy(false));
    else {
      mutate((current) => ({
        ...current,
        workflowState: "INTERNAL_APPROVAL",
        workflowHistory: [
          ...current.workflowHistory,
          {
            state: "INTERNAL_APPROVAL",
            enteredAt: new Date().toISOString(),
            actor: current.owner ?? "Other Hazards PRA Team",
          },
        ],
      }));
      setBusy(false);
    }
  }
  return (
    <>
      <ReviewBanner />
      {renderRoster?.()}
      <ReviewComments
        persona={persona}
        actions={actions}
      />
      {persona === "preparer" && (
        <div className="poscard">
          <div className="poscard__head">
            <WorkbookSectionHeading
              workbook="O"
              title="Submit for Internal Approval"
              description="Advances the technically reviewed Other Hazards baseline after every review comment has been dispositioned."
            />
            {open === 0 ?
              <Badge kind="ok">All comments resolved</Badge>
            : <Badge kind="warn">
                {open} open comment{open === 1 ? "" : "s"}
              </Badge>
            }
          </div>
          <div className="posrow">
            <button
              type="button"
              className="posnav__btn"
              onClick={() => setPinged(true)}
            >
              <POSIcon.Send /> {pinged ? "Reviewers notified" : "Ping reviewers"}
            </button>
            <span className="poscomment__foot-spacer" />
            <button
              type="button"
              className="posnav__btn posnav__btn--primary"
              disabled={open > 0 || busy}
              onClick={submit}
            >
              {open === 0 ?
                <POSIcon.Send />
              : <POSIcon.Lock />}{" "}
              {busy ? "Submitting…" : "Submit for Internal Approval"}
            </button>
          </div>
        </div>
      )}
    </>
  );
}

export function OtherHazardsApprovalScreen({
  persona,
  actions,
  renderApprovalTable,
  renderSignCard,
}: {
  persona: OtherHazardsPraPersona;
  actions?: OtherHazardsWorkflowActions;
  renderApprovalTable?: () => ReactNode;
  renderSignCard?: () => ReactNode;
}): JSX.Element {
  const { mef } = useOtherHazardsPraWorkbook();
  const [handoff, setHandoff] = useState<string | null>(null);
  const score = useMemo(
    () => otherHazardsConformanceScore(otherHazardsConformanceItems(mef)),
    [mef],
  );
  const resolved = mef.internalReviewComments.comments.filter((item) => item.resolved).length;
  const approved = mef.workflowState === "FINAL";
  return (
    <>
      <ReviewBanner />
      <ReviewComments
        persona={persona}
        actions={actions}
        approvalView
        title={persona === "preparer" ? "Comments by reviewers & approvers" : "Your comments"}
        description="Reviews the comment record supporting the Other Hazards approval decision and each responsible role's resolution status."
      />
      <div className="poscard">
        <div className="poscard__head">
          <WorkbookSectionHeading
            workbook="O"
            title="What is being attested"
            description="Confirms the capability target, requirements, comment record, and controlled configuration snapshot covered by approval."
          />
        </div>
        <div className="posapprove__attest-with-sign">
          <div className="posapprove__attest-grid">
            <div className="posapprove__attest-row">
              <span className="posapprove__attest-cap">Capability target</span>
              <span className="posapprove__attest-val">
                <strong>{mef.capabilityCategory}</strong> · Other Hazards PRA
              </span>
            </div>
            <div className="posapprove__attest-row">
              <span className="posapprove__attest-cap">Requirements satisfied</span>
              <span className="posapprove__attest-val posmono">
                {score.met} of {score.applicable}
              </span>
            </div>
            <div className="posapprove__attest-row">
              <span className="posapprove__attest-cap">Review comments</span>
              <span className="posapprove__attest-val posmono">
                {resolved} of {mef.internalReviewComments.comments.length} resolved
              </span>
            </div>
            <div className="posapprove__attest-row">
              <span className="posapprove__attest-cap">Configuration snapshot</span>
              <span className="posapprove__attest-val">
                {mef.configurationControlRecordId ?? "Not linked"}
              </span>
            </div>
          </div>
          {renderSignCard !== undefined && (
            <div className="posapprove__sign-col">{renderSignCard()}</div>
          )}
        </div>
      </div>
      {renderApprovalTable?.()}
      {approved && (
        <div className="poscard posapprove__handoff">
          <div className="poscard__head">
            <WorkbookSectionHeading
              workbook="O"
              title="After approval — external workflows"
              description="Releases the approved, locked Other Hazards workbook to independent peer review or audit without allowing changes to the controlled analysis."
            />
            <Badge kind="draft">View + comment only</Badge>
          </div>
          <div className="posapprove__handoff-grid">
            <button
              type="button"
              className="posapprove__handoff-card"
              onClick={() => setHandoff("Peer Review release selected")}
            >
              <div className="posapprove__handoff-card-title">Peer Review</div>
              <div className="posapprove__handoff-card-foot">
                <span>Release to peer review</span>
                <POSIcon.ArrowR />
              </div>
            </button>
            <button
              type="button"
              className="posapprove__handoff-card"
              onClick={() => setHandoff("Audit release selected")}
            >
              <div className="posapprove__handoff-card-title">Audit</div>
              <div className="posapprove__handoff-card-foot">
                <span>Release to audit</span>
                <POSIcon.ArrowR />
              </div>
            </button>
          </div>
          {handoff !== null && (
            <p
              className="posmuted"
              role="status"
            >
              {handoff}
            </p>
          )}
        </div>
      )}
    </>
  );
}
