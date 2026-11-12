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
  keysOf,
  replaceNonAlphanumericRuns,
  repr,
  sortedText,
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

const larger = (first: number, second: number): number => (second > first ? second : first);

const smaller = (first: number, second: number): number => (second < first ? second : first);

const BOOL_STATES = ["False", "True"];

interface IgnitionSource {
  localDamage: boolean;
  sourceId: string;
  damageParentKey: string;
  damageNodeId: string;
  damageFragilityTheta: number;
  damageFragilityBeta: number;
  damageProbFloor: number;
  damageProbCap: number;
  damageProbWhenPgaNone: number;
  damageTrueState: string;
  ignitionGivenDamage: number;
  ignitionGivenNoDamage: number;
  allowExtraDamageParents: boolean;
}

interface IgnitionConfig {
  usePga: boolean;
  probabilities: number[];
  givenPga: Map<string, number[]>;
}

interface AutoSuppressionConfig {
  usePga: boolean;
  successGivenIgnition: number;
  successGivenIgnitionByPga: Map<string, number>;
}

interface BrigadeConfig {
  mode: string;
  probabilities: number[];
  givenPga: Map<string, number[]>;
  givenPgaAndDepth: Map<string, Map<string, number[]>>;
}

interface ZoneRecord {
  hrrKey: string;
  hrrNodeId: string;
  hrrStates: string[];
  hrrOrder: string[];
  hrrNoneLabel: string;
}

interface SourceRuntime {
  parentId: string;
  trueIndex: number;
  ignitionGivenDamage: number;
  ignitionGivenNoDamage: number;
}

interface FragilityPair {
  theta: number;
  beta: number;
}

interface IgnitionGeneratorInput {
  pgaKey: string | null;
  unconditionalProbabilities: readonly number[];
  givenPga: Map<string, number[]>;
  ignitionSources: readonly IgnitionSource[];
  allowExtraParents: boolean;
}

interface AutoSuppressionGeneratorInput {
  ignitionKey: string;
  pgaKey: string | null;
  successGivenIgnition: number;
  successGivenIgnitionByPga: Map<string, number>;
  allowExtraParents: boolean;
}

interface BrigadeGeneratorInput {
  mode: string;
  pgaKey: string | null;
  accessKey: string | null;
  depthKey: string | null;
  noArrivalState: string;
  unconditionalProbabilities: readonly number[];
  givenPga: Map<string, number[]>;
  givenPgaAndDepth: Map<string, Map<string, number[]>>;
  allowExtraParents: boolean;
}

interface HrrGeneratorInput {
  ignitionKey: string;
  autoSuppressionKey: string;
  brigadeKey: string;
  hrrNoneIndex: number;
  autoSuppressionHrrIndex: number;
  hrrGivenBrigadeUnsuppressed: Map<string, number[]>;
  allowExtraParents: boolean;
}

const copyRows = (rows: Map<string, number[]>): Map<string, number[]> => {
  const output = new Map<string, number[]>();
  for (const [key, row] of rows) output.set(key, Array.from(row));
  return output;
};

const textOr = (mapping: SpecMapping, key: string, fallback: string): string => {
  const value = strip(text(getValueOr(mapping, key, "")));
  return value.length > 0 ? value : fallback;
};

const pushAll = (target: number[], values: readonly number[]): void => {
  for (const value of values) target.push(value);
};

class FireBuilder extends BuilderBase {
  get builderType(): string {
    return "fire";
  }

  get requires(): Set<string> {
    const required = new Set(iterValues(getValueOr(this.config, "requires", [])).map((item) => text(item)));
    for (const zone of this.zoneItems()) {
      const zoneId = FireBuilder.requireText(getValue(zone, "zone_id"), "zones[].zone_id");
      const ignitionSources = this.resolveIgnitionSources(zone, zoneId);
      const floodDepthKey = this.zoneFloodDepthKey(zone, zoneId);
      if (floodDepthKey !== null) required.add(floodDepthKey);
      if (FireBuilder.zoneUsesPgaForBrigade(zone)) required.add(this.pgaKey());
      if (FireBuilder.zoneUsesPgaForIgnition(zone)) required.add(this.pgaKey());
      if (FireBuilder.zoneUsesPgaForAutoSuppression(zone)) required.add(this.pgaKey());
      if (FireBuilder.usesPgaForIgnitionSourceDamage(ignitionSources)) required.add(this.pgaKey());
      for (const source of ignitionSources) {
        if (source.localDamage) continue;
        required.add(source.damageParentKey);
      }
      const rawRequires = getValueOr(zone, "requires", []);
      if (rawRequires !== null) {
        if (!isSequence(rawRequires)) throw valueError(`fire.zones[${zoneId}].requires must be list-like.`);
        for (const item of rawRequires) required.add(text(item));
      }
    }
    return required;
  }

  get provides(): Set<string> {
    const output = new Set<string>();
    for (const zone of this.zoneItems()) {
      const zoneId = FireBuilder.requireText(getValue(zone, "zone_id"), "zones[].zone_id");
      const ignitionSources = this.resolveIgnitionSources(zone, zoneId);
      output.add(textOr(zone, "ignition_key", FireBuilder.ignitionKey(zoneId)));
      output.add(textOr(zone, "auto_suppression_key", FireBuilder.autoSuppressionKey(zoneId)));
      if (this.zoneFloodDepthKey(zone, zoneId) !== null) {
        output.add(textOr(zone, "zone_accessible_key", FireBuilder.zoneAccessKey(zoneId)));
      }
      output.add(textOr(zone, "brigade_key", FireBuilder.brigadeKey(zoneId)));
      output.add(textOr(zone, "effective_hrr_key", FireBuilder.hrrKey(zoneId)));
      for (const source of ignitionSources) {
        if (source.localDamage) output.add(source.damageParentKey);
      }
    }
    for (const ssc of this.sscItems()) {
      const sscId = FireBuilder.requireText(getValue(ssc, "ssc_id"), "sscs[].ssc_id");
      output.add(textOr(ssc, "key", FireBuilder.damageKey(sscId)));
    }
    return output;
  }

