import { BuilderBase } from "../core/builder-base";
import type { ModelContext } from "../core/context";
import { NetworkBuilderError, valueError } from "../core/errors";
import { errorFunction } from "../core/math-functions";
import type { CpdGenerator, NodeRecord } from "../core/model";
import {
  decodeRowIndex,
  formatGeneral,
  getValue,
  getValueOr,
  hasKey,
  isMapping,
  isSequence,
  iterValues,
  replaceNonAlphanumericRuns,
  repr,
  strip,
  stripCharacters,
  sum,
  text,
  toFloat,
  truthy,
} from "../core/spec-values";
import type { SpecMapping, SpecValue } from "../core/spec-values";

const slug = (token: string): string => {
  const cleaned = stripCharacters(replaceNonAlphanumericRuns(strip(token), "_"), "_");
  return cleaned.length > 0 ? cleaned.toLowerCase() : "x";
};

const normalCdf = (z: number): number => 0.5 * (1 + errorFunction(z / Math.sqrt(2)));

const largerOf = (first: number, second: number): number => (second > first ? second : first);

const logarithm = (value: number): number => {
  if (value <= 0) throw valueError("math domain error");
  return Math.log(value);
};

interface BarrierModel {
  type: string;
  failIfDepthExceeds: number;
  failProbBelow: number;
  failProbExceeded: number;
  failProbNone: number;
  theta: number;
  beta: number;
  failProbFloor: number;
  usePga: boolean;
  pgaTheta: number;
  pgaBeta: number;
}

interface InteriorMapping {
  mode: string;
  scale: number;
  intactDistribution: number[];
}

interface BuildingRecord {
  interiorKey: string;
  interiorNodeId: string;
  interiorCenters: number[];
}

interface BarrierGeneratorInput {
  areaKey: string;
  pgaKey: string | null;
  areaNoneLabel: string;
  areaCenters: readonly number[];
  pgaNoneLabel: string;
  pgaCenters: readonly number[];
  modelConfig: BarrierModel;
  allowExtraParents: boolean;
}

interface InteriorGeneratorInput {
  areaKey: string;
  barrierKey: string;
  areaNoneLabel: string;
  areaCenters: readonly number[];
  interiorCenters: readonly number[];
  interiorNoneIndex: number | null;
  interiorMapping: InteriorMapping;
  allowExtraParents: boolean;
}

class FloodBuildingsBuilder extends BuilderBase {
  get builderType(): string {
    return "flood_buildings";
  }

  get requires(): Set<string> {
    const required = new Set(iterValues(getValueOr(this.config, "requires", [])).map((item) => text(item)));
    for (const building of this.buildingItems()) {
      const buildingId = FloodBuildingsBuilder.requireText(
        getValue(building, "building_id"),
        "buildings[].building_id",
      );
      required.add(this.resolveAreaKey(building, buildingId));
      if (this.buildingUsesPga(building)) required.add(this.pgaKey());
    }
    return required;
  }

  get provides(): Set<string> {
    const output = new Set<string>();
    for (const building of this.buildingItems()) {
      const buildingId = FloodBuildingsBuilder.requireText(
        getValue(building, "building_id"),
        "buildings[].building_id",
      );
      const barrierKey = strip(text(getValueOr(building, "barrier_key", "")));
      output.add(barrierKey.length > 0 ? barrierKey : this.barrierKey(buildingId));
      const interiorKey = strip(text(getValueOr(building, "interior_key", "")));
      output.add(interiorKey.length > 0 ? interiorKey : this.interiorKey(buildingId));
    }
    for (const ssc of this.insideSscItems()) {
      const sscId = FloodBuildingsBuilder.requireText(getValue(ssc, "ssc_id"), "inside_sscs[].ssc_id");
      const key = strip(text(getValueOr(ssc, "key", "")));
      output.add(key.length > 0 ? key : this.insideDamageKey(sscId));
    }
    return output;
  }

