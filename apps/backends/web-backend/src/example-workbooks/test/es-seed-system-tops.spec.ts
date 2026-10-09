import { ES_ANALYSIS } from "../seeds/es-seed";
import { ES_ANALYSIS_HTGR } from "../seeds/es-seed-htgr";
import { SY_ANALYSIS } from "../seeds/sy-seed";
import { SY_ANALYSIS_HTGR } from "../seeds/sy-seed-htgr";
import { EXAMPLE_DEPENDENCY_IDS } from "../seeds/dependency-model-seed";

const variants = [
  { name: "SFR", es: ES_ANALYSIS, sy: SY_ANALYSIS, workbookId: "example-sy-sfr" },
  { name: "HTGR", es: ES_ANALYSIS_HTGR, sy: SY_ANALYSIS_HTGR, workbookId: "example-sy-htgr" },
] as const;

describe("ES example fault tree links", () => {
  it.each(variants)("links every function a $name sequence asks to the top gate of an SY example tree", ({ es, sy, workbookId }) => {
    const tops = new Map(sy.systemLogicModels.map((model) => [model.uuid, model.topGate?.gateId]));
    const unlinked: string[] = [];
    let linked = 0;
    for (const tree of es.eventTrees ?? []) {
      if (tree.uuid === EXAMPLE_DEPENDENCY_IDS.eventTree) continue;
      const asked = new Set(Object.values(tree.sequences).flatMap((sequence) => Object.entries(sequence.functionalEventStates ?? {}).flatMap(([id, state]) => (state === "SUCCESS" || state === "FAILURE" ? [id] : []))));
      for (const [id, event] of Object.entries(tree.functionalEvents)) {
        if (!asked.has(id)) continue;
        const top = event.faultTreeTopEvent;
        if (top === undefined || top.workbookId !== workbookId || tops.get(top.modelId) !== top.entityId) unlinked.push(`${tree.uuid} ${id}`);
        else linked += 1;
      }
    }
    expect(unlinked).toEqual([]);
    expect(linked).toBeGreaterThan(0);
  });

  it("takes each HTGR isolation from the system that isolates that initiator", () => {
    const systemOf = new Map(SY_ANALYSIS_HTGR.systemLogicModels.map((model) => [model.uuid, model.systemReference]));
    const isolation = (treeId: string): string | undefined => {
      const tree = ES_ANALYSIS_HTGR.eventTrees?.find((candidate) => candidate.uuid === treeId);
      const modelId = tree?.functionalEvents["ISOL"]?.faultTreeTopEvent?.modelId;
      return modelId === undefined ? undefined : systemOf.get(modelId);
    };
    expect(isolation("ET-SHEL")).toBe("SYS-HPBI");
    expect(isolation("ET-IFR")).toBe("SYS-HPBI");
    expect(isolation("ET-FHE-P06")).toBe("SYS-HPBI");
    expect(isolation("ET-SMI")).toBe("SYS-SGISO");
    expect(isolation("ET-SCSI-P04")).toBe("SYS-SGISO");
    expect(isolation("ET-WDEP")).toBe("SYS-SGISO");
  });
});