  build(context: ModelContext): void {
    const pgaKey = this.pgaKey();
    const pgaAvailable = context.registry.hasKey(pgaKey);
    const pgaNoneLabel = this.pgaNoneStateLabel();

    let pgaNodeId: string | null = null;
    let pgaStates: string[];
    if (pgaAvailable) {
      pgaNodeId = context.registry.nodeId(pgaKey);
      pgaStates = context.model.node(pgaNodeId).states;
    } else {
      pgaStates = [pgaNoneLabel];
    }

    let needsPgaStateValues = false;
    for (const zone of this.zoneItems()) {
      if (
        truthy(getValue(zone, "ignition_fragility_given_pga")) ||
        truthy(getValue(zone, "auto_suppression_fragility_given_pga")) ||
        FireBuilder.usesPgaForIgnitionSourceDamage(
          this.resolveIgnitionSources(zone, FireBuilder.requireText(getValue(zone, "zone_id"), "zones[].zone_id")),
        )
      ) {
        needsPgaStateValues = true;
        break;
      }
    }
    let pgaStateValues = new Map<string, number>();
    if (needsPgaStateValues) {
      if (!pgaAvailable) {
        throw valueError(
          "fire PGA fragility-driven ignition/auto-suppression requires seismic PGA node, " + "but PGA is unavailable.",
        );
      }
      pgaStateValues = this.resolvePgaStateValues(context, pgaStates, pgaNoneLabel);
    }

    const zoneRecords = new Map<string, ZoneRecord>();

    for (const zone of this.zoneItems()) {
      const zoneId = FireBuilder.requireText(getValue(zone, "zone_id"), "zones[].zone_id");
      if (zoneRecords.has(zoneId)) throw valueError(`Duplicate fire zone_id '${zoneId}'.`);

      const ignitionKey = textOr(zone, "ignition_key", FireBuilder.ignitionKey(zoneId));
      const ignitionNodeId = textOr(zone, "ignition_node_id", FireBuilder.defaultIgnitionNodeId(zoneId));
      const ignitionSources = this.resolveIgnitionSources(zone, zoneId);
      if (FireBuilder.usesPgaForIgnitionSourceDamage(ignitionSources)) {
        if (!pgaAvailable || pgaNodeId === null) {
          throw valueError(
            `fire zone '${zoneId}' ignition source fragility requires seismic PGA node, ` +
              "but PGA node is unavailable.",
          );
        }
        for (const source of ignitionSources) {
          if (!source.localDamage) continue;
          const sourceDamageKey = source.damageParentKey;
          const sourceDamageNodeId = source.damageNodeId;
          if (context.registry.hasKey(sourceDamageKey)) {
            throw valueError(
              `fire zone '${zoneId}' local ignition source damage key ` +
                `'${sourceDamageKey}' already exists in the registry.`,
            );
          }
          const sourceGivenPga = FireBuilder.resolveSourceDamageGivenPga(
            source,
            zoneId,
            pgaStates,
            pgaNoneLabel,
            pgaStateValues,
          );
          context.model.addNode({
            key: sourceDamageKey,
            nodeId: sourceDamageNodeId,
            states: BOOL_STATES,
            metadata: {
              builder: "fire",
              kind: "ignition_source_damage",
              zone_id: zoneId,
              source_id: source.sourceId,
              true_means: "source_damage",
            },
            parentIds: [pgaNodeId],
            cpdGenerator: FireBuilder.makeSourceDamageCpdGenerator(
              pgaKey,
              sourceGivenPga,
              source.allowExtraDamageParents,
            ),
          });
          context.registry.register(sourceDamageKey, sourceDamageNodeId);
        }
      }
      const ignitionConfig = this.resolveIgnitionConfig(
        zone,
        zoneId,
        pgaStates,
        pgaNoneLabel,
        pgaStateValues,
        ignitionSources.length > 0,
      );
      const ignitionParentIds: string[] = [];
      if (ignitionConfig.usePga) {
        if (!pgaAvailable || pgaNodeId === null) {
          throw valueError(
            `fire zone '${zoneId}' configured PGA-conditioned ignition but seismic PGA node is unavailable.`,
          );
        }
        ignitionParentIds.push(pgaNodeId);
      }
      for (const source of ignitionSources) {
        const parentKey = source.damageParentKey;
        if (!context.registry.hasKey(parentKey)) {
          throw valueError(`fire zone '${zoneId}' ignition source references missing parent key '${parentKey}'.`);
        }
        const parentId = context.registry.nodeId(parentKey);
        if (!ignitionParentIds.includes(parentId)) ignitionParentIds.push(parentId);
      }

      context.model.addNode({
        key: ignitionKey,
        nodeId: ignitionNodeId,
        states: BOOL_STATES,
        metadata: {
          builder: "fire",
          kind: "ignition",
          zone_id: zoneId,
          true_means: "ignition",
          ignition_source_count: ignitionSources.length,
        },
        parentIds: ignitionParentIds,
        cpdGenerator: FireBuilder.makeIgnitionCpdGenerator({
          pgaKey: ignitionConfig.usePga ? pgaKey : null,
          unconditionalProbabilities: ignitionConfig.probabilities,
          givenPga: ignitionConfig.givenPga,
          ignitionSources,
          allowExtraParents: truthy(getValueOr(zone, "allow_extra_ignition_parents", false)),
        }),
      });
      context.registry.register(ignitionKey, ignitionNodeId);

      const autoKey = textOr(zone, "auto_suppression_key", FireBuilder.autoSuppressionKey(zoneId));
      const autoNodeId = textOr(zone, "auto_suppression_node_id", FireBuilder.defaultAutoSuppressionNodeId(zoneId));
      const autoConfig = this.resolveAutoSuppressionConfig(zone, zoneId, pgaStates, pgaNoneLabel, pgaStateValues);
      const autoParentIds: string[] = [ignitionNodeId];
      if (autoConfig.usePga) {
        if (!pgaAvailable || pgaNodeId === null) {
          throw valueError(
            `fire zone '${zoneId}' configured auto_suppression_fragility_given_pga ` +
              "but seismic PGA node is unavailable.",
          );
        }
        autoParentIds.push(pgaNodeId);
      }

      context.model.addNode({
        key: autoKey,
        nodeId: autoNodeId,
        states: BOOL_STATES,
        metadata: {
          builder: "fire",
          kind: "auto_suppression_success",
          zone_id: zoneId,
          true_means: "auto_suppression_success",
        },
        parentIds: autoParentIds,
        cpdGenerator: FireBuilder.makeAutoSuppressionCpdGenerator({
          ignitionKey,
          pgaKey: autoConfig.usePga ? pgaKey : null,
          successGivenIgnition: autoConfig.successGivenIgnition,
          successGivenIgnitionByPga: autoConfig.successGivenIgnitionByPga,
          allowExtraParents: truthy(getValueOr(zone, "allow_extra_auto_suppression_parents", false)),
        }),
      });
      context.registry.register(autoKey, autoNodeId);

      const floodDepthKey = this.zoneFloodDepthKey(zone, zoneId);
      const accessEnabled = floodDepthKey !== null;
      let accessKey: string | null = null;
      let accessNodeId: string | null = null;
      let depthParentId: string | null = null;
      let depthStates: string[] | null = null;
      if (floodDepthKey !== null) {
        if (!context.registry.hasKey(floodDepthKey)) {
          throw valueError(`fire zone '${zoneId}' references missing flood depth key '${floodDepthKey}'.`);
        }
        depthParentId = context.registry.nodeId(floodDepthKey);
        depthStates = context.model.node(depthParentId).states;

        accessKey = textOr(zone, "zone_accessible_key", FireBuilder.zoneAccessKey(zoneId));
        accessNodeId = textOr(zone, "zone_accessible_node_id", FireBuilder.defaultZoneAccessNodeId(zoneId));
        const accessGivenDepth = FireBuilder.resolveAccessGivenDepth(zone, zoneId, depthStates);
        context.model.addNode({
          key: accessKey,
          nodeId: accessNodeId,
          states: BOOL_STATES,
          metadata: {
            builder: "fire",
            kind: "zone_accessible",
            zone_id: zoneId,
            true_means: "zone_accessible",
          },
          parentIds: [depthParentId],
          cpdGenerator: FireBuilder.makeAccessCpdGenerator(
            floodDepthKey,
            accessGivenDepth,
            truthy(getValueOr(zone, "allow_extra_access_parents", false)),
          ),
        });
        context.registry.register(accessKey, accessNodeId);
      }

      const brigadeStates = this.resolveBrigadeStates(context, zone, zoneId);
      const brigadeConfig = FireBuilder.resolveBrigadeConfig(zone, zoneId, brigadeStates, pgaStates, depthStates);
      const brigadeNoArrivalState = this.resolveBrigadeNoArrivalState(zone);
      const brigadeNoArrivalIndex = FireBuilder.findStateIndex(brigadeStates, brigadeNoArrivalState);
      if (accessEnabled && brigadeNoArrivalIndex === null) {
        throw valueError(
          `fire zone '${zoneId}' has flood/access coupling enabled but brigade state ` +
            `'${brigadeNoArrivalState}' is missing.`,
        );
      }

      const brigadeKey = textOr(zone, "brigade_key", FireBuilder.brigadeKey(zoneId));
      const brigadeNodeId = textOr(zone, "brigade_node_id", FireBuilder.defaultBrigadeNodeId(zoneId));
      const brigadeParentIds: string[] = [];
      if (accessEnabled) {
        if (accessNodeId === null) throw valueError(`fire zone '${zoneId}' access parent is missing.`);
        brigadeParentIds.push(accessNodeId);
      }

      const mode = brigadeConfig.mode;
      const modeUsesPga = mode === "given_pga" || mode === "given_pga_and_depth";
      if (modeUsesPga) {
        if (!pgaAvailable || pgaNodeId === null) {
          throw valueError(
            `fire zone '${zoneId}' requires seismic PGA for brigade conditioning, ` + "but PGA node is unavailable.",
          );
        }
        brigadeParentIds.push(pgaNodeId);
      }
      if (mode === "given_pga_and_depth") {
        if (depthParentId === null || floodDepthKey === null) {
          throw valueError(
            `fire zone '${zoneId}' uses brigade_given_pga_and_depth but flood depth coupling is not configured.`,
          );
        }
        brigadeParentIds.push(depthParentId);
      }

      context.model.addNode({
        key: brigadeKey,
        nodeId: brigadeNodeId,
        states: brigadeStates,
        metadata: {
          builder: "fire",
          kind: "brigade_arrival_bin",
          zone_id: zoneId,
        },
        parentIds: brigadeParentIds,
        cpdGenerator: FireBuilder.makeBrigadeCpdGenerator({
          mode,
          pgaKey: modeUsesPga ? pgaKey : null,
          accessKey: accessEnabled ? accessKey : null,
          depthKey: mode === "given_pga_and_depth" ? floodDepthKey : null,
          noArrivalState: brigadeNoArrivalState,
          unconditionalProbabilities: brigadeConfig.probabilities,
          givenPga: brigadeConfig.givenPga,
          givenPgaAndDepth: brigadeConfig.givenPgaAndDepth,
          allowExtraParents: truthy(getValueOr(zone, "allow_extra_brigade_parents", false)),
        }),
      });
      context.registry.register(brigadeKey, brigadeNodeId);

      const strippedNoneLabel = strip(text(getValueOr(zone, "hrr_none_state_label", this.hrrNoneStateLabel())));
      const hrrNoneLabel = strippedNoneLabel.length > 0 ? strippedNoneLabel : this.hrrNoneStateLabel();
      const hrrStates = this.resolveHrrStates(context, zone, zoneId);
      const hrrOrder = this.resolveHrrOrder(zone, zoneId, hrrStates);
      const hrrNoneIndex = FireBuilder.findStateIndex(hrrStates, hrrNoneLabel);
      if (hrrNoneIndex === null) {
        throw valueError(`fire zone '${zoneId}' HRR states must include none-state label '${hrrNoneLabel}'.`);
      }

      const hrrGivenBrigade = FireBuilder.resolveHrrGivenBrigadeUnsuppressed(zone, zoneId, brigadeStates, hrrStates);
      const autoSuppressionHrrIndex = this.resolveAutoSuppressionHrrStateIndex(
        zone,
        zoneId,
        hrrStates,
        hrrOrder,
        hrrNoneLabel,
      );

      const hrrKey = textOr(zone, "effective_hrr_key", FireBuilder.hrrKey(zoneId));
      const hrrNodeId = textOr(zone, "effective_hrr_node_id", FireBuilder.defaultHrrNodeId(zoneId));

      context.model.addNode({
        key: hrrKey,
        nodeId: hrrNodeId,
        states: hrrStates,
        metadata: {
          builder: "fire",
          kind: "effective_hrr",
          zone_id: zoneId,
        },
        parentIds: [ignitionNodeId, autoNodeId, brigadeNodeId],
        cpdGenerator: FireBuilder.makeEffectiveHrrCpdGenerator({
          ignitionKey,
          autoSuppressionKey: autoKey,
          brigadeKey,
          hrrNoneIndex,
          autoSuppressionHrrIndex,
          hrrGivenBrigadeUnsuppressed: hrrGivenBrigade,
          allowExtraParents: truthy(getValueOr(zone, "allow_extra_hrr_parents", false)),
        }),
      });
      context.registry.register(hrrKey, hrrNodeId);

      zoneRecords.set(zoneId, { hrrKey, hrrNodeId, hrrStates, hrrOrder, hrrNoneLabel });
    }

    for (const ssc of this.sscItems()) {
      const sscId = FireBuilder.requireText(getValue(ssc, "ssc_id"), "sscs[].ssc_id");
      const zoneId = FireBuilder.requireText(getValue(ssc, "zone_id"), `sscs[${sscId}].zone_id`);
      const record = zoneRecords.get(zoneId);
      if (record === undefined) {
        throw valueError(`fire SSC '${sscId}' references unknown zone_id '${zoneId}'.`);
      }

      const damageProbabilities = FireBuilder.resolveDamageGivenHrr(ssc, sscId, record.hrrStates);
      FireBuilder.checkDamageMonotonic(damageProbabilities, record.hrrOrder, record.hrrNoneLabel, sscId);

      const damageKey = textOr(ssc, "key", FireBuilder.damageKey(sscId));
      const damageNodeId = textOr(ssc, "node_id", FireBuilder.defaultDamageNodeId(sscId));

      context.model.addNode({
        key: damageKey,
        nodeId: damageNodeId,
        states: BOOL_STATES,
        metadata: {
          builder: "fire",
          kind: "damage",
          zone_id: zoneId,
          ssc_id: sscId,
          true_means: "damage",
        },
        parentIds: [record.hrrNodeId],
        cpdGenerator: FireBuilder.makeDamageCpdGenerator(
          record.hrrKey,
          damageProbabilities,
          truthy(getValueOr(ssc, "allow_extra_parents", false)),
        ),
      });
      context.registry.register(damageKey, damageNodeId);
    }
  }