  build(context: ModelContext): void {
    const pgaKey = this.pgaKey();
    const pgaNoneLabel = this.pgaNoneStateLabel();
    const pgaAvailable = context.registry.hasKey(pgaKey);
    let pgaNodeId: string | null = null;
    let pgaCenters: number[] = [0];

    const anyBuildingUsesPga = this.buildingItems().some((building) => this.buildingUsesPga(building));
    if (anyBuildingUsesPga) {
      if (!pgaAvailable) {
        throw valueError(
          "flood_buildings requires seismic PGA because at least one building uses PGA-dependent " +
            "barrier fragility. Add seismic builder or remove pga_fragility/include_pga_parent.",
        );
      }
      pgaNodeId = context.registry.nodeId(pgaKey);
      const pgaStates = context.model.node(pgaNodeId).states;
      pgaCenters = this.resolvePgaCenters(context, pgaStates);
    }

    const buildingsMeta = new Map<string, BuildingRecord>();

    for (const item of this.buildingItems()) {
      const buildingId = FloodBuildingsBuilder.requireText(getValue(item, "building_id"), "buildings[].building_id");
      if (buildingsMeta.has(buildingId)) {
        throw valueError(`Duplicate building_id '${buildingId}' in flood_buildings.buildings.`);
      }

      const areaKey = this.resolveAreaKey(item, buildingId);
      if (!context.registry.hasKey(areaKey)) {
        throw valueError(`Building '${buildingId}' references unknown area key '${areaKey}'.`);
      }
      const areaNodeId = context.registry.nodeId(areaKey);
      const areaStates = context.model.node(areaNodeId).states;

      const rawAreaNoneLabel = strip(text(getValueOr(item, "area_none_state_label", this.depthNoneStateLabel())));
      const areaNoneLabel = rawAreaNoneLabel.length > 0 ? rawAreaNoneLabel : this.depthNoneStateLabel();
      const areaCenters = this.resolveAreaCenters(context, item, areaStates, areaNoneLabel);

      const barrierConfig = this.resolveBarrierModel(item, buildingId);
      const barrierUsesPga = barrierConfig.usePga;
      const barrierPgaKey = barrierUsesPga ? pgaKey : null;

      if (barrierUsesPga && pgaNodeId === null) {
        throw valueError(`Building '${buildingId}' barrier is PGA-dependent but PGA node is unavailable.`);
      }

      const rawBarrierKey = strip(text(getValueOr(item, "barrier_key", "")));
      const barrierKey = rawBarrierKey.length > 0 ? rawBarrierKey : this.barrierKey(buildingId);
      const rawBarrierNodeId = strip(text(getValueOr(item, "barrier_node_id", "")));
      const barrierNodeId = rawBarrierNodeId.length > 0 ? rawBarrierNodeId : this.defaultBarrierNodeId(buildingId);

      const barrierCpdGenerator = this.makeBarrierCpdGenerator({
        areaKey,
        pgaKey: barrierPgaKey,
        areaNoneLabel,
        areaCenters,
        pgaNoneLabel,
        pgaCenters,
        modelConfig: barrierConfig,
        allowExtraParents: truthy(getValueOr(item, "allow_extra_barrier_parents", false)),
      });

      const barrierParentIds = [areaNodeId];
      if (barrierUsesPga && pgaNodeId !== null) barrierParentIds.push(pgaNodeId);

      context.model.addNode({
        key: barrierKey,
        nodeId: barrierNodeId,
        states: ["False", "True"],
        metadata: {
          builder: "flood_buildings",
          kind: "barrier_state",
          building_id: buildingId,
          true_means: "barrier_failed",
        },
        parentIds: barrierParentIds,
        cpdGenerator: barrierCpdGenerator,
      });
      context.registry.register(barrierKey, barrierNodeId);

      const interiorStatesRef = strip(text(getValueOr(item, "interior_states_ref", this.interiorStatesRef())));
      const interiorStates = context.discretization.states(interiorStatesRef);
      const rawInteriorNoneLabel = strip(
        text(getValueOr(item, "interior_none_state_label", this.depthNoneStateLabel())),
      );
      const interiorNoneLabel = rawInteriorNoneLabel.length > 0 ? rawInteriorNoneLabel : this.depthNoneStateLabel();
      const interiorCenters = this.resolveInteriorCenters(
        context,
        item,
        interiorStates,
        interiorNoneLabel,
        interiorStatesRef,
      );
      const interiorNoneIndex = FloodBuildingsBuilder.findStateIndex(interiorStates, interiorNoneLabel);

      const interiorMapping = this.resolveInteriorMapping(item, buildingId, interiorStates, interiorNoneIndex);

      const rawInteriorKey = strip(text(getValueOr(item, "interior_key", "")));
      const interiorKey = rawInteriorKey.length > 0 ? rawInteriorKey : this.interiorKey(buildingId);
      const rawInteriorNodeId = strip(text(getValueOr(item, "interior_node_id", "")));
      const interiorNodeId = rawInteriorNodeId.length > 0 ? rawInteriorNodeId : this.defaultInteriorNodeId(buildingId);

      const interiorCpdGenerator = this.makeInteriorCpdGenerator({
        areaKey,
        barrierKey,
        areaNoneLabel,
        areaCenters,
        interiorCenters,
        interiorNoneIndex,
        interiorMapping,
        allowExtraParents: truthy(getValueOr(item, "allow_extra_interior_parents", false)),
      });

      context.model.addNode({
        key: interiorKey,
        nodeId: interiorNodeId,
        states: interiorStates,
        metadata: {
          builder: "flood_buildings",
          kind: "interior_depth",
          building_id: buildingId,
        },
        parentIds: [areaNodeId, barrierNodeId],
        cpdGenerator: interiorCpdGenerator,
      });
      context.registry.register(interiorKey, interiorNodeId);

      buildingsMeta.set(buildingId, { interiorKey, interiorNodeId, interiorCenters });
    }

    for (const item of this.insideSscItems()) {
      const sscId = FloodBuildingsBuilder.requireText(getValue(item, "ssc_id"), "inside_sscs[].ssc_id");
      const buildingId = FloodBuildingsBuilder.requireText(
        getValue(item, "building_id"),
        `inside_sscs[${sscId}].building_id`,
      );
      const building = buildingsMeta.get(buildingId);
      if (building === undefined) {
        throw valueError(`Inside SSC '${sscId}' references unknown building_id '${buildingId}'.`);
      }

      const theta = FloodBuildingsBuilder.requirePositiveFloat(getValue(item, "theta"), `inside_sscs[${sscId}].theta`);
      const beta = FloodBuildingsBuilder.requirePositiveFloat(getValue(item, "beta"), `inside_sscs[${sscId}].beta`);

      const rawDamageKey = strip(text(getValueOr(item, "key", "")));
      const damageKey = rawDamageKey.length > 0 ? rawDamageKey : this.insideDamageKey(sscId);
      const rawDamageNodeId = strip(text(getValueOr(item, "node_id", "")));
      const damageNodeId = rawDamageNodeId.length > 0 ? rawDamageNodeId : this.defaultInsideDamageNodeId(sscId);

      const failProbabilities = building.interiorCenters.map((center) =>
        FloodBuildingsBuilder.fragilityFailProbability(center, theta, beta),
      );
      FloodBuildingsBuilder.checkMonotonic(failProbabilities, sscId);

      const damageCpdGenerator = FloodBuildingsBuilder.makeInsideDamageCpdGenerator(
        building.interiorKey,
        failProbabilities,
        truthy(getValueOr(item, "allow_extra_parents", false)),
      );

      context.model.addNode({
        key: damageKey,
        nodeId: damageNodeId,
        states: ["False", "True"],
        metadata: {
          builder: "flood_buildings",
          kind: "inside_damage",
          ssc_id: sscId,
          building_id: buildingId,
          theta,
          beta,
          true_means: "failure",
        },
        parentIds: [building.interiorNodeId],
        cpdGenerator: damageCpdGenerator,
      });
      context.registry.register(damageKey, damageNodeId);
    }
  }

