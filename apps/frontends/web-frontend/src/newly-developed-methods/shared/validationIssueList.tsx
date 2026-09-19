import type { MethodEntityId, ValidationFieldPath, ValidationIssue } from "interfaces-shared-types";

interface ValidationIssueListProps {
  issues: ValidationIssue[];
  onSelectEntity: (entityId: MethodEntityId) => void;
  resolveEntityTarget: (entityId: MethodEntityId) => HTMLElement | null;
  resolveFieldTarget: (entityId: MethodEntityId, fieldPath: ValidationFieldPath) => HTMLElement | null;
}

const scheduleAfterSelection = (callback: () => void): void => {
  if (typeof window.requestAnimationFrame === "function") {
    window.requestAnimationFrame(callback);
    return;
  }

  window.setTimeout(callback, 0);
};

const focusTarget = (target: HTMLElement): void => {
  if (target.tabIndex < 0 && !target.hasAttribute("tabindex")) {
    target.setAttribute("tabindex", "-1");
  }
  target.scrollIntoView?.({ block: "nearest" });
  target.focus({ preventScroll: true });
};

const ValidationIssueList = ({
  issues,
  onSelectEntity,
  resolveEntityTarget,
  resolveFieldTarget,
}: ValidationIssueListProps): JSX.Element => {
  const selectIssue = (issue: ValidationIssue): void => {
    onSelectEntity(issue.entityId);
    scheduleAfterSelection(() => {
      const fieldTarget =
        issue.fieldPath.length === 0 ? null : resolveFieldTarget(issue.entityId, issue.fieldPath);
      const target = fieldTarget ?? resolveEntityTarget(issue.entityId);
      if (target !== null) focusTarget(target);
    });
  };

  return (
    <ol aria-label="Validation issues">
      {issues.map((issue) => (
        <li key={`${issue.code}:${issue.entityId}:${issue.fieldPath.join(".")}`}>
          <button type="button" data-severity={issue.severity} onClick={() => selectIssue(issue)}>
            <span>{issue.code}</span>
            <span>{issue.message}</span>
          </button>
        </li>
      ))}
    </ol>
  );
};

export { ValidationIssueList };
export type { ValidationIssueListProps };