  private static makeIgnitionCpdGenerator(input: IgnitionGeneratorInput): CpdGenerator {
    const frozenPgaKey = input.pgaKey;
    const frozenProbabilities = Array.from(input.unconditionalProbabilities);
    const frozenGivenPga = copyRows(input.givenPga);
    const frozenSources = input.ignitionSources.map((source) => ({
      damageParentKey: source.damageParentKey,
      damageTrueState: source.damageTrueState,
      ignitionGivenDamage: FireBuilder.clamp01(source.ignitionGivenDamage),
      ignitionGivenNoDamage: FireBuilder.clamp01(source.ignitionGivenNoDamage),
    }));
    const frozenAllowExtra = input.allowExtraParents;

    return (localContext: ModelContext, node: NodeRecord): number[] => {
      const expectedParents = new Set<string>();
      let pgaStates: string[] = [];
      let pgaPosition = -1;
      if (frozenGivenPga.size > 0) {
        if (frozenPgaKey === null) {
          throw valueError(`Node '${node.nodeId}' has ignition_given_pga config without a PGA key.`);
        }
        const pgaParentId = localContext.registry.nodeId(frozenPgaKey);
        if (!node.parents.includes(pgaParentId)) {
          throw valueError(`Node '${node.nodeId}' missing required PGA parent '${pgaParentId}'.`);
        }
        expectedParents.add(pgaParentId);
        pgaStates = localContext.model.node(pgaParentId).states;
        const missing = pgaStates.filter((state) => !frozenGivenPga.has(state));
        if (missing.length > 0) {
          throw valueError(`Ignition rows missing PGA states ${repr(missing)} for node '${node.nodeId}'.`);
        }
        pgaPosition = node.parents.indexOf(pgaParentId);
      }

      const sourceRuntime: SourceRuntime[] = [];
      for (const source of frozenSources) {
        const parentId = localContext.registry.nodeId(source.damageParentKey);
        if (!node.parents.includes(parentId)) {
          throw valueError(`Node '${node.nodeId}' missing required ignition-source parent '${parentId}'.`);
        }
        const states = localContext.model.node(parentId).states;
        const trueIndex = FireBuilder.findStateIndex(states, source.damageTrueState);
        if (trueIndex === null) {
          throw valueError(
            `Node '${node.nodeId}' source parent '${parentId}' does not contain ` +
              `state '${source.damageTrueState}'.`,
          );
        }
        expectedParents.add(parentId);
        sourceRuntime.push({
          parentId,
          trueIndex,
          ignitionGivenDamage: source.ignitionGivenDamage,
          ignitionGivenNoDamage: source.ignitionGivenNoDamage,
        });
      }

      if (!frozenAllowExtra) {
        const extras = node.parents.filter((parentId) => !expectedParents.has(parentId));
        if (extras.length > 0) {
          throw valueError(
            `Node '${node.nodeId}' has unexpected extra parents ${repr(extras)}. ` +
              "Remove the coupling or set allow_extra_ignition_parents=true.",
          );
        }
      }

      const dimensions = node.parents.map((parentId) => localContext.model.card(parentId));
      const rows = localContext.model.parentConfigurationCount(node.nodeId);
      const output: number[] = [];
      for (let rowIndex = 0; rowIndex < rows; rowIndex += 1) {
        const indexes = decodeRowIndex(rowIndex, dimensions);
        let baseProbability: number;
        if (frozenGivenPga.size > 0) {
          const row = frozenGivenPga.get(pgaStates[indexes[pgaPosition]]) ?? [];
          baseProbability = FireBuilder.clamp01(row[1]);
        } else {
          baseProbability = FireBuilder.clamp01(frozenProbabilities[1]);
        }

        let probabilityFromSources = 0;
        if (sourceRuntime.length > 0) {
          let noFire = 1;
          for (const source of sourceRuntime) {
            const stateIndex = indexes[node.parents.indexOf(source.parentId)];
            const sourceProbability = FireBuilder.clamp01(
              stateIndex === source.trueIndex ? source.ignitionGivenDamage : source.ignitionGivenNoDamage,
            );
            noFire *= 1 - sourceProbability;
          }
          probabilityFromSources = 1 - noFire;
        }

        const trueProbability = FireBuilder.clamp01(1 - (1 - baseProbability) * (1 - probabilityFromSources));
        output.push(1 - trueProbability);
        output.push(trueProbability);
      }
      return output;
    };
  }

  private static makeAutoSuppressionCpdGenerator(input: AutoSuppressionGeneratorInput): CpdGenerator {
    const trueProbability = FireBuilder.clamp01(input.successGivenIgnition);
    const falseProbability = 1 - trueProbability;
    const ignitionKey = input.ignitionKey;
    const frozenPgaKey = input.pgaKey;
    const frozenByPga = new Map<string, number>();
    for (const [key, value] of input.successGivenIgnitionByPga) frozenByPga.set(key, FireBuilder.clamp01(value));
    const frozenAllowExtra = input.allowExtraParents;

    return (localContext: ModelContext, node: NodeRecord): number[] => {
      const ignitionParentId = localContext.registry.nodeId(ignitionKey);
      if (!node.parents.includes(ignitionParentId)) {
        throw valueError(`Node '${node.nodeId}' missing required ignition parent '${ignitionParentId}'.`);
      }
      const expected = new Set<string>([ignitionParentId]);

      let pgaStates: string[] = [];
      let pgaPosition = -1;
      if (frozenByPga.size > 0) {
        if (frozenPgaKey === null) {
          throw valueError(`Node '${node.nodeId}' has auto_suppression_fragility_given_pga ` + "without a PGA key.");
        }
        const pgaParentId = localContext.registry.nodeId(frozenPgaKey);
        if (!node.parents.includes(pgaParentId)) {
          throw valueError(`Node '${node.nodeId}' missing required PGA parent '${pgaParentId}'.`);
        }
        expected.add(pgaParentId);
        pgaStates = localContext.model.node(pgaParentId).states;
        const missing = pgaStates.filter((state) => !frozenByPga.has(state));
        if (missing.length > 0) {
          throw valueError(`Auto suppression rows missing PGA states ${repr(missing)} for node '${node.nodeId}'.`);
        }
        pgaPosition = node.parents.indexOf(pgaParentId);
      }

      if (!frozenAllowExtra) {
        const extras = node.parents.filter((parentId) => !expected.has(parentId));
        if (extras.length > 0) {
          throw valueError(
            `Node '${node.nodeId}' has unexpected extra parents ${repr(extras)}. ` +
              "Remove the coupling or set allow_extra_auto_suppression_parents=true.",
          );
        }
      }

      const ignitionStates = localContext.model.node(ignitionParentId).states;
      const dimensions = node.parents.map((parentId) => localContext.model.card(parentId));
      const ignitionPosition = node.parents.indexOf(ignitionParentId);
      const rows = localContext.model.parentConfigurationCount(node.nodeId);

      const output: number[] = [];
      for (let rowIndex = 0; rowIndex < rows; rowIndex += 1) {
        const indexes = decodeRowIndex(rowIndex, dimensions);
        if (ignitionStates[indexes[ignitionPosition]] === "False") {
          output.push(1);
          output.push(0);
        } else if (frozenByPga.size > 0) {
          const localTrue = frozenByPga.get(pgaStates[indexes[pgaPosition]]) ?? 0;
          output.push(1 - localTrue);
          output.push(localTrue);
        } else {
          output.push(falseProbability);
          output.push(trueProbability);
        }
      }
      return output;
    };
  }

  private static makeSourceDamageCpdGenerator(
    pgaKey: string,
    givenPga: Map<string, number[]>,
    allowExtraParents: boolean,
  ): CpdGenerator {
    const frozenGivenPga = copyRows(givenPga);

    return (localContext: ModelContext, node: NodeRecord): number[] => {
      const pgaParentId = localContext.registry.nodeId(pgaKey);
      if (!node.parents.includes(pgaParentId)) {
        throw valueError(`Node '${node.nodeId}' missing required PGA parent '${pgaParentId}'.`);
      }
      if (!allowExtraParents) {
        const extras = node.parents.filter((parentId) => parentId !== pgaParentId);
        if (extras.length > 0) {
          throw valueError(
            `Node '${node.nodeId}' has unexpected extra parents ${repr(extras)}. ` +
              "Remove the coupling or set allow_extra_damage_parents=true.",
          );
        }
      }

      const pgaStates = localContext.model.node(pgaParentId).states;
      const missing = pgaStates.filter((state) => !frozenGivenPga.has(state));
      if (missing.length > 0) {
        throw valueError(`Source-damage rows missing PGA states ${repr(missing)} for node '${node.nodeId}'.`);
      }

      const dimensions = node.parents.map((parentId) => localContext.model.card(parentId));
      const pgaPosition = node.parents.indexOf(pgaParentId);
      const rows = localContext.model.parentConfigurationCount(node.nodeId);
      const output: number[] = [];
      for (let rowIndex = 0; rowIndex < rows; rowIndex += 1) {
        const indexes = decodeRowIndex(rowIndex, dimensions);
        pushAll(output, frozenGivenPga.get(pgaStates[indexes[pgaPosition]]) ?? []);
      }
      return output;
    };
  }

  private static makeAccessCpdGenerator(
    depthKey: string,
    accessGivenDepth: Map<string, number[]>,
    allowExtraParents: boolean,
  ): CpdGenerator {
    const frozenRows = copyRows(accessGivenDepth);

    return (localContext: ModelContext, node: NodeRecord): number[] => {
      const depthParentId = localContext.registry.nodeId(depthKey);
      if (!node.parents.includes(depthParentId)) {
        throw valueError(`Node '${node.nodeId}' missing required flood-depth parent '${depthParentId}'.`);
      }
      if (!allowExtraParents) {
        const extras = node.parents.filter((parentId) => parentId !== depthParentId);
        if (extras.length > 0) {
          throw valueError(
            `Node '${node.nodeId}' has unexpected extra parents ${repr(extras)}. ` +
              "Remove the coupling or set allow_extra_access_parents=true.",
          );
        }
      }

      const depthStates = localContext.model.node(depthParentId).states;
      const missing = depthStates.filter((state) => !frozenRows.has(state));
      if (missing.length > 0) {
        throw valueError(`Access rows missing depth states ${repr(missing)} for node '${node.nodeId}'.`);
      }

      const dimensions = node.parents.map((parentId) => localContext.model.card(parentId));
      const depthPosition = node.parents.indexOf(depthParentId);
      const rows = localContext.model.parentConfigurationCount(node.nodeId);
      const output: number[] = [];
      for (let rowIndex = 0; rowIndex < rows; rowIndex += 1) {
        const indexes = decodeRowIndex(rowIndex, dimensions);
        pushAll(output, frozenRows.get(depthStates[indexes[depthPosition]]) ?? []);
      }
      return output;
    };
  }