  private makeBarrierCpdGenerator(input: BarrierGeneratorInput): CpdGenerator {
    const areaKey = input.areaKey;
    const areaNoneLabel = input.areaNoneLabel;
    const pgaNoneLabel = input.pgaNoneLabel;
    const frozenAreaCenters = Array.from(input.areaCenters);
    const frozenPgaCenters = Array.from(input.pgaCenters);
    const frozenModelConfig = { ...input.modelConfig };
    const frozenPgaKey = input.pgaKey;
    const frozenAllowExtra = input.allowExtraParents;

    return (localContext: ModelContext, node: NodeRecord): number[] => {
      const areaParentId = localContext.registry.nodeId(areaKey);
      if (!node.parents.includes(areaParentId)) {
        throw valueError(`Node '${node.nodeId}' missing required exterior depth parent '${areaParentId}'.`);
      }

      let pgaParentId: string | null = null;
      if (frozenPgaKey !== null) {
        pgaParentId = localContext.registry.nodeId(frozenPgaKey);
        if (!node.parents.includes(pgaParentId)) {
          throw valueError(`Node '${node.nodeId}' missing required PGA parent '${pgaParentId}'.`);
        }
      }

      if (!frozenAllowExtra) {
        const extras = node.parents.filter((parentId) => parentId !== areaParentId && parentId !== pgaParentId);
        if (extras.length > 0) {
          throw valueError(
            `Node '${node.nodeId}' has unexpected extra parents ${repr(extras)}. ` +
              "Remove the coupling or set allow_extra_barrier_parents=true.",
          );
        }
      }

      const areaStates = localContext.model.node(areaParentId).states;
      if (areaStates.length !== frozenAreaCenters.length) {
        throw valueError(`Area states/centers mismatch for barrier node '${node.nodeId}'.`);
      }

      let pgaStates: string[] = [pgaNoneLabel];
      if (pgaParentId !== null) {
        pgaStates = localContext.model.node(pgaParentId).states;
        if (pgaStates.length !== frozenPgaCenters.length) {
          throw valueError(`PGA states/centers mismatch for barrier node '${node.nodeId}'.`);
        }
      }

      const dimensions = node.parents.map((parentId) => localContext.model.card(parentId));
      const areaPosition = node.parents.indexOf(areaParentId);
      const pgaPosition = pgaParentId !== null ? node.parents.indexOf(pgaParentId) : null;

      const rows = localContext.model.parentConfigurationCount(node.nodeId);
      const output: number[] = [];

      for (let rowIndex = 0; rowIndex < rows; rowIndex += 1) {
        const indexes = decodeRowIndex(rowIndex, dimensions);
        const areaIndex = indexes[areaPosition];
        const areaState = areaStates[areaIndex];
        const areaDepth = frozenAreaCenters[areaIndex];

        const depthProbability = FloodBuildingsBuilder.barrierFailFromDepth(
          largerOf(0, areaDepth),
          areaState,
          areaNoneLabel,
          frozenModelConfig,
        );

        let pgaProbability = 0;
        if (pgaPosition !== null) {
          const pgaIndex = indexes[pgaPosition];
          const pgaState = pgaStates[pgaIndex];
          const pgaValue = frozenPgaCenters[pgaIndex];
          pgaProbability = FloodBuildingsBuilder.barrierFailFromPga(
            largerOf(0, pgaValue),
            pgaState,
            pgaNoneLabel,
            frozenModelConfig,
          );
        }

        const failProbability = FloodBuildingsBuilder.clamp01(1 - (1 - depthProbability) * (1 - pgaProbability));
        output.push(1 - failProbability, failProbability);
      }

      return output;
    };
  }

