import { validateBayesianNetworkModel } from "interfaces-shared-types/newly-developed-methods/bayesian-network";
import { ExternalFloodPRASchema } from "interfaces-mef-types/zod/external-flood/external-flood-pra";
import { HighWindsPRASchema } from "interfaces-mef-types/zod/high-winds/high-winds-pra";
import { InternalFirePRASchema } from "interfaces-mef-types/zod/internal-fire/internal-fire-pra";
import { InternalFloodPRASchema } from "interfaces-mef-types/zod/internal-flood/internal-flood-pra";
import { OtherHazardsPRASchema } from "interfaces-mef-types/zod/other-hazards/other-hazards-pra";
import { SeismicPRASchema } from "interfaces-mef-types/zod/seismic/seismic-pra";
import { createExternalFloodPraSeed } from "../seeds/external-flood-pra-seed-factory";
import { createHighWindsPraExample } from "../seeds/high-winds-pra-seed-factory";
import { createInternalFirePraExample } from "../seeds/internal-fire-pra-seed-factory";
import { createInternalFloodPraExample } from "../seeds/internal-flood-pra-seed-factory";
import { createOtherHazardsPraSeed } from "../seeds/other-hazards-pra-seed-factory";
import { createSeismicPraExample } from "../seeds/seismic-pra-seed-factory";

const variants = [
  { name: "HTGR high winds", schema: HighWindsPRASchema, create: () => createHighWindsPraExample("htgr") },
  { name: "SFR high winds", schema: HighWindsPRASchema, create: () => createHighWindsPraExample("sfr") },
  { name: "HTGR internal fire", schema: InternalFirePRASchema, create: () => createInternalFirePraExample("htgr") },
  { name: "SFR internal fire", schema: InternalFirePRASchema, create: () => createInternalFirePraExample("sfr") },
  { name: "HTGR external flood", schema: ExternalFloodPRASchema, create: () => createExternalFloodPraSeed("HTGR") },
  { name: "SFR external flood", schema: ExternalFloodPRASchema, create: () => createExternalFloodPraSeed("SFR") },
  { name: "HTGR internal flood", schema: InternalFloodPRASchema, create: () => createInternalFloodPraExample("htgr") },
  { name: "SFR internal flood", schema: InternalFloodPRASchema, create: () => createInternalFloodPraExample("sfr") },
  { name: "HTGR other hazards", schema: OtherHazardsPRASchema, create: () => createOtherHazardsPraSeed("HTGR") },
  { name: "SFR other hazards", schema: OtherHazardsPRASchema, create: () => createOtherHazardsPraSeed("SFR") },
  { name: "HTGR seismic", schema: SeismicPRASchema, create: () => createSeismicPraExample("htgr") },
  { name: "SFR seismic", schema: SeismicPRASchema, create: () => createSeismicPraExample("sfr") },
] as const;

describe("hazard-conditioned method models", () => {
  it.each(variants)("provides connected FT, ET, and BN models for $name", ({ schema, create }) => {
    const parsed = schema.parse(create());
    const models = parsed.hazardConditionedModels;
    expect(models.initiatingEventFaultTrees).toHaveLength(1);
    expect(models.eventTrees).toHaveLength(1);
    expect(models.dependencyBayesianNetworks).toHaveLength(1);

    const faultTree = models.initiatingEventFaultTrees[0]!;
    expect(faultTree.topGate).not.toBeNull();
    expect(faultTree.gateInputs).toHaveLength(2);
    expect(faultTree.gateInputs.every(({ childId }) =>
      faultTree.leafNodes.some(({ id }) => id === childId))).toBe(true);

    const eventTree = models.eventTrees[0]!;
    const treeSequenceIds = new Set(Object.keys(eventTree.sequences));
    expect(models.eventSequences).toHaveLength(2);
    expect(models.eventSequences.every(({ eventTreeId, eventTreeSequenceId }) =>
      eventTreeId === eventTree.uuid && treeSequenceIds.has(eventTreeSequenceId!))).toBe(true);

    const network = models.dependencyBayesianNetworks[0]!;
    expect(validateBayesianNetworkModel(network, { evidence: { observations: [] } })
      .filter(({ severity }) => severity === "ERROR")).toEqual([]);
    expect(network.edges).toHaveLength(1);
  });

  it.each(variants)("defaults legacy $name workbooks to an empty model bundle", ({ schema, create }) => {
    const legacy = structuredClone(create()) as ReturnType<typeof create> & { hazardConditionedModels?: unknown };
    delete legacy.hazardConditionedModels;
    expect(schema.parse(legacy).hazardConditionedModels).toEqual({
      initiatingEventFaultTrees: [],
      faultTreeCatalogue: { basicEvents: [] },
      eventTrees: [],
      eventSequences: [],
      dependencyBayesianNetworks: [],
    });
  });
});