  private static makeBrigadeCpdGenerator(input: BrigadeGeneratorInput): CpdGenerator {
    const frozenMode = strip(input.mode).toLowerCase();
    const frozenPgaKey = input.pgaKey;
    const frozenAccessKey = input.accessKey;
    const frozenDepthKey = input.depthKey;
    const frozenNoArrivalState = input.noArrivalState;
    const frozenProbabilities = Array.from(input.unconditionalProbabilities);
    const frozenGivenPga = copyRows(input.givenPga);
    const frozenGivenPgaAndDepth = new Map<string, Map<string, number[]>>();
    for (const [pgaState, depthMap] of input.givenPgaAndDepth) {
      frozenGivenPgaAndDepth.set(pgaState, copyRows(depthMap));
    }
    const frozenAllowExtra = input.allowExtraParents;

    return (localContext: ModelContext, node: NodeRecord): number[] => {
      const expectedParents: string[] = [];
      let pgaParentId: string | null = null;
      let accessParentId: string | null = null;
      let depthParentId: string | null = null;

      if (frozenAccessKey !== null && frozenAccessKey.length > 0) {
        accessParentId = localContext.registry.nodeId(frozenAccessKey);
        if (!node.parents.includes(accessParentId)) {
          throw valueError(`Node '${node.nodeId}' missing required access parent '${accessParentId}'.`);
        }
        expectedParents.push(accessParentId);
      }

      if (frozenMode === "given_pga" || frozenMode === "given_pga_and_depth") {
        if (frozenPgaKey === null) {
          throw valueError(`Node '${node.nodeId}' has brigade mode '${frozenMode}' without a PGA key.`);
        }
        pgaParentId = localContext.registry.nodeId(frozenPgaKey);
        if (!node.parents.includes(pgaParentId)) {
          throw valueError(`Node '${node.nodeId}' missing required PGA parent '${pgaParentId}'.`);
        }
        expectedParents.push(pgaParentId);
      }

      if (frozenMode === "given_pga_and_depth") {
        if (frozenDepthKey === null) {
          throw valueError(`Node '${node.nodeId}' has brigade_given_pga_and_depth without a flood-depth key.`);
        }
        depthParentId = localContext.registry.nodeId(frozenDepthKey);
        if (!node.parents.includes(depthParentId)) {
          throw valueError(`Node '${node.nodeId}' missing required flood-depth parent '${depthParentId}'.`);
        }
        expectedParents.push(depthParentId);
      }

      if (!frozenAllowExtra) {
        const extras = node.parents.filter((parentId) => !expectedParents.includes(parentId));
        if (extras.length > 0) {
          throw valueError(
            `Node '${node.nodeId}' has unexpected extra parents ${repr(extras)}. ` +
              "Remove the coupling or set allow_extra_brigade_parents=true.",
          );
        }
      }

      let pgaStates: string[] = [];
      if (pgaParentId !== null) {
        pgaStates = localContext.model.node(pgaParentId).states;
        if (frozenMode === "given_pga") {
          const missing = pgaStates.filter((state) => !frozenGivenPga.has(state));
          if (missing.length > 0) {
            throw valueError(`Brigade rows missing PGA states ${repr(missing)} for node '${node.nodeId}'.`);
          }
        } else if (frozenMode === "given_pga_and_depth") {
          const missing = pgaStates.filter((state) => !frozenGivenPgaAndDepth.has(state));
          if (missing.length > 0) {
            throw valueError(`Brigade rows missing PGA states ${repr(missing)} for node '${node.nodeId}'.`);
          }
        }
      }

      let depthStates: string[] = [];
      if (depthParentId !== null) {
        depthStates = localContext.model.node(depthParentId).states;
        for (const [pgaState, rowsByDepth] of frozenGivenPgaAndDepth) {
          const missingDepth = depthStates.filter((state) => !rowsByDepth.has(state));
          if (missingDepth.length > 0) {
            throw valueError(
              `Brigade rows missing depth states ${repr(missingDepth)} for PGA state ` +
                `'${pgaState}' in node '${node.nodeId}'.`,
            );
          }
        }
      }

      const noArrivalIndex = FireBuilder.findStateIndex(node.states, frozenNoArrivalState);
      if (accessParentId !== null && noArrivalIndex === null) {
        throw valueError(
          `Node '${node.nodeId}' must include brigade no-arrival state '${frozenNoArrivalState}' ` +
            "when access parent is enabled.",
        );
      }

      const dimensions = node.parents.map((parentId) => localContext.model.card(parentId));
      const rows = localContext.model.parentConfigurationCount(node.nodeId);
      const output: number[] = [];
      for (let rowIndex = 0; rowIndex < rows; rowIndex += 1) {
        const indexes = decodeRowIndex(rowIndex, dimensions);
        if (accessParentId !== null && noArrivalIndex !== null) {
          const accessPosition = node.parents.indexOf(accessParentId);
          const accessStates = localContext.model.node(accessParentId).states;
          if (accessStates[indexes[accessPosition]] === "False") {
            pushAll(output, FireBuilder.oneHot(node.states.length, noArrivalIndex));
            continue;
          }
        }

        if (frozenMode === "unconditional") {
          pushAll(output, frozenProbabilities);
        } else if (frozenMode === "given_pga") {
          if (pgaParentId === null) {
            throw valueError(`Node '${node.nodeId}' brigade mode 'given_pga' missing PGA parent.`);
          }
          const pgaState = pgaStates[indexes[node.parents.indexOf(pgaParentId)]];
          pushAll(output, frozenGivenPga.get(pgaState) ?? []);
        } else if (frozenMode === "given_pga_and_depth") {
          if (pgaParentId === null || depthParentId === null) {
            throw valueError(`Node '${node.nodeId}' brigade mode 'given_pga_and_depth' missing parent.`);
          }
          const pgaPosition = node.parents.indexOf(pgaParentId);
          const depthPosition = node.parents.indexOf(depthParentId);
          const pgaState = pgaStates[indexes[pgaPosition]];
          const depthState = depthStates[indexes[depthPosition]];
          pushAll(output, frozenGivenPgaAndDepth.get(pgaState)?.get(depthState) ?? []);
        } else {
          throw valueError(`Node '${node.nodeId}' has unsupported brigade mode '${frozenMode}'.`);
        }
      }
      return output;
    };
  }

  private static makeEffectiveHrrCpdGenerator(input: HrrGeneratorInput): CpdGenerator {
    const ignitionKey = input.ignitionKey;
    const autoSuppressionKey = input.autoSuppressionKey;
    const brigadeKey = input.brigadeKey;
    const frozenNoneIndex = Math.trunc(input.hrrNoneIndex);
    const frozenAutoSuppressionIndex = Math.trunc(input.autoSuppressionHrrIndex);
    const frozenHrrRows = copyRows(input.hrrGivenBrigadeUnsuppressed);
    const frozenAllowExtra = input.allowExtraParents;

    return (localContext: ModelContext, node: NodeRecord): number[] => {
      const ignitionParentId = localContext.registry.nodeId(ignitionKey);
      const autoParentId = localContext.registry.nodeId(autoSuppressionKey);
      const brigadeParentId = localContext.registry.nodeId(brigadeKey);

      const requiredParents: [string, string][] = [
        [ignitionParentId, "ignition"],
        [autoParentId, "auto suppression"],
        [brigadeParentId, "brigade"],
      ];
      for (const [parentId, parentName] of requiredParents) {
        if (!node.parents.includes(parentId)) {
          throw valueError(`Node '${node.nodeId}' missing required ${parentName} parent '${parentId}'.`);
        }
      }

      if (!frozenAllowExtra) {
        const expected = new Set([ignitionParentId, autoParentId, brigadeParentId]);
        const extras = node.parents.filter((parentId) => !expected.has(parentId));
        if (extras.length > 0) {
          throw valueError(
            `Node '${node.nodeId}' has unexpected extra parents ${repr(extras)}. ` +
              "Remove the coupling or set allow_extra_hrr_parents=true.",
          );
        }
      }

      const ignitionStates = localContext.model.node(ignitionParentId).states;
      const autoStates = localContext.model.node(autoParentId).states;
      const brigadeStates = localContext.model.node(brigadeParentId).states;
      const missing = brigadeStates.filter((state) => !frozenHrrRows.has(state));
      if (missing.length > 0) {
        throw valueError(`HRR unsuppressed rows missing brigade states ${repr(missing)} for node '${node.nodeId}'.`);
      }

      const hrrCount = node.states.length;
      const dimensions = node.parents.map((parentId) => localContext.model.card(parentId));
      const ignitionPosition = node.parents.indexOf(ignitionParentId);
      const autoPosition = node.parents.indexOf(autoParentId);
      const brigadePosition = node.parents.indexOf(brigadeParentId);
      const rows = localContext.model.parentConfigurationCount(node.nodeId);

      const output: number[] = [];
      for (let rowIndex = 0; rowIndex < rows; rowIndex += 1) {
        const indexes = decodeRowIndex(rowIndex, dimensions);
        const ignitionState = ignitionStates[indexes[ignitionPosition]];
        const autoState = autoStates[indexes[autoPosition]];
        const brigadeState = brigadeStates[indexes[brigadePosition]];

        if (ignitionState === "False") {
          pushAll(output, FireBuilder.oneHot(hrrCount, frozenNoneIndex));
        } else if (autoState === "True") {
          pushAll(output, FireBuilder.oneHot(hrrCount, frozenAutoSuppressionIndex));
        } else {
          pushAll(output, frozenHrrRows.get(brigadeState) ?? []);
        }
      }
      return output;
    };
  }

  private static makeDamageCpdGenerator(
    hrrKey: string,
    probabilitiesByState: Map<string, number>,
    allowExtraParents: boolean,
  ): CpdGenerator {
    const frozen = new Map(probabilitiesByState);

    return (localContext: ModelContext, node: NodeRecord): number[] => {
      const hrrParentId = localContext.registry.nodeId(hrrKey);
      if (!node.parents.includes(hrrParentId)) {
        throw valueError(`Node '${node.nodeId}' missing required HRR parent '${hrrParentId}'.`);
      }
      if (!allowExtraParents) {
        const extras = node.parents.filter((parentId) => parentId !== hrrParentId);
        if (extras.length > 0) {
          throw valueError(
            `Node '${node.nodeId}' has unexpected extra parents ${repr(extras)}. ` +
              "Remove the coupling or set allow_extra_parents=true.",
          );
        }
      }

      const hrrStates = localContext.model.node(hrrParentId).states;
      const missing = hrrStates.filter((state) => !frozen.has(state));
      if (missing.length > 0) {
        throw valueError(`Damage table missing HRR states ${repr(missing)} for node '${node.nodeId}'.`);
      }

      const dimensions = node.parents.map((parentId) => localContext.model.card(parentId));
      const hrrPosition = node.parents.indexOf(hrrParentId);
      const rows = localContext.model.parentConfigurationCount(node.nodeId);
      const output: number[] = [];
      for (let rowIndex = 0; rowIndex < rows; rowIndex += 1) {
        const indexes = decodeRowIndex(rowIndex, dimensions);
        const trueProbability = FireBuilder.clamp01(frozen.get(hrrStates[indexes[hrrPosition]]) ?? 0);
        output.push(1 - trueProbability);
        output.push(trueProbability);
      }
      return output;
    };
  }