  private makeInteriorCpdGenerator(input: InteriorGeneratorInput): CpdGenerator {
    const areaKey = input.areaKey;
    const barrierKey = input.barrierKey;
    const areaNoneLabel = input.areaNoneLabel;
    const interiorNoneIndex = input.interiorNoneIndex;
    const frozenAreaCenters = Array.from(input.areaCenters);
    const frozenInteriorCenters = Array.from(input.interiorCenters);
    const frozenMapping = { ...input.interiorMapping };
    const frozenAllowExtra = input.allowExtraParents;

    return (localContext: ModelContext, node: NodeRecord): number[] => {
      const areaParentId = localContext.registry.nodeId(areaKey);
      const barrierParentId = localContext.registry.nodeId(barrierKey);
      if (!node.parents.includes(areaParentId)) {
        throw valueError(`Node '${node.nodeId}' missing required exterior depth parent '${areaParentId}'.`);
      }
      if (!node.parents.includes(barrierParentId)) {
        throw valueError(`Node '${node.nodeId}' missing required barrier parent '${barrierParentId}'.`);
      }

      if (!frozenAllowExtra) {
        const extras = node.parents.filter((parentId) => parentId !== areaParentId && parentId !== barrierParentId);
        if (extras.length > 0) {
          throw valueError(
            `Node '${node.nodeId}' has unexpected extra parents ${repr(extras)}. ` +
              "Remove the coupling or set allow_extra_interior_parents=true.",
          );
        }
      }

      const areaStates = localContext.model.node(areaParentId).states;
      const barrierStates = localContext.model.node(barrierParentId).states;
      if (areaStates.length !== frozenAreaCenters.length) {
        throw valueError(`Area states/centers mismatch for interior node '${node.nodeId}'.`);
      }
      if (node.states.length !== frozenInteriorCenters.length) {
        throw valueError(`Interior states/centers mismatch for node '${node.nodeId}'.`);
      }

      const dimensions = node.parents.map((parentId) => localContext.model.card(parentId));
      const areaPosition = node.parents.indexOf(areaParentId);
      const barrierPosition = node.parents.indexOf(barrierParentId);
      const rows = localContext.model.parentConfigurationCount(node.nodeId);
      const output: number[] = [];

      const mode = frozenMapping.mode;
      const scale = frozenMapping.scale;
      const intactDistribution = Array.from(frozenMapping.intactDistribution);

      for (let rowIndex = 0; rowIndex < rows; rowIndex += 1) {
        const indexes = decodeRowIndex(rowIndex, dimensions);
        const areaIndex = indexes[areaPosition];
        const barrierIndex = indexes[barrierPosition];
        const areaState = areaStates[areaIndex];
        const areaDepth = largerOf(0, frozenAreaCenters[areaIndex]);
        const barrierFailed = barrierStates[barrierIndex] === "True";

        let distribution: number[];
        if (!barrierFailed) {
          distribution = intactDistribution;
        } else {
          let mappedDepth = areaState === areaNoneLabel ? 0 : areaDepth;
          if (mode === "scaled") mappedDepth *= scale;
          distribution = FloodBuildingsBuilder.valueToDepthDistribution(
            mappedDepth,
            frozenInteriorCenters,
            interiorNoneIndex,
          );
        }
        for (const probability of distribution) output.push(probability);
      }
      return output;
    };
  }

