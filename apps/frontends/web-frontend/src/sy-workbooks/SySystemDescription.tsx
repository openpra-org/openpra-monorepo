import { JSX } from "react";
import { NotRecorded, ReviewLines, ReviewTitle } from "./syShared";
import { SySystemDiagrams } from "./SySystemDiagrams";
import { useSyWorkbook } from "./syWorkbookContext";
import type { SyDrawerContext } from "./syScreens";

function SySystemDescription({ systemId, openDrawer }: { systemId: string; openDrawer: (ctx: SyDrawerContext) => void }): JSX.Element | null {
  const { sy, links, editable, mutateSy } = useSyWorkbook();
  const def = sy.systemDefinitions.find((candidate) => candidate.uuid === systemId);
  if (def === undefined) return null;
  const system = def;
  const variants = (sy.variableSuccessCriteria ?? []).filter((criterion) => criterion.systemReference === system.uuid);
  const alignments = system.alignments ?? [];
  const states = system.applicablePlantOperatingStates ?? [];
  const posNames = new Map((links?.posStates ?? []).map((state) => [state.id, state.name]));
  const scNames = new Map((links?.scSystems ?? []).map((criterion) => [criterion.id, criterion.name]));
  const scId = system.successCriteriaIds[0];
  const actionLabel = editable ? "Edit" : "View";

  function addVariant(): void {
    if (!editable) return;
    const uuid = crypto.randomUUID();
    mutateSy((draft) => ({
      ...draft,
      variableSuccessCriteria: [...(draft.variableSuccessCriteria ?? []), {
        uuid,
        systemReference: system.uuid,
        successCriteriaIds: [...system.successCriteriaIds],
        basis: "",
        implementsSrs: [{ sr: "SY-A15", hlr: "A" }],
      }],
    }));
    openDrawer({ kind: "variant", id: uuid });
  }

  function addAlignment(): void {
    if (!editable) return;
    const uuid = crypto.randomUUID();
    mutateSy((draft) => ({
      ...draft,
      systemDefinitions: draft.systemDefinitions.map((candidate) => candidate.uuid !== system.uuid ? candidate : {
        ...candidate,
        alignments: [...(candidate.alignments ?? []), {
          uuid,
          name: "New alignment",
          systemReference: system.uuid,
          isNormalAlignment: (candidate.alignments ?? []).length === 0,
          modeled: true,
          implementsSrs: [{ sr: "SY-A7", hlr: "A" }],
        }],
      }),
    }));
    openDrawer({ kind: "alignment", id: uuid });
  }

  return (
    <div className="sy-review">
      <section className="sy-review-section" aria-label="Definition">
        <ReviewTitle title="Definition" sr="SY-A1 · A8">
          <button type="button" className="posnav__btn posnav__btn--sm" onClick={() => openDrawer({ kind: "sysdef", id: system.uuid })}>{actionLabel}</button>
        </ReviewTitle>
        <table className="sy-review-table" aria-label="System definition">
          <tbody>
            <tr><th scope="row">SC criterion</th><td>{scId === undefined ? "Typed" : scNames.get(scId) ?? scId}</td></tr>
            <tr><th scope="row">Top event</th><td>{system.description ?? <NotRecorded />}</td></tr>
            <tr><th scope="row">Success criterion</th><td>{system.successCriterion ?? <NotRecorded />}</td></tr>
            <tr>
              <th scope="row">Mission time</th>
              <td>
                {system.missionTimeHours === undefined ? <NotRecorded /> : <span>{`${system.missionTimeHours} h`}</span>}
                <span className="sy-review-sub">{system.missionTimeRef === undefined ? "Typed" : `SC ${system.missionTimeRef}`}</span>
              </td>
            </tr>
          </tbody>
        </table>
      </section>

      <section className="sy-review-section" aria-label="Success criterion by operating state">
        <ReviewTitle title="Success criterion by operating state" sr="SY-A15">
          {editable && <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" onClick={addVariant}>Add variant</button>}
        </ReviewTitle>
        {variants.length === 0 ? <p className="sy-review-empty">The criterion above applies in every operating state.</p> : (
          <table className="sy-review-table" aria-label="Success criterion by operating state">
            <tbody>
              {variants.map((criterion) => (
                <tr key={criterion.uuid}>
                  <th scope="row">
                    <span>{criterion.plantOperatingStateId ?? "Any state"}</span>
                    {criterion.plantOperatingStateId !== undefined && posNames.has(criterion.plantOperatingStateId) && <span className="sy-review-sub">{posNames.get(criterion.plantOperatingStateId)}</span>}
                  </th>
                  <td>
                    {criterion.basis.length > 0 ? <span>{criterion.basis}</span> : <NotRecorded />}
                    {criterion.scenarioCondition !== undefined && <span className="sy-review-sub">{criterion.scenarioCondition}</span>}
                  </td>
                  <td className="sy-review-edit"><button type="button" className="posnav__btn posnav__btn--sm" aria-label={`${actionLabel} variant ${criterion.plantOperatingStateId ?? "any state"}`} onClick={() => openDrawer({ kind: "variant", id: criterion.uuid })}>{actionLabel}</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="sy-review-section" aria-label="Model boundary">
        <ReviewTitle title="Model boundary" sr="SY-A8">
          <button type="button" className="posnav__btn posnav__btn--sm" onClick={() => openDrawer({ kind: "boundary", id: system.uuid })}>{actionLabel}</button>
        </ReviewTitle>
        <table className="sy-review-table" aria-label="Boundary">
          <tbody><tr><th scope="row">Included</th><td><ReviewLines items={system.boundaries} /></td></tr></tbody>
        </table>
      </section>

      <SySystemDiagrams systemId={system.uuid} openDrawer={openDrawer} />

      <section className="sy-review-section" aria-label="Alignments">
        <ReviewTitle title="Alignments" sr="SY-A7">
          {editable && <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" onClick={addAlignment}>Add alignment</button>}
        </ReviewTitle>
        {alignments.length === 0 ? <p className="sy-review-empty">No alignments recorded.</p> : (
          <table className="sy-review-table" aria-label="Alignments">
            <thead><tr><th scope="col">Alignment</th><th scope="col">Description</th><th scope="col">Status</th><th scope="col" className="sy-review-edit" aria-label="Actions" /></tr></thead>
            <tbody>
              {alignments.map((alignment) => (
                <tr key={alignment.uuid}>
                  <td><span className="sy-review-name">{alignment.name}</span></td>
                  <td>{alignment.description ?? <NotRecorded />}</td>
                  <td>
                    <span>{alignment.isNormalAlignment ? "Normal" : "Alternate"}</span>
                    <span className="sy-review-sub">{alignment.modeled ? "Modeled" : "Not modeled"}</span>
                    {!alignment.modeled && (alignment.justificationIfNotModeled === undefined
                      ? <span className="sy-error">Reason required</span>
                      : <span className="sy-review-sub">{alignment.justificationIfNotModeled}</span>)}
                  </td>
                  <td className="sy-review-edit"><button type="button" className="posnav__btn posnav__btn--sm" aria-label={`${actionLabel} ${alignment.name}`} onClick={() => openDrawer({ kind: "alignment", id: alignment.uuid })}>{actionLabel}</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="sy-review-section" aria-label="Operating states">
        <ReviewTitle title="Operating states">
          <button type="button" className="posnav__btn posnav__btn--sm" onClick={() => openDrawer({ kind: "states", id: system.uuid })}>{actionLabel}</button>
        </ReviewTitle>
        <table className="sy-review-table" aria-label="Operating states">
          <tbody>
            <tr>
              <th scope="row">Applies in</th>
              <td>{states.length === 0 ? "Every operating state" : states.map((id) => { const name = posNames.get(id); return name === undefined ? id : `${name} (${id})`; }).join(", ")}</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section className="sy-review-section" aria-label="Operation and maintenance">
        <ReviewTitle title="Operation and maintenance" sr="SY-A3">
          <button type="button" className="posnav__btn posnav__btn--sm" onClick={() => openDrawer({ kind: "operations", id: system.uuid })}>{actionLabel}</button>
        </ReviewTitle>
        <table className="sy-review-table" aria-label="Operation and maintenance">
          <tbody>
            <tr><th scope="row">Operating procedures</th><td><ReviewLines items={system.operatingProcedures ?? []} /></td></tr>
            <tr><th scope="row">Test and maintenance</th><td><ReviewLines items={system.testAndMaintenanceProcedures ?? []} /></td></tr>
            <tr><th scope="row">Operating limits</th><td><ReviewLines items={system.operatingLimitations ?? []} /></td></tr>
          </tbody>
        </table>
      </section>
    </div>
  );
}

export { SySystemDescription };