  private resolveIgnitionConfig(
    zone: SpecMapping,
    zoneId: string,
    pgaStates: readonly string[],
    pgaNoneLabel: string,
    pgaStateValues: Map<string, number>,
    hasIgnitionSources: boolean,
  ): IgnitionConfig {
    const rawGiven = getValue(zone, "ignition_given_pga");
    const rawFragility = getValue(zone, "ignition_fragility_given_pga");
    if (rawGiven !== null && rawFragility !== null) {
      throw valueError(
        `fire.zones[${zoneId}] cannot define both ignition_given_pga and ` + "ignition_fragility_given_pga.",
      );
    }

    if (rawGiven !== null) {
      if (!isMapping(rawGiven)) {
        throw valueError(`fire.zones[${zoneId}].ignition_given_pga must be an object/mapping.`);
      }
      const rowsRaw = getValueOr(rawGiven, "rows", rawGiven);
      if (!isMapping(rowsRaw)) {
        throw valueError(`fire.zones[${zoneId}].ignition_given_pga.rows must be an object/mapping.`);
      }

      const output = new Map<string, number[]>();
      for (const pgaState of keysOf(rowsRaw)) {
        const label = `fire.zones[${zoneId}].ignition_given_pga[${pgaState}]`;
        output.set(pgaState, FireBuilder.parseBoolProbabilityRow(rowsRaw[pgaState], label));
      }

      const missing = pgaStates.filter((state) => !output.has(state));
      if (missing.length > 0) {
        throw valueError(`fire.zones[${zoneId}].ignition_given_pga missing PGA states ${repr(missing)}.`);
      }
      const extra = Array.from(output.keys()).filter((state) => !pgaStates.includes(state));
      if (extra.length > 0) {
        throw valueError(`fire.zones[${zoneId}].ignition_given_pga has unknown PGA states ${repr(extra)}.`);
      }

      if (hasKey(zone, "ignition_probs") || hasKey(zone, "ignition_prob_true") || hasKey(zone, "ignition_frequency")) {
        throw valueError(`fire.zones[${zoneId}] cannot mix ignition_given_pga with unconditional ignition fields.`);
      }

      return { usePga: true, probabilities: [], givenPga: output };
    }

    if (rawFragility !== null) {
      if (!isMapping(rawFragility)) {
        throw valueError(`fire.zones[${zoneId}].ignition_fragility_given_pga must be an object/mapping.`);
      }
      const theta = FireBuilder.requirePositiveFloat(
        getValue(rawFragility, "theta"),
        `zones[${zoneId}].ignition_fragility_given_pga.theta`,
      );
      const beta = FireBuilder.requirePositiveFloat(
        getValue(rawFragility, "beta"),
        `zones[${zoneId}].ignition_fragility_given_pga.beta`,
      );
      const combineMode = strip(text(getValueOr(rawFragility, "combine_mode", "union_independent"))).toLowerCase();
      if (combineMode !== "union_independent" && combineMode !== "replace" && combineMode !== "max") {
        throw valueError(
          `fire.zones[${zoneId}].ignition_fragility_given_pga.combine_mode ` +
            "must be one of: union_independent, replace, max.",
        );
      }

      const probFloor = toFloat(getValueOr(rawFragility, "prob_floor", getValueOr(zone, "ignition_prob_floor", 0)));
      const probCap = toFloat(getValueOr(rawFragility, "prob_cap", getValueOr(zone, "ignition_prob_cap", 1)));
      if (probFloor < 0 || probFloor > 1) {
        throw valueError(`fire.zones[${zoneId}].ignition_fragility_given_pga.prob_floor must be in [0,1].`);
      }
      if (probCap < 0 || probCap > 1) {
        throw valueError(`fire.zones[${zoneId}].ignition_fragility_given_pga.prob_cap must be in [0,1].`);
      }
      if (probFloor > probCap) {
        throw valueError(`fire.zones[${zoneId}].ignition_fragility_given_pga requires prob_floor <= prob_cap.`);
      }

      const baseline = this.resolveIgnitionUnconditionalProbabilities(zone, zoneId, hasIgnitionSources);
      const baseProbability = baseline[1];

      const given = new Map<string, number[]>();
      const probabilitiesForMonotonic: number[] = [];
      for (const pgaState of pgaStates) {
        let trueProbability: number;
        if (pgaState === pgaNoneLabel) {
          trueProbability = baseProbability;
        } else {
          const pgaValue = pgaStateValues.get(pgaState);
          if (pgaValue === undefined) {
            throw valueError(
              `fire.zones[${zoneId}].ignition_fragility_given_pga ` +
                `could not resolve PGA numeric value for state '${pgaState}'.`,
            );
          }
          if (pgaValue <= 0) {
            throw valueError(`fire.zones[${zoneId}] non-none PGA state '${pgaState}' must map to a positive value.`);
          }
          const seismicProbability = FireBuilder.fragilityProbability(pgaValue, theta, beta);
          if (combineMode === "union_independent") {
            trueProbability = 1 - (1 - baseProbability) * (1 - seismicProbability);
          } else if (combineMode === "replace") {
            trueProbability = seismicProbability;
          } else {
            trueProbability = larger(baseProbability, seismicProbability);
          }
          probabilitiesForMonotonic.push(trueProbability);
        }

        trueProbability = smaller(probCap, larger(probFloor, FireBuilder.clamp01(trueProbability)));
        given.set(pgaState, [1 - trueProbability, trueProbability]);
      }

      for (let index = 1; index < probabilitiesForMonotonic.length; index += 1) {
        if (probabilitiesForMonotonic[index] + 1e-12 < probabilitiesForMonotonic[index - 1]) {
          throw valueError(
            `fire.zones[${zoneId}].ignition_fragility_given_pga generated ` +
              "non-monotonic ignition probability over ordered PGA states.",
          );
        }
      }

      return { usePga: true, probabilities: [], givenPga: given };
    }

    const probabilities = this.resolveIgnitionUnconditionalProbabilities(zone, zoneId, hasIgnitionSources);
    return { usePga: false, probabilities, givenPga: new Map<string, number[]>() };
  }

  private static resolveSourceDamageGivenPga(
    source: IgnitionSource,
    zoneId: string,
    pgaStates: readonly string[],
    pgaNoneLabel: string,
    pgaStateValues: Map<string, number>,
  ): Map<string, number[]> {
    const theta = source.damageFragilityTheta;
    const beta = source.damageFragilityBeta;
    const probFloor = source.damageProbFloor;
    const probCap = source.damageProbCap;
    const noneProbability = FireBuilder.clamp01(source.damageProbWhenPgaNone);

    const output = new Map<string, number[]>();
    const probabilitiesForMonotonic: number[] = [];
    for (const pgaState of pgaStates) {
      let trueProbability: number;
      if (pgaState === pgaNoneLabel) {
        trueProbability = noneProbability;
      } else {
        const pgaValue = pgaStateValues.get(pgaState);
        if (pgaValue === undefined) {
          throw valueError(
            `fire.zones[${zoneId}] ignition source '${source.sourceId}' ` +
              `could not resolve PGA numeric value for state '${pgaState}'.`,
          );
        }
        if (pgaValue <= 0) {
          throw valueError(
            `fire.zones[${zoneId}] ignition source '${source.sourceId}' ` +
              `has non-positive PGA center for state '${pgaState}'.`,
          );
        }
        trueProbability = FireBuilder.fragilityProbability(pgaValue, theta, beta);
        probabilitiesForMonotonic.push(trueProbability);
      }

      trueProbability = smaller(probCap, larger(probFloor, FireBuilder.clamp01(trueProbability)));
      output.set(pgaState, [1 - trueProbability, trueProbability]);
    }

    for (let index = 1; index < probabilitiesForMonotonic.length; index += 1) {
      if (probabilitiesForMonotonic[index] + 1e-12 < probabilitiesForMonotonic[index - 1]) {
        throw valueError(
          `fire.zones[${zoneId}] ignition source '${source.sourceId}' generated ` +
            "non-monotonic source-damage fragility over ordered PGA states.",
        );
      }
    }
    return output;
  }

  private resolveIgnitionUnconditionalProbabilities(
    zone: SpecMapping,
    zoneId: string,
    allowDefaultZero: boolean,
  ): number[] {
    if (hasKey(zone, "ignition_probs")) {
      const raw = getValue(zone, "ignition_probs");
      if (!isSequence(raw)) throw valueError(`fire.zones[${zoneId}].ignition_probs must be list-like.`);
      const values = raw.map((item) => toFloat(item));
      if (values.length !== 2) throw valueError(`fire.zones[${zoneId}].ignition_probs must have length 2.`);
      return FireBuilder.validateProbabilityVector(values, `fire.zones[${zoneId}].ignition_probs`);
    }

    if (hasKey(zone, "ignition_prob_true")) {
      const trueProbability = FireBuilder.requireProbability(
        getValue(zone, "ignition_prob_true"),
        `fire.zones[${zoneId}].ignition_prob_true`,
      );
      return [1 - trueProbability, trueProbability];
    }

    if (hasKey(zone, "ignition_frequency")) {
      const frequency = FireBuilder.requireNonNegativeFloat(
        getValue(zone, "ignition_frequency"),
        `fire.zones[${zoneId}].ignition_frequency`,
      );
      const missionTime = FireBuilder.requirePositiveFloat(
        getValueOr(zone, "mission_time", getValueOr(this.config, "mission_time", 1)),
        `fire.zones[${zoneId}].mission_time`,
      );
      const mode = strip(
        text(
          getValueOr(zone, "frequency_to_probability", getValueOr(this.config, "frequency_to_probability", "poisson")),
        ),
      ).toLowerCase();
      if (mode !== "poisson" && mode !== "linear") {
        throw valueError(`fire.zones[${zoneId}].frequency_to_probability must be 'poisson' or 'linear'.`);
      }
      const trueProbability = FireBuilder.clamp01(
        mode === "poisson" ? 1 - Math.exp(-frequency * missionTime) : frequency * missionTime,
      );
      return [1 - trueProbability, trueProbability];
    }

    if (allowDefaultZero) return [1, 0];

    throw valueError(
      `fire.zones[${zoneId}] requires ignition definition via one of: ` +
        "ignition_probs, ignition_prob_true, ignition_frequency, ignition_given_pga " +
        "(or ignition_sources with default-zero baseline).",
    );
  }

  private static resolveAutoSuppressionSuccessProbability(zone: SpecMapping, zoneId: string): number {
    if (hasKey(zone, "auto_suppression_prob_success_given_ignition")) {
      return FireBuilder.requireProbability(
        getValue(zone, "auto_suppression_prob_success_given_ignition"),
        `fire.zones[${zoneId}].auto_suppression_prob_success_given_ignition`,
      );
    }
    if (hasKey(zone, "auto_suppression_success_prob")) {
      return FireBuilder.requireProbability(
        getValue(zone, "auto_suppression_success_prob"),
        `fire.zones[${zoneId}].auto_suppression_success_prob`,
      );
    }
    throw valueError(
      `fire.zones[${zoneId}] must provide auto suppression success probability ` +
        "(auto_suppression_prob_success_given_ignition).",
    );
  }