  private static makeInsideDamageCpdGenerator(
    interiorKey: string,
    failProbabilities: readonly number[],
    allowExtraParents: boolean,
  ): CpdGenerator {
    const frozenFailProbabilities = Array.from(failProbabilities);
    const frozenAllowExtra = allowExtraParents;

    return (localContext: ModelContext, node: NodeRecord): number[] => {
      const interiorParentId = localContext.registry.nodeId(interiorKey);
      if (!node.parents.includes(interiorParentId)) {
        throw valueError(`Node '${node.nodeId}' missing required interior depth parent '${interiorParentId}'.`);
      }
      if (!frozenAllowExtra) {
        const extras = node.parents.filter((parentId) => parentId !== interiorParentId);
        if (extras.length > 0) {
          throw valueError(
            `Node '${node.nodeId}' has unexpected extra parents ${repr(extras)}. ` +
              "Remove the coupling or set allow_extra_parents=true for this SSC.",
          );
        }
      }

      const dimensions = node.parents.map((parentId) => localContext.model.card(parentId));
      const interiorPosition = node.parents.indexOf(interiorParentId);
      const rows = localContext.model.parentConfigurationCount(node.nodeId);
      const output: number[] = [];

      for (let rowIndex = 0; rowIndex < rows; rowIndex += 1) {
        const failProbability = frozenFailProbabilities[decodeRowIndex(rowIndex, dimensions)[interiorPosition]];
        output.push(1 - failProbability);
        output.push(failProbability);
      }
      return output;
    };
  }

  private resolveBarrierModel(item: SpecMapping, buildingId: string): BarrierModel {
    let raw = getValueOr(item, "barrier_model", {});
    if (raw === null) raw = {};
    if (!isMapping(raw)) {
      throw valueError(`flood_buildings.buildings[${buildingId}].barrier_model must be an object/mapping.`);
    }

    const modelType = strip(text(getValueOr(raw, "type", "threshold"))).toLowerCase();
    const output: BarrierModel = {
      type: modelType,
      failIfDepthExceeds: 0,
      failProbBelow: 0,
      failProbExceeded: 0,
      failProbNone: 0,
      theta: 0,
      beta: 0,
      failProbFloor: 0,
      usePga: false,
      pgaTheta: 0,
      pgaBeta: 0,
    };

    if (modelType === "threshold") {
      output.failIfDepthExceeds = FloodBuildingsBuilder.requireNonNegativeFloat(
        getValue(raw, "fail_if_depth_exceeds"),
        `buildings[${buildingId}].barrier_model.fail_if_depth_exceeds`,
      );
      output.failProbBelow = FloodBuildingsBuilder.clamp01(toFloat(getValueOr(raw, "fail_prob_below", 0)));
      output.failProbExceeded = FloodBuildingsBuilder.clamp01(toFloat(getValueOr(raw, "fail_prob_exceeded", 1)));
      output.failProbNone = FloodBuildingsBuilder.clamp01(
        toFloat(getValueOr(raw, "fail_prob_none", output.failProbBelow)),
      );
    } else if (modelType === "fragility") {
      output.theta = FloodBuildingsBuilder.requirePositiveFloat(
        getValue(raw, "theta"),
        `buildings[${buildingId}].barrier_model.theta`,
      );
      output.beta = FloodBuildingsBuilder.requirePositiveFloat(
        getValue(raw, "beta"),
        `buildings[${buildingId}].barrier_model.beta`,
      );
      output.failProbFloor = FloodBuildingsBuilder.clamp01(toFloat(getValueOr(raw, "fail_prob_floor", 0)));
    } else {
      throw valueError(
        `Unsupported barrier_model.type '${modelType}' for building '${buildingId}'. ` +
          "Use 'threshold' or 'fragility'.",
      );
    }

    const pgaFragility = getValue(raw, "pga_fragility");
    const includePgaParent = truthy(getValueOr(raw, "include_pga_parent", false));
    if (pgaFragility === null) {
      if (includePgaParent) {
        throw valueError(
          `Building '${buildingId}' sets include_pga_parent=true but does not provide ` +
            "barrier_model.pga_fragility. This would create a silent invariance parent.",
        );
      }
      output.usePga = false;
      return output;
    }

    if (!isMapping(pgaFragility)) {
      throw valueError(`buildings[${buildingId}].barrier_model.pga_fragility must be an object/mapping.`);
    }
    output.usePga = true;
    output.pgaTheta = FloodBuildingsBuilder.requirePositiveFloat(
      getValue(pgaFragility, "theta"),
      `buildings[${buildingId}].barrier_model.pga_fragility.theta`,
    );
    output.pgaBeta = FloodBuildingsBuilder.requirePositiveFloat(
      getValue(pgaFragility, "beta"),
      `buildings[${buildingId}].barrier_model.pga_fragility.beta`,
    );
    return output;
  }

