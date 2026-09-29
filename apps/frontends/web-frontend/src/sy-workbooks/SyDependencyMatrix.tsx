import { JSX } from "react";
import { WorkbookSectionHeading } from "../workbooks/workbookSectionHeading";
import { NotRecorded, ReviewTitle } from "./syShared";
import {
  SUPPORT_KIND_LABELS,
  dependencyLinks,
  linkIssues,
  linkKey,
  newDependency,
  treatmentOf,
  type DependencyLink,
} from "./syDependencyLinks";
import { useSyWorkbook } from "./syWorkbookContext";
import type { SyDrawerContext } from "./syScreens";
import "./css/syDependencies.css";

function cellText(link: DependencyLink): string {
  if (link.records.length === 0) return link.transfers.length > 0 ? "Transfer, kind not recorded" : "Listed in Success Criteria";
  const kinds = [...new Set(link.records.map((record) => (record.supportKind === undefined ? "Kind not recorded" : SUPPORT_KIND_LABELS[record.supportKind])))];
  const allLeftOut = link.records.every((record) => treatmentOf(record, link) === "EXCLUDED");
  return `${kinds.join(", ")}${allLeftOut ? ", left out" : ""}`;
}

function DependencyMatrix({ openDrawer }: { openDrawer: (ctx: SyDrawerContext) => void }): JSX.Element {
  const { sy, shortOf, editable, mutateSy, links } = useSyWorkbook();
  const actionLabel = editable ? "Edit" : "View";
  const allLinks = dependencyLinks(sy, links);
  const byKey = new Map(allLinks.map((link) => [linkKey(link.dependentSystem, link.supportingSystem), link]));
  const supportIds = sy.systemDefinitions.map((system) => system.uuid).filter((id) => allLinks.some((link) => link.supportingSystem === id));
  const method = sy.dependencySearchMethodology;

  function openLink(link: DependencyLink): void {
    const record = link.records[0];
    if (record !== undefined) {
      openDrawer({ kind: "dep", id: record.uuid });
      return;
    }
    if (!editable) return;
    const uuid = crypto.randomUUID();
    mutateSy((draft) => ({ ...draft, systemDependencies: [...draft.systemDependencies, newDependency(link, uuid)] }));
    openDrawer({ kind: "dep", id: uuid });
  }

  return (
    <div className="poscard">
      <div className="poscard__head">
        <WorkbookSectionHeading workbook="SY" title="Dependency matrix" level={3} />
      </div>
      <div className="sy-review">
        <section className="sy-review-section" aria-label="Dependency matrix">
          <ReviewTitle title="Each row needs the systems in its columns" sr="SY-B5 · B10" />
          {supportIds.length === 0 ? <p className="sy-review-empty">No system transfers to or records a support system yet. Use Add support above, or add a transfer to a support system in a Step 02 fault tree.</p> : (
            <div className="sy-depmatrix">
              <table aria-label="Dependency matrix">
                <thead>
                  <tr>
                    <th scope="col">System</th>
                    {supportIds.map((id) => <th key={id} scope="col">{shortOf(id)}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {sy.systemDefinitions.map((row) => (
                    <tr key={row.uuid}>
                      <th scope="row">{row.name}</th>
                      {supportIds.map((column) => {
                        if (column === row.uuid) return <td key={column} className="sy-depmatrix__self" />;
                        const link = byKey.get(linkKey(row.uuid, column));
                        if (link === undefined) return <td key={column} />;
                        const text = cellText(link);
                        const rows = link.records.length === 0 ? [undefined] : link.records;
                        const failing = rows.some((record) => linkIssues(link, record, sy, allLinks).some((issue) => issue.severity === "ERROR"));
                        const leftOut = link.records.length > 0 && link.records.every((record) => treatmentOf(record, link) === "EXCLUDED");
                        const className = `sy-depmatrix__cell${failing ? " sy-depmatrix__cell--error" : leftOut ? " sy-depmatrix__cell--left" : ""}`;
                        return (
                          <td key={column}>
                            {link.records.length > 0 || editable ? (
                              <button type="button" className={className} aria-label={`${actionLabel} ${shortOf(row.uuid)} needs ${shortOf(column)}: ${text}`} onClick={() => openLink(link)}>{text}</button>
                            ) : <span className={className}>{text}</span>}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="sy-review-section" aria-label="Dependency search">
          <ReviewTitle title="Dependency search" sr="SY-B5 · B10">
            <button type="button" className="posnav__btn posnav__btn--sm" aria-label={`${actionLabel} dependency search`} onClick={() => openDrawer({ kind: "method", id: method.uuid })}>{actionLabel}</button>
          </ReviewTitle>
          <table className="sy-review-table" aria-label="Dependency search">
            <tbody>
              <tr><th scope="row">Method</th><td>{method.description.length > 0 ? method.description : <NotRecorded />}</td></tr>
              <tr><th scope="row">Reference</th><td>{method.reference.length > 0 ? method.reference : <NotRecorded />}</td></tr>
            </tbody>
          </table>
        </section>
      </div>
    </div>
  );
}

export { DependencyMatrix };