  private resolveAutoSuppressionConfig(
    zone: SpecMapping,
    zoneId: string,
    pgaStates: readonly string[],
    pgaNoneLabel: string,
    pgaStateValues: Map<string, number>,
  ): AutoSuppressionConfig {
    const baseSuccess = FireBuilder.resolveAutoSuppressionSuccessProbability(zone, zoneId);
    const rawFragility = getValue(zone, "auto_suppression_fragility_given_pga");
    if (rawFragility === null) {
      return { usePga: false, successGivenIgnition: baseSuccess, successGivenIgnitionByPga: new Map() };
    }
    if (!isMapping(rawFragility)) {
      throw valueError(`fire.zones[${zoneId}].auto_suppression_fragility_given_pga must be an object/mapping.`);
    }

    const detection = FireBuilder.resolveOptionalFragilityPair(
      getValue(rawFragility, "detection"),
      `zones[${zoneId}].auto_suppression_fragility_given_pga.detection`,
    );
    const suppression = FireBuilder.resolveOptionalFragilityPair(
      getValue(rawFragility, "suppression"),
      `zones[${zoneId}].auto_suppression_fragility_given_pga.suppression`,
    );
    if (detection === null && suppression === null) {
      throw valueError(
        `fire.zones[${zoneId}].auto_suppression_fragility_given_pga must define at least one of ` +
          "'detection' or 'suppression'.",
      );
    }

    const probFloor = FireBuilder.requireProbability(
      getValueOr(rawFragility, "prob_floor", getValueOr(zone, "auto_suppression_prob_floor", 0)),
      `zones[${zoneId}].auto_suppression_fragility_given_pga.prob_floor`,
    );
    const probCap = FireBuilder.requireProbability(
      getValueOr(rawFragility, "prob_cap", getValueOr(zone, "auto_suppression_prob_cap", 1)),
      `zones[${zoneId}].auto_suppression_fragility_given_pga.prob_cap`,
    );
    if (probFloor > probCap) {
      throw valueError(`fire.zones[${zoneId}].auto_suppression_fragility_given_pga requires prob_floor <= prob_cap.`);
    }

    const successByPga = new Map<string, number>();
    const nonNoneSuccesses: number[] = [];
    for (const pgaState of pgaStates) {
      let success: number;
      if (pgaState === pgaNoneLabel) {
        success = baseSuccess;
      } else {
        const pgaValue = pgaStateValues.get(pgaState);
        if (pgaValue === undefined) {
          throw valueError(
            `fire.zones[${zoneId}].auto_suppression_fragility_given_pga ` +
              `could not resolve PGA numeric value for state '${pgaState}'.`,
          );
        }
        if (pgaValue <= 0) {
          throw valueError(`fire.zones[${zoneId}] non-none PGA state '${pgaState}' must map to a positive value.`);
        }

        const baseFailure = 1 - baseSuccess;
        let detectionFailure = 0;
        let suppressionFailure = 0;
        if (detection !== null) {
          detectionFailure = FireBuilder.fragilityProbability(pgaValue, detection.theta, detection.beta);
        }
        if (suppression !== null) {
          suppressionFailure = FireBuilder.fragilityProbability(pgaValue, suppression.theta, suppression.beta);
        }
        const totalFailure = 1 - (1 - baseFailure) * (1 - detectionFailure) * (1 - suppressionFailure);
        success = 1 - totalFailure;
        nonNoneSuccesses.push(success);
      }

      success = smaller(probCap, larger(probFloor, FireBuilder.clamp01(success)));
      successByPga.set(pgaState, success);
    }

    for (let index = 1; index < nonNoneSuccesses.length; index += 1) {
      if (nonNoneSuccesses[index] > nonNoneSuccesses[index - 1] + 1e-12) {
        throw valueError(
          `fire.zones[${zoneId}].auto_suppression_fragility_given_pga generated ` +
            "non-monotonic suppression success over ordered PGA states.",
        );
      }
    }

    return { usePga: true, successGivenIgnition: 0, successGivenIgnitionByPga: successByPga };
  }

  private static resolveOptionalFragilityPair(raw: SpecValue, label: string): FragilityPair | null {
    if (raw === null) return null;
    if (!isMapping(raw)) throw valueError(`fire.${label} must be an object/mapping.`);
    const theta = FireBuilder.requirePositiveFloat(getValue(raw, "theta"), `${label}.theta`);
    const beta = FireBuilder.requirePositiveFloat(getValue(raw, "beta"), `${label}.beta`);
    return { theta, beta };
  }

  private resolveBrigadeStates(context: ModelContext, zone: SpecMapping, zoneId: string): string[] {
    let states: string[];
    if (hasKey(zone, "brigade_states")) {
      const raw = getValue(zone, "brigade_states");
      if (!isSequence(raw)) throw valueError(`fire.zones[${zoneId}].brigade_states must be list-like.`);
      states = raw.map((item) => text(item));
    } else {
      const reference = strip(
        text(getValueOr(zone, "brigade_states_ref", getValueOr(this.config, "brigade_states_ref", ""))),
      );
      if (reference.length === 0) {
        throw valueError(`fire.zones[${zoneId}] requires brigade_states or brigade_states_ref.`);
      }
      states = context.discretization.states(reference);
    }

    if (states.length < 2) throw valueError(`fire.zones[${zoneId}].brigade states must have at least 2 values.`);
    if (new Set(states).size !== states.length) {
      throw valueError(`fire.zones[${zoneId}].brigade states must be unique.`);
    }
    return states;
  }

  private static resolveBrigadeConfig(
    zone: SpecMapping,
    zoneId: string,
    brigadeStates: readonly string[],
    pgaStates: readonly string[],
    depthStates: readonly string[] | null,
  ): BrigadeConfig {
    const rawGivenPgaDepth = getValue(zone, "brigade_given_pga_and_depth");
    if (rawGivenPgaDepth !== null) {
      if (depthStates === null) {
        throw valueError(`fire.zones[${zoneId}].brigade_given_pga_and_depth requires flood_depth_key/flood_area_key.`);
      }
      if (!isMapping(rawGivenPgaDepth)) {
        throw valueError(`fire.zones[${zoneId}].brigade_given_pga_and_depth must be an object/mapping.`);
      }
      const rowsRaw = getValueOr(rawGivenPgaDepth, "rows", rawGivenPgaDepth);
      if (!isMapping(rowsRaw)) {
        throw valueError(`fire.zones[${zoneId}].brigade_given_pga_and_depth.rows must be an object/mapping.`);
      }

      const output = new Map<string, Map<string, number[]>>();
      for (const pgaState of keysOf(rowsRaw)) {
        const depthRowsRaw = rowsRaw[pgaState];
        if (!isMapping(depthRowsRaw)) {
          throw valueError(
            `fire.zones[${zoneId}].brigade_given_pga_and_depth[${pgaState}] must be a mapping keyed by depth state.`,
          );
        }
        const rowByDepth = new Map<string, number[]>();
        for (const depthState of keysOf(depthRowsRaw)) {
          const label = `fire.zones[${zoneId}].brigade_given_pga_and_depth` + `[${pgaState}][${depthState}]`;
          rowByDepth.set(
            depthState,
            FireBuilder.parseProbabilityRow(depthRowsRaw[depthState], brigadeStates.length, label),
          );
        }
        output.set(pgaState, rowByDepth);
      }

      const missingPga = pgaStates.filter((state) => !output.has(state));
      if (missingPga.length > 0) {
        throw valueError(`fire.zones[${zoneId}].brigade_given_pga_and_depth missing PGA states ${repr(missingPga)}.`);
      }
      const extraPga = Array.from(output.keys()).filter((state) => !pgaStates.includes(state));
      if (extraPga.length > 0) {
        throw valueError(`fire.zones[${zoneId}].brigade_given_pga_and_depth has unknown PGA states ${repr(extraPga)}.`);
      }
      for (const [pgaState, depthRows] of output) {
        const missingDepth = depthStates.filter((state) => !depthRows.has(state));
        if (missingDepth.length > 0) {
          throw valueError(
            `fire.zones[${zoneId}].brigade_given_pga_and_depth[${pgaState}] ` +
              `missing depth states ${repr(missingDepth)}.`,
          );
        }
        const extraDepth = Array.from(depthRows.keys()).filter((state) => !depthStates.includes(state));
        if (extraDepth.length > 0) {
          throw valueError(
            `fire.zones[${zoneId}].brigade_given_pga_and_depth[${pgaState}] ` +
              `has unknown depth states ${repr(extraDepth)}.`,
          );
        }
      }

      return { mode: "given_pga_and_depth", probabilities: [], givenPga: new Map(), givenPgaAndDepth: output };
    }

    const rawGiven = getValue(zone, "brigade_given_pga");
    if (rawGiven !== null) {
      if (!isMapping(rawGiven)) {
        throw valueError(`fire.zones[${zoneId}].brigade_given_pga must be an object/mapping.`);
      }
      const rowsRaw = getValueOr(rawGiven, "rows", rawGiven);
      if (!isMapping(rowsRaw)) {
        throw valueError(`fire.zones[${zoneId}].brigade_given_pga.rows must be an object/mapping.`);
      }

      const output = new Map<string, number[]>();
      for (const pgaState of keysOf(rowsRaw)) {
        const label = `fire.zones[${zoneId}].brigade_given_pga[${pgaState}]`;
        output.set(pgaState, FireBuilder.parseProbabilityRow(rowsRaw[pgaState], brigadeStates.length, label));
      }

      const missing = pgaStates.filter((state) => !output.has(state));
      if (missing.length > 0) {
        throw valueError(`fire.zones[${zoneId}].brigade_given_pga missing PGA states ${repr(missing)}.`);
      }
      const extra = Array.from(output.keys()).filter((state) => !pgaStates.includes(state));
      if (extra.length > 0) {
        throw valueError(`fire.zones[${zoneId}].brigade_given_pga has unknown PGA states ${repr(extra)}.`);
      }

      if (hasKey(zone, "brigade_probs")) {
        throw valueError(`fire.zones[${zoneId}] cannot mix brigade_given_pga and brigade_probs.`);
      }

      return { mode: "given_pga", probabilities: [], givenPga: output, givenPgaAndDepth: new Map() };
    }

    const raw = getValue(zone, "brigade_probs");
    if (!isSequence(raw)) {
      throw valueError(`fire.zones[${zoneId}] requires either brigade_given_pga or brigade_probs.`);
    }
    const probabilities = FireBuilder.parseProbabilityRow(
      raw,
      brigadeStates.length,
      `fire.zones[${zoneId}].brigade_probs`,
    );
    return { mode: "unconditional", probabilities, givenPga: new Map(), givenPgaAndDepth: new Map() };
  }

  private static resolveAccessGivenDepth(
    zone: SpecMapping,
    zoneId: string,
    depthStates: readonly string[],
  ): Map<string, number[]> {
    const rawTable = getValue(zone, "access_given_depth");
    const rawBlocked = getValue(zone, "access_blocked_depth_states");

    if (rawTable !== null && rawBlocked !== null) {
      throw valueError(`fire.zones[${zoneId}] cannot define both access_given_depth and access_blocked_depth_states.`);
    }

    if (rawBlocked !== null) {
      if (!isSequence(rawBlocked)) {
        throw valueError(`fire.zones[${zoneId}].access_blocked_depth_states must be list-like.`);
      }
      const blocked = new Set(rawBlocked.map((item) => text(item)));
      const unmatched = Array.from(blocked).filter((state) => !depthStates.includes(state));
      if (unmatched.length > 0) {
        throw valueError(
          `fire.zones[${zoneId}].access_blocked_depth_states has unknown depth states ${repr(sortedText(unmatched))}.`,
        );
      }
      const output = new Map<string, number[]>();
      for (const state of depthStates) output.set(state, blocked.has(state) ? [1, 0] : [0, 1]);
      return output;
    }

    if (rawTable === null) {
      throw valueError(
        `fire.zones[${zoneId}] flood coupling requires access_given_depth ` + "or access_blocked_depth_states.",
      );
    }
    if (!isMapping(rawTable)) {
      throw valueError(`fire.zones[${zoneId}].access_given_depth must be an object/mapping.`);
    }

    const outputRows = new Map<string, number[]>();
    for (const depthState of keysOf(rawTable)) {
      const row = rawTable[depthState];
      const label = `fire.zones[${zoneId}].access_given_depth[${depthState}]`;
      if (typeof row === "number" || typeof row === "boolean") {
        const trueProbability = FireBuilder.requireProbability(row, `${label}.p_true`);
        outputRows.set(depthState, [1 - trueProbability, trueProbability]);
      } else {
        outputRows.set(depthState, FireBuilder.parseBoolProbabilityRow(row, label));
      }
    }

    const missing = depthStates.filter((state) => !outputRows.has(state));
    if (missing.length > 0) {
      throw valueError(`fire.zones[${zoneId}].access_given_depth missing depth states ${repr(missing)}.`);
    }
    const extra = Array.from(outputRows.keys()).filter((state) => !depthStates.includes(state));
    if (extra.length > 0) {
      throw valueError(`fire.zones[${zoneId}].access_given_depth has unknown depth states ${repr(extra)}.`);
    }
    return outputRows;
  }