  private static barrierFailFromDepth(
    depth: number,
    stateLabel: string,
    noneLabel: string,
    modelConfig: BarrierModel,
  ): number {
    if (modelConfig.type === "threshold") {
      if (stateLabel === noneLabel) return FloodBuildingsBuilder.clamp01(modelConfig.failProbNone);
      if (depth > modelConfig.failIfDepthExceeds) return FloodBuildingsBuilder.clamp01(modelConfig.failProbExceeded);
      return FloodBuildingsBuilder.clamp01(modelConfig.failProbBelow);
    }
    const floor = FloodBuildingsBuilder.clamp01(modelConfig.failProbFloor);
    const probability = FloodBuildingsBuilder.fragilityFailProbability(depth, modelConfig.theta, modelConfig.beta);
    return FloodBuildingsBuilder.clamp01(largerOf(floor, probability));
  }

  private static barrierFailFromPga(
    pga: number,
    stateLabel: string,
    noneLabel: string,
    modelConfig: BarrierModel,
  ): number {
    if (!modelConfig.usePga) return 0;
    if (stateLabel === noneLabel) return 0;
    return FloodBuildingsBuilder.fragilityFailProbability(pga, modelConfig.pgaTheta, modelConfig.pgaBeta);
  }

  private resolveInteriorMapping(
    item: SpecMapping,
    buildingId: string,
    interiorStates: readonly string[],
    interiorNoneIndex: number | null,
  ): InteriorMapping {
    let raw = getValueOr(item, "interior_mapping", {});
    if (raw === null) raw = {};
    if (!isMapping(raw)) {
      throw valueError(`flood_buildings.buildings[${buildingId}].interior_mapping must be an object/mapping.`);
    }

    const mode = strip(text(getValueOr(raw, "mode", "identity"))).toLowerCase();
    if (mode !== "identity" && mode !== "scaled") {
      throw valueError(
        `Unsupported interior_mapping.mode '${mode}' for building '${buildingId}'. ` + "Use 'identity' or 'scaled'.",
      );
    }
    const scale = FloodBuildingsBuilder.requireNonNegativeFloat(
      getValueOr(raw, "scale", 1),
      `buildings[${buildingId}].interior_mapping.scale`,
    );

    const intactDistribution = FloodBuildingsBuilder.resolveIntactDistribution(
      raw,
      interiorStates,
      interiorNoneIndex,
      buildingId,
    );

    return { mode, scale, intactDistribution };
  }

  private static resolveIntactDistribution(
    raw: SpecMapping,
    interiorStates: readonly string[],
    interiorNoneIndex: number | null,
    buildingId: string,
  ): number[] {
    const values = getValue(raw, "intact_distribution");
    const count = interiorStates.length;
    if (values === null) {
      const output = new Array<number>(count).fill(0);
      output[interiorNoneIndex === null ? 0 : interiorNoneIndex] = 1;
      return output;
    }

    if (!isSequence(values)) {
      throw valueError(`buildings[${buildingId}].interior_mapping.intact_distribution must be list-like.`);
    }
    const probabilities = values.map((value) => toFloat(value));
    if (probabilities.length !== count) {
      throw valueError(
        `buildings[${buildingId}].interior_mapping.intact_distribution length ${probabilities.length} ` +
          `must match interior state count ${count}.`,
      );
    }
    if (probabilities.some((probability) => probability < -1e-12 || probability > 1 + 1e-12)) {
      throw valueError(`buildings[${buildingId}].interior_mapping.intact_distribution values must be in [0,1].`);
    }
    const total = sum(probabilities);
    if (Math.abs(total - 1) > 1e-9) {
      throw valueError(
        `buildings[${buildingId}].interior_mapping.intact_distribution must sum to 1.0 ` +
          `(got ${formatGeneral(total, 12)}).`,
      );
    }
    return probabilities;
  }