  private resolveBrigadeNoArrivalState(zone: SpecMapping): string {
    const raw = getValueOr(
      zone,
      "brigade_no_arrival_state",
      getValueOr(this.config, "brigade_no_arrival_state", "NoArrival"),
    );
    const state = strip(text(raw));
    return state.length > 0 ? state : "NoArrival";
  }

  private resolveHrrStates(context: ModelContext, zone: SpecMapping, zoneId: string): string[] {
    let states: string[];
    if (hasKey(zone, "hrr_states")) {
      const raw = getValue(zone, "hrr_states");
      if (!isSequence(raw)) throw valueError(`fire.zones[${zoneId}].hrr_states must be list-like.`);
      states = raw.map((item) => text(item));
    } else {
      const reference = strip(text(getValueOr(zone, "hrr_states_ref", getValueOr(this.config, "hrr_states_ref", ""))));
      if (reference.length === 0) {
        throw valueError(`fire.zones[${zoneId}] requires hrr_states or hrr_states_ref.`);
      }
      states = context.discretization.states(reference);
    }

    if (states.length < 2) throw valueError(`fire.zones[${zoneId}].hrr states must have at least 2 values.`);
    if (new Set(states).size !== states.length) {
      throw valueError(`fire.zones[${zoneId}].hrr states must be unique.`);
    }
    return states;
  }

  private resolveHrrOrder(zone: SpecMapping, zoneId: string, hrrStates: readonly string[]): string[] {
    const raw = getValueOr(zone, "hrr_state_order", getValue(this.config, "hrr_state_order"));
    if (!isSequence(raw)) {
      throw valueError(`fire.zones[${zoneId}] requires explicit hrr_state_order list for monotonic checks.`);
    }
    const order = raw.map((item) => text(item));
    const orderSet = new Set(order);
    const stateSet = new Set(hrrStates);
    const sameSet = orderSet.size === stateSet.size && Array.from(orderSet).every((state) => stateSet.has(state));
    if (order.length !== hrrStates.length || !sameSet) {
      throw valueError(`fire.zones[${zoneId}].hrr_state_order must be a permutation of hrr_states.`);
    }
    return order;
  }

  private static resolveHrrGivenBrigadeUnsuppressed(
    zone: SpecMapping,
    zoneId: string,
    brigadeStates: readonly string[],
    hrrStates: readonly string[],
  ): Map<string, number[]> {
    const raw = getValue(zone, "hrr_given_brigade_unsuppressed");
    if (!isMapping(raw)) {
      throw valueError(`fire.zones[${zoneId}].hrr_given_brigade_unsuppressed must be an object/mapping.`);
    }

    const output = new Map<string, number[]>();
    for (const brigadeState of keysOf(raw)) {
      const label = `fire.zones[${zoneId}].hrr_given_brigade_unsuppressed[${brigadeState}]`;
      output.set(brigadeState, FireBuilder.parseStateProbabilityRow(raw[brigadeState], hrrStates, label));
    }

    const missing = brigadeStates.filter((state) => !output.has(state));
    if (missing.length > 0) {
      throw valueError(`fire.zones[${zoneId}].hrr_given_brigade_unsuppressed missing brigade states ${repr(missing)}.`);
    }
    const extra = Array.from(output.keys()).filter((state) => !brigadeStates.includes(state));
    if (extra.length > 0) {
      throw valueError(
        `fire.zones[${zoneId}].hrr_given_brigade_unsuppressed has unknown brigade states ${repr(extra)}.`,
      );
    }
    return output;
  }

  private resolveAutoSuppressionHrrStateIndex(
    zone: SpecMapping,
    zoneId: string,
    hrrStates: readonly string[],
    hrrOrder: readonly string[],
    hrrNoneLabel: string,
  ): number {
    const raw = getValueOr(
      zone,
      "auto_sup_success_hrr_state",
      getValueOr(this.config, "auto_sup_success_hrr_state", hrrNoneLabel),
    );
    const choice = strip(text(raw));

    if (choice.toLowerCase() === "lowest_non_none") {
      for (const state of hrrOrder) {
        if (state !== hrrNoneLabel) {
          const index = FireBuilder.findStateIndex(hrrStates, state);
          if (index !== null) return index;
        }
      }
      throw valueError(`fire.zones[${zoneId}] cannot resolve lowest_non_none in HRR states.`);
    }

    const index = FireBuilder.findStateIndex(hrrStates, choice);
    if (index === null) {
      throw valueError(`fire.zones[${zoneId}].auto_sup_success_hrr_state '${choice}' not found in HRR states.`);
    }
    return index;
  }

  private static resolveDamageGivenHrr(
    ssc: SpecMapping,
    sscId: string,
    hrrStates: readonly string[],
  ): Map<string, number> {
    let raw = getValue(ssc, "damage_given_hrr");
    if (raw === null) raw = getValue(ssc, "damage_probs_by_hrr");
    if (raw === null) {
      throw valueError(`fire.sscs[${sscId}] must define damage_given_hrr (list or mapping).`);
    }
    const probabilities = FireBuilder.parseStateProbabilityValues(
      raw,
      hrrStates,
      `fire.sscs[${sscId}].damage_given_hrr`,
    );
    const output = new Map<string, number>();
    hrrStates.forEach((state, index) => output.set(state, probabilities[index]));
    return output;
  }

  private static checkDamageMonotonic(
    probabilitiesByState: Map<string, number>,
    hrrOrder: readonly string[],
    hrrNoneLabel: string,
    label: string,
    tolerance = 1e-12,
  ): void {
    const orderedStates = hrrOrder.filter((state) => state !== hrrNoneLabel);
    const values = orderedStates.map((state) => probabilitiesByState.get(state) ?? 0);
    for (let index = 1; index < values.length; index += 1) {
      if (values[index] + tolerance < values[index - 1]) {
        throw valueError(
          `Non-monotonic fire damage fragility for '${label}' at ordered HRR bins ` +
            `${orderedStates[index - 1]}->${orderedStates[index]}: ` +
            `${formatGeneral(values[index - 1], 6)} -> ${formatGeneral(values[index], 6)}`,
        );
      }
    }
  }

  private static parseBoolProbabilityRow(row: SpecValue, label: string): number[] {
    if (isMapping(row)) {
      if (!hasKey(row, "True") && !hasKey(row, "False")) {
        throw valueError(`${label} mapping must include 'False' and 'True' or be list-like length 2.`);
      }
      const falseProbability = toFloat(getValueOr(row, "False", 0));
      const trueProbability = toFloat(getValueOr(row, "True", 0));
      return FireBuilder.validateProbabilityVector([falseProbability, trueProbability], label);
    }
    return FireBuilder.parseProbabilityRow(row, 2, label);
  }

  private static parseStateProbabilityRow(row: SpecValue, states: readonly string[], label: string): number[] {
    if (isMapping(row)) {
      const output: number[] = [];
      for (const state of states) {
        if (!hasKey(row, state)) throw valueError(`${label} mapping missing state '${state}'.`);
        output.push(toFloat(row[state]));
      }
      return FireBuilder.validateProbabilityVector(output, label);
    }
    return FireBuilder.parseProbabilityRow(row, states.length, label);
  }

  private static parseStateProbabilityValue(value: SpecValue, label: string, state: string): number {
    let probability: number;
    try {
      probability = toFloat(value);
    } catch (error) {
      if (error instanceof NetworkBuilderError) throw valueError(`${label}[${state}] must be numeric.`);
      throw error;
    }
    if (probability < 0 || probability > 1) throw valueError(`${label}[${state}] must be in [0,1].`);
    return probability;
  }

  private static parseStateProbabilityValues(row: SpecValue, states: readonly string[], label: string): number[] {
    if (isMapping(row)) {
      const output: number[] = [];
      for (const state of states) {
        if (!hasKey(row, state)) throw valueError(`${label} mapping missing state '${state}'.`);
        output.push(FireBuilder.parseStateProbabilityValue(row[state], label, state));
      }
      return output;
    }

    if (!isSequence(row)) throw valueError(`${label} must be list-like or mapping keyed by HRR state.`);
    if (row.length !== states.length) {
      throw valueError(`${label} length ${row.length} must equal expected length ${states.length}.`);
    }
    return row.map((value, index) => FireBuilder.parseStateProbabilityValue(value, label, states[index]));
  }

  private static parseProbabilityRow(row: SpecValue, expectedLength: number, label: string): number[] {
    if (!isSequence(row)) throw valueError(`${label} must be list-like.`);
    const values = row.map((item) => toFloat(item));
    if (values.length !== expectedLength) {
      throw valueError(`${label} length ${values.length} must equal expected length ${expectedLength}.`);
    }
    return FireBuilder.validateProbabilityVector(values, label);
  }

  private static validateProbabilityVector(values: number[], label: string): number[] {
    if (values.some((value) => value < -1e-12 || value > 1 + 1e-12)) {
      throw valueError(`${label} values must be in [0,1].`);
    }
    const total = sum(values);
    if (Math.abs(total - 1) > 1e-9) {
      throw valueError(`${label} must sum to 1.0 (got ${formatGeneral(total, 12)}).`);
    }
    return values;
  }

  private static zoneUsesPgaForBrigade(zone: SpecMapping): boolean {
    return getValue(zone, "brigade_given_pga") !== null || getValue(zone, "brigade_given_pga_and_depth") !== null;
  }

  private static zoneUsesPgaForIgnition(zone: SpecMapping): boolean {
    return getValue(zone, "ignition_given_pga") !== null || getValue(zone, "ignition_fragility_given_pga") !== null;
  }

  private static zoneUsesPgaForAutoSuppression(zone: SpecMapping): boolean {
    return getValue(zone, "auto_suppression_fragility_given_pga") !== null;
  }

  private static usesPgaForIgnitionSourceDamage(sources: readonly IgnitionSource[]): boolean {
    return sources.some((source) => source.localDamage);
  }

  private resolveIgnitionSources(zone: SpecMapping, zoneId: string): IgnitionSource[] {
    const raw = getValueOr(zone, "ignition_sources", []);
    if (raw === null) return [];
    if (!isSequence(raw)) throw valueError(`fire.zones[${zoneId}].ignition_sources must be list-like.`);

    const output: IgnitionSource[] = [];
    for (let index = 0; index < raw.length; index += 1) {
      const item = raw[index];
      if (!isMapping(item)) {
        throw valueError(`fire.zones[${zoneId}].ignition_sources[${index}] must be an object/mapping.`);
      }
      if (getValueOr(item, "enabled", true) === false) continue;

      const prefix = `zones[${zoneId}].ignition_sources[${index}]`;
      const defaultSourceId = `source_${index + 1}`;
      const ignitionGivenDamage = FireBuilder.requireProbability(
        getValue(item, "p_ignition_given_damage"),
        `${prefix}.p_ignition_given_damage`,
      );
      const ignitionGivenNoDamage = FireBuilder.requireProbability(
        getValueOr(item, "p_ignition_given_no_damage", 0),
        `${prefix}.p_ignition_given_no_damage`,
      );
      const damageTrueState = textOr(item, "damage_true_state", "True");
      const allowExtraDamageParents = truthy(getValueOr(item, "allow_extra_damage_parents", false));
      const rawSourceFragility = getValue(item, "damage_fragility_given_pga");
      if (rawSourceFragility !== null) {
        if (!isMapping(rawSourceFragility)) {
          throw valueError(`fire.${prefix}.damage_fragility_given_pga must be a mapping.`);
        }
        const sourceId = FireBuilder.requireText(getValueOr(item, "source_id", defaultSourceId), `${prefix}.source_id`);
        const rawParentKey = strip(text(getValueOr(item, "damage_parent_key", getValueOr(item, "damage_key", ""))));
        const parentKey = rawParentKey.length > 0 ? rawParentKey : FireBuilder.sourceDamageKey(zoneId, sourceId);
        const nodeId = textOr(item, "damage_node_id", FireBuilder.defaultSourceDamageNodeId(zoneId, sourceId));
        const theta = FireBuilder.requirePositiveFloat(
          getValue(rawSourceFragility, "theta"),
          `${prefix}.damage_fragility_given_pga.theta`,
        );
        const beta = FireBuilder.requirePositiveFloat(
          getValue(rawSourceFragility, "beta"),
          `${prefix}.damage_fragility_given_pga.beta`,
        );
        const probFloor = FireBuilder.requireProbability(
          getValueOr(rawSourceFragility, "prob_floor", 0),
          `${prefix}.damage_fragility_given_pga.prob_floor`,
        );
        const probCap = FireBuilder.requireProbability(
          getValueOr(rawSourceFragility, "prob_cap", 1),
          `${prefix}.damage_fragility_given_pga.prob_cap`,
        );
        if (probFloor > probCap) {
          throw valueError(`fire.${prefix}.damage_fragility_given_pga requires prob_floor <= prob_cap.`);
        }
        const noneProbability = FireBuilder.requireProbability(
          getValueOr(rawSourceFragility, "prob_none", 0),
          `${prefix}.damage_fragility_given_pga.prob_none`,
        );

        output.push({
          localDamage: true,
          sourceId,
          damageParentKey: parentKey,
          damageNodeId: nodeId,
          damageFragilityTheta: theta,
          damageFragilityBeta: beta,
          damageProbFloor: probFloor,
          damageProbCap: probCap,
          damageProbWhenPgaNone: noneProbability,
          damageTrueState,
          ignitionGivenDamage,
          ignitionGivenNoDamage,
          allowExtraDamageParents,
        });
        continue;
      }

      const parentKey = FireBuilder.requireText(getValue(item, "damage_parent_key"), `${prefix}.damage_parent_key`);
      output.push({
        localDamage: false,
        sourceId: textOr(item, "source_id", defaultSourceId),
        damageParentKey: parentKey,
        damageNodeId: "",
        damageFragilityTheta: 0,
        damageFragilityBeta: 0,
        damageProbFloor: 0,
        damageProbCap: 0,
        damageProbWhenPgaNone: 0,
        damageTrueState,
        ignitionGivenDamage,
        ignitionGivenNoDamage,
        allowExtraDamageParents,
      });
    }
    return output;
  }

  private pgaKey(): string {
    return strip(text(getValueOr(this.config, "pga_key", "hazard.seismic.PGA")));
  }

  private pgaStatesRef(): string {
    return strip(text(getValueOr(this.config, "pga_states_ref", "PGA")));
  }

  private pgaNoneStateLabel(): string {
    return textOr(this.config, "pga_none_state_label", "None");
  }

  private hrrNoneStateLabel(): string {
    return textOr(this.config, "hrr_none_state_label", "None");
  }

  private zoneFloodDepthKey(zone: SpecMapping, zoneId: string): string | null {
    for (const rawKey of [getValue(zone, "flood_depth_key"), getValue(zone, "flood_area_key")]) {
      if (rawKey === null) continue;
      if (typeof rawKey !== "string") {
        throw valueError(`fire.zones[${zoneId}].flood_depth_key/flood_area_key must be a string.`);
      }
      const key = strip(rawKey);
      if (key.length > 0) return key;
    }
    return null;
  }

  private static ignitionKey(zoneId: string): string {
    return `fire.ignition.${zoneId}`;
  }

  private static defaultIgnitionNodeId(zoneId: string): string {
    return `FIRE_IGNITION_${slug(zoneId).toUpperCase()}`;
  }

  private static autoSuppressionKey(zoneId: string): string {
    return `fire.auto_suppression_success.${zoneId}`;
  }

  private static defaultAutoSuppressionNodeId(zoneId: string): string {
    return `FIRE_AUTO_SUPPRESSION_SUCCESS_${slug(zoneId).toUpperCase()}`;
  }

  private static zoneAccessKey(zoneId: string): string {
    return `fire.zone_accessible.${zoneId}`;
  }

  private static defaultZoneAccessNodeId(zoneId: string): string {
    return `FIRE_ZONE_ACCESSIBLE_${slug(zoneId).toUpperCase()}`;
  }

  private static brigadeKey(zoneId: string): string {
    return `fire.brigade_arrival_bin.${zoneId}`;
  }

  private static defaultBrigadeNodeId(zoneId: string): string {
    return `FIRE_BRIGADE_ARRIVAL_BIN_${slug(zoneId).toUpperCase()}`;
  }

  private static hrrKey(zoneId: string): string {
    return `fire.effective_HRR.${zoneId}`;
  }

  private static defaultHrrNodeId(zoneId: string): string {
    return `FIRE_EFFECTIVE_HRR_${slug(zoneId).toUpperCase()}`;
  }

  private static damageKey(sscId: string): string {
    return `fire.damage.${sscId}`;
  }

  private static defaultDamageNodeId(sscId: string): string {
    return `FIRE_FAIL_${slug(sscId).toUpperCase()}`;
  }

  private static sourceDamageKey(zoneId: string, sourceId: string): string {
    return `fire.source_damage.${zoneId}.${sourceId}`;
  }

  private static defaultSourceDamageNodeId(zoneId: string, sourceId: string): string {
    return `FIRE_SOURCE_DAMAGE_${slug(zoneId).toUpperCase()}_${slug(sourceId).toUpperCase()}`;
  }

  private resolvePgaStateValues(
    context: ModelContext,
    pgaStates: readonly string[],
    pgaNoneLabel: string,
  ): Map<string, number> {
    const statesRef = this.pgaStatesRef();
    let centers: number[];
    let referenceStates: string[];
    if (hasKey(this.config, "pga_bin_centers")) {
      const rawCenters = getValue(this.config, "pga_bin_centers");
      if (!isSequence(rawCenters)) throw valueError("fire.pga_bin_centers must be list-like when provided.");
      centers = rawCenters.map((item) => toFloat(item));
      referenceStates = pgaStates.filter((state) => state !== pgaNoneLabel);
    } else {
      if (!context.discretization.has(statesRef)) {
        throw valueError(
          "fire ignition_fragility_given_pga requires either " +
            `discretization['${statesRef}'] or explicit fire.pga_bin_centers.`,
        );
      }
      if (!context.discretization.hasCenters(statesRef)) {
        throw valueError(`fire ignition_fragility_given_pga requires centers for discretization '${statesRef}'.`);
      }
      referenceStates = context.discretization.states(statesRef);
      centers = context.discretization.centers(statesRef);
    }

    if (referenceStates.length !== centers.length) {
      throw valueError(
        `fire ignition_fragility_given_pga: PGA states length ${referenceStates.length} ` +
          `must match center count ${centers.length}.`,
      );
    }
    if (centers.some((center) => center <= 0)) {
      throw valueError("fire ignition_fragility_given_pga requires all non-none PGA centers to be > 0.");
    }

    const referenceMap = new Map<string, number>();
    referenceStates.forEach((state, index) => referenceMap.set(state, centers[index]));
    const output = new Map<string, number>();
    for (const state of pgaStates) {
      if (state === pgaNoneLabel) {
        output.set(state, 0);
        continue;
      }
      const center = referenceMap.get(state);
      if (center === undefined) {
        throw valueError(
          `fire ignition_fragility_given_pga could not map PGA state '${state}' ` +
            `from discretization '${statesRef}'.`,
        );
      }
      output.set(state, center);
    }
    return output;
  }

  private zoneItems(): SpecMapping[] {
    const raw = getValue(this.config, "zones");
    if (!isSequence(raw) || raw.length === 0) throw valueError("fire builder requires non-empty 'zones' list.");
    return raw.map((item, index) => {
      if (!isMapping(item)) throw valueError(`fire.zones[${index}] must be an object/mapping.`);
      return item;
    });
  }

  private sscItems(): SpecMapping[] {
    const raw = getValueOr(this.config, "sscs", []);
    if (!isSequence(raw)) throw valueError("fire.sscs must be list-like.");
    return raw.map((item, index) => {
      if (!isMapping(item)) throw valueError(`fire.sscs[${index}] must be an object/mapping.`);
      return item;
    });
  }

  private static oneHot(count: number, index: number): number[] {
    if (index < 0 || index >= count) throw valueError(`one-hot index ${index} out of range for n=${count}.`);
    const output = new Array<number>(count).fill(0);
    output[index] = 1;
    return output;
  }

  private static findStateIndex(states: readonly string[], stateName: string): number | null {
    for (let index = 0; index < states.length; index += 1) {
      if (states[index] === stateName) return index;
    }
    return null;
  }

  private static clamp01(value: number): number {
    if (value < 0) return 0;
    if (value > 1) return 1;
    return value;
  }

  private static normalCdf(z: number): number {
    return 0.5 * (1 + errorFunction(z / Math.sqrt(2)));
  }

  private static fragilityProbability(intensity: number, theta: number, beta: number): number {
    const ratio = intensity / theta;
    if (ratio <= 0) throw valueError("math domain error");
    const z = Math.log(ratio) / beta;
    return FireBuilder.clamp01(FireBuilder.normalCdf(z));
  }

  private static requireText(value: SpecValue, label: string): string {
    if (typeof value !== "string" || strip(value).length === 0) {
      throw valueError(`fire.${label} must be a non-empty string.`);
    }
    return strip(value);
  }

  private static requireFloat(value: SpecValue, label: string): number {
    try {
      return toFloat(value);
    } catch (error) {
      if (error instanceof NetworkBuilderError) throw valueError(`fire.${label} must be numeric.`);
      throw error;
    }
  }

  private static requireNonNegativeFloat(value: SpecValue, label: string): number {
    const parsed = FireBuilder.requireFloat(value, label);
    if (parsed < 0) throw valueError(`fire.${label} must be >= 0.`);
    return parsed;
  }

  private static requirePositiveFloat(value: SpecValue, label: string): number {
    const parsed = FireBuilder.requireFloat(value, label);
    if (parsed <= 0) throw valueError(`fire.${label} must be > 0.`);
    return parsed;
  }

  private static requireProbability(value: SpecValue, label: string): number {
    const parsed = FireBuilder.requireFloat(value, label);
    if (parsed < 0 || parsed > 1) throw valueError(`fire.${label} must be in [0,1].`);
    return parsed;
  }
}

export { FireBuilder };