  private resolveAreaCenters(
    context: ModelContext,
    item: SpecMapping,
    areaStates: readonly string[],
    areaNoneLabel: string,
  ): number[] {
    const raw = getValue(item, "area_bin_centers");
    let values: number[];
    if (raw === null) {
      const reference = strip(text(getValueOr(item, "area_states_ref", this.siteDepthStatesRef())));
      values = context.discretization.centers(reference);
    } else {
      if (!isSequence(raw)) throw valueError("buildings[].area_bin_centers must be list-like when provided.");
      values = raw.map((value) => toFloat(value));
    }
    return FloodBuildingsBuilder.mapCentersToStates(areaStates, areaNoneLabel, values, "buildings[].area_bin_centers");
  }

  private resolveInteriorCenters(
    context: ModelContext,
    item: SpecMapping,
    interiorStates: readonly string[],
    interiorNoneLabel: string,
    interiorStatesRef: string,
  ): number[] {
    const raw = getValue(item, "interior_bin_centers");
    let values: number[];
    if (raw === null) {
      values = context.discretization.centers(interiorStatesRef);
    } else {
      if (!isSequence(raw)) throw valueError("buildings[].interior_bin_centers must be list-like when provided.");
      values = raw.map((value) => toFloat(value));
    }
    return FloodBuildingsBuilder.mapCentersToStates(
      interiorStates,
      interiorNoneLabel,
      values,
      "buildings[].interior_bin_centers",
    );
  }

  private resolvePgaCenters(context: ModelContext, pgaStates: readonly string[]): number[] {
    const raw = getValue(this.config, "pga_bin_centers");
    let values: number[];
    if (raw === null) {
      values = context.discretization.centers(this.pgaStatesRef());
    } else {
      if (!isSequence(raw)) throw valueError("flood_buildings.pga_bin_centers must be list-like when provided.");
      values = raw.map((value) => toFloat(value));
    }
    return FloodBuildingsBuilder.mapCentersToStates(
      pgaStates,
      this.pgaNoneStateLabel(),
      values,
      "flood_buildings.pga_bin_centers",
    );
  }

  private static valueToDepthDistribution(
    value: number,
    centers: readonly number[],
    noneIndex: number | null,
  ): number[] {
    const count = centers.length;
    if (count === 0) throw valueError("Depth centers cannot be empty.");
    let chosen: number;
    if (value <= 0) {
      chosen = noneIndex === null ? 0 : noneIndex;
    } else {
      let candidates = centers.map((_center, index) => index);
      if (noneIndex !== null) {
        candidates = candidates.filter((index) => index !== noneIndex);
        if (candidates.length === 0) candidates = [noneIndex];
      }
      chosen = candidates[0];
      let chosenDistance = Math.abs(centers[chosen] - value);
      for (const candidate of candidates.slice(1)) {
        const distance = Math.abs(centers[candidate] - value);
        if (distance < chosenDistance) {
          chosen = candidate;
          chosenDistance = distance;
        }
      }
    }
    const output = new Array<number>(count).fill(0);
    output[chosen] = 1;
    return output;
  }

  private static mapCentersToStates(
    states: readonly string[],
    noneLabel: string,
    centers: readonly number[],
    label: string,
  ): number[] {
    if (centers.length === states.length) return Array.from(centers);
    const noneCount = states.filter((state) => state === noneLabel).length;
    if (noneCount === 1 && centers.length === states.length - 1) {
      const output: number[] = [];
      let position = 0;
      for (const state of states) {
        if (state === noneLabel) {
          output.push(0);
        } else {
          output.push(centers[position]);
          position += 1;
        }
      }
      return output;
    }
    throw valueError(
      `${label} length ${centers.length} must match states length ${states.length} ` +
        "(or states-1 when exactly one none state exists).",
    );
  }

  private static fragilityFailProbability(value: number, theta: number, beta: number): number {
    if (value <= 0) return 0;
    return FloodBuildingsBuilder.clamp01(normalCdf(logarithm(value / theta) / beta));
  }

  private static checkMonotonic(values: readonly number[], label: string, tolerance = 1e-12): void {
    for (let index = 1; index < values.length; index += 1) {
      if (values[index] + tolerance < values[index - 1]) {
        throw valueError(
          `Non-monotonic flood inside fragility for '${label}' at bins ${index - 1}->${index}: ` +
            `${formatGeneral(values[index - 1], 6)} -> ${formatGeneral(values[index], 6)}`,
        );
      }
    }
  }

  private static findStateIndex(states: readonly string[], stateName: string): number | null {
    const index = states.indexOf(stateName);
    return index >= 0 ? index : null;
  }

  private resolveAreaKey(item: SpecMapping, buildingId: string): string {
    const hasAreaId = hasKey(item, "area_id");
    const hasAreaKey = hasKey(item, "area_key");
    if (hasAreaId && hasAreaKey) {
      throw valueError(`Building '${buildingId}' sets both area_id and area_key. Use exactly one.`);
    }
    if (!hasAreaId && !hasAreaKey) {
      throw valueError(`Building '${buildingId}' must define either area_id or area_key.`);
    }
    if (hasAreaKey) {
      return FloodBuildingsBuilder.requireText(getValue(item, "area_key"), `buildings[${buildingId}].area_key`);
    }
    const areaId = FloodBuildingsBuilder.requireText(getValue(item, "area_id"), `buildings[${buildingId}].area_id`);
    return this.siteDepthKey(areaId);
  }

  private buildingUsesPga(item: SpecMapping): boolean {
    const raw = getValueOr(item, "barrier_model", {});
    if (!isMapping(raw)) return false;
    return truthy(getValueOr(raw, "include_pga_parent", false)) || getValue(raw, "pga_fragility") !== null;
  }

  private pgaKey(): string {
    return strip(text(getValueOr(this.config, "pga_key", "hazard.seismic.PGA")));
  }

  private pgaStatesRef(): string {
    return strip(text(getValueOr(this.config, "pga_states_ref", "PGA")));
  }

  private pgaNoneStateLabel(): string {
    const label = strip(text(getValueOr(this.config, "pga_none_state_label", "None")));
    return label.length > 0 ? label : "None";
  }

  private siteDepthStatesRef(): string {
    return strip(text(getValueOr(this.config, "site_depth_states_ref", "SITE_DEPTH")));
  }

  private interiorStatesRef(): string {
    return strip(text(getValueOr(this.config, "interior_depth_states_ref", this.siteDepthStatesRef())));
  }

  private depthNoneStateLabel(): string {
    const label = strip(text(getValueOr(this.config, "depth_none_state_label", "None")));
    return label.length > 0 ? label : "None";
  }

  private barrierKey(buildingId: string): string {
    return `flood.barrier.${buildingId}.state`;
  }

  private defaultBarrierNodeId(buildingId: string): string {
    return `FLOOD_BARRIER_${slug(buildingId).toUpperCase()}_FAIL`;
  }

  private interiorKey(buildingId: string): string {
    return `flood.interior.depth.${buildingId}`;
  }

  private defaultInteriorNodeId(buildingId: string): string {
    return `FLOOD_INTERIOR_DEPTH_${slug(buildingId).toUpperCase()}`;
  }

  private siteDepthKey(areaId: string): string {
    return `flood.site.depth_at.${areaId}`;
  }

  private insideDamageKey(sscId: string): string {
    return `flood.damage_inside.${sscId}`;
  }

  private defaultInsideDamageNodeId(sscId: string): string {
    return `FLOOD_FAIL_${slug(sscId).toUpperCase()}_INSIDE`;
  }

  private buildingItems(): SpecMapping[] {
    const raw = getValue(this.config, "buildings");
    if (!isSequence(raw) || raw.length === 0) {
      throw valueError("flood_buildings builder requires non-empty 'buildings' list.");
    }
    return raw.map((item, index) => {
      if (!isMapping(item)) throw valueError(`flood_buildings.buildings[${index}] must be an object/mapping.`);
      return item;
    });
  }

  private insideSscItems(): SpecMapping[] {
    const raw = getValueOr(this.config, "inside_sscs", []);
    if (!isSequence(raw)) throw valueError("flood_buildings.inside_sscs must be list-like.");
    return raw.map((item, index) => {
      if (!isMapping(item)) throw valueError(`flood_buildings.inside_sscs[${index}] must be an object/mapping.`);
      return item;
    });
  }

  private static clamp01(value: number): number {
    if (value < 0) return 0;
    if (value > 1) return 1;
    return value;
  }

  private static requireText(value: SpecValue, label: string): string {
    if (typeof value !== "string" || strip(value).length === 0) {
      throw valueError(`flood_buildings.${label} must be a non-empty string.`);
    }
    return strip(value);
  }

  private static parseNumeric(value: SpecValue, label: string): number {
    try {
      return toFloat(value);
    } catch (error) {
      if (error instanceof NetworkBuilderError) throw valueError(`flood_buildings.${label} must be numeric.`);
      throw error;
    }
  }

  private static requirePositiveFloat(value: SpecValue, label: string): number {
    const parsed = FloodBuildingsBuilder.parseNumeric(value, label);
    if (parsed <= 0) throw valueError(`flood_buildings.${label} must be > 0.`);
    return parsed;
  }

  private static requireNonNegativeFloat(value: SpecValue, label: string): number {
    const parsed = FloodBuildingsBuilder.parseNumeric(value, label);
    if (parsed < 0) throw valueError(`flood_buildings.${label} must be >= 0.`);
    return parsed;
  }
}

export { FloodBuildingsBuilder };
