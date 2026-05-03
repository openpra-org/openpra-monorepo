export type QuantumRecoveryOrderName = "declared_order" | "reversed_order";

export type QuantumRecoveryPrimaryMode =
  | "exact_hardware_recovery"
  | "union_sensitivity_recovery"
  | "partial_exact_hardware_recovery";

export interface QuantumRecoveryRawCountsInput {
  modelId: string;
  candidateRootNodeId: string;
  topologyClass?: string;
  basicEventCount?: number;
  requiredQubits?: number;
  orderedBasicEventIds: string[];
  bitstringConvention: string;
  counts: Record<string, number>;
  shotsTotal?: number;
  measurementBasis?: string;
  bitstringIndexConvention?: string;
}

export interface QuantumRecoveryClassicalReferenceInput {
  modelId: string;
  candidateRootNodeId: string;
  frozenMcsReference: {
    minimalCutSetCount: number;
    basicEventIdSets: string[][];
    bitstrings: string[];
  };
}

export interface QuantumRecoveryExactSupportRow {
  rawBitstring: string;
  interpretedBitstring: string;
  count: number;
  fraction: number;
  basicEventIdSet: string[];
}

export interface QuantumRecoveryNearMissRow {
  rawBitstring: string;
  interpretedBitstring: string;
  count: number;
  fraction: number;
  hammingDistance: number;
  relationToMissingReference: "exact" | "superset" | "subset" | "overlap" | "disjoint";
  basicEventIdSet: string[];
}

export interface QuantumRecoveryOrderAudit {
  orderName: QuantumRecoveryOrderName;
  shotsTotal: number;
  exactFraction: number;
  supersetFraction: number;
  neitherFraction: number;
  recoveredExactCutSetCount: number;
  exactRefCounts: Record<string, number>;
  recoveredBasicEventIdSets: string[][];
  exactSupportRows: QuantumRecoveryExactSupportRow[];
  missingReferenceBitstrings: string[];
  missingReferenceEventSets: string[][];
  nearMissAnalysis: Record<string, QuantumRecoveryNearMissRow[]>;
}

export interface QuantumRecoveryUnionReferenceRow {
  referenceBitstring: string;
  referenceBasicEventIdSet: string[];
  recoveredInDeclaredOrder: boolean;
  recoveredInReversedOrder: boolean;
  recoveredInUnion: boolean;
  declaredExactCount: number;
  reversedExactCount: number;
}

export interface QuantumRecoveryUnionAudit {
  unionRecoveredCount: number;
  referenceCount: number;
  allRecoveredInUnion: boolean;
  perReference: QuantumRecoveryUnionReferenceRow[];
  unionMissing: QuantumRecoveryUnionReferenceRow[];
  unionBasicEventIdSets: string[][];
  unionSupportRows: Array<QuantumRecoveryExactSupportRow & { recoverySource: QuantumRecoveryOrderName }>;
}

export interface QuantumRecoveryIntegrationRecommendation {
  primaryMode: QuantumRecoveryPrimaryMode;
  requiresOperatorAttention: boolean;
  recommendedBasicEventIdSets: string[][];
  recommendedSupportRows: QuantumRecoveryExactSupportRow[];
  summary: string;
  supplementalUnionOnlyBasicEventIdSets?: string[][];
}

export interface QuantumRecoveryLadderResult {
  generatedAt: string;
  modelId: string;
  candidateRootNodeId: string;
  topologyClass?: string;
  basicEventCount?: number;
  requiredQubits?: number;
  shotsTotal: number;
  bitstringConventionDeclaredInRawCounts: string;
  orderedBasicEventIds: string[];
  referenceCutSetCount: number;
  referenceBitstrings: string[];
  referenceBasicEventIdSets: string[][];
  recoveryTier1ExactHardware: QuantumRecoveryOrderAudit;
  recoveryTier2AlternateOrientation: QuantumRecoveryOrderAudit;
  recoveryTier3UnionSensitivity: QuantumRecoveryUnionAudit;
  recoveryTier4NearMissAdvisory: Record<string, QuantumRecoveryNearMissRow[]>;
  integrationRecommendation: QuantumRecoveryIntegrationRecommendation;
  recommendedOpenpraRecoveryLadder: string[];
}

function sumCounts(counts: Record<string, number>): number {
  return Object.values(counts).reduce((sum, value) => sum + value, 0);
}

function transformBitstring(rawBitstring: string, orderName: QuantumRecoveryOrderName): string {
  if (orderName === "declared_order") {
    return rawBitstring;
  }

  return rawBitstring.split("").reverse().join("");
}

function bitstringToEventIds(bitstring: string, orderedBasicEventIds: string[]): string[] {
  return orderedBasicEventIds.filter((_, index) => bitstring[index] === "1");
}

function eventSet(bitstring: string, orderedBasicEventIds: string[]): Set<string> {
  return new Set(bitstringToEventIds(bitstring, orderedBasicEventIds));
}

function hammingDistance(left: string, right: string): number {
  if (left.length !== right.length) {
    throw new Error("Bitstrings must have identical length.");
  }

  let distance = 0;
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) {
      distance += 1;
    }
  }

  return distance;
}

function isSubset(left: Set<string>, right: Set<string>): boolean {
  for (const value of left) {
    if (!right.has(value)) {
      return false;
    }
  }

  return true;
}

function setsEqual(left: Set<string>, right: Set<string>): boolean {
  return left.size === right.size && isSubset(left, right);
}

function relationToReference(
  observed: Set<string>,
  reference: Set<string>,
): "exact" | "superset" | "subset" | "overlap" | "disjoint" {
  if (setsEqual(observed, reference)) {
    return "exact";
  }

  if (isSubset(reference, observed)) {
    return "superset";
  }

  if (isSubset(observed, reference)) {
    return "subset";
  }

  const hasOverlap = [...observed].some((value) => reference.has(value));
  return hasOverlap ? "overlap" : "disjoint";
}

export function auditQuantumRecoveryOrder(
  rawCounts: QuantumRecoveryRawCountsInput,
  classicalReference: QuantumRecoveryClassicalReferenceInput,
  orderName: QuantumRecoveryOrderName,
): QuantumRecoveryOrderAudit {
  const shotsTotal = rawCounts.shotsTotal ?? sumCounts(rawCounts.counts);
  const orderedBasicEventIds = [...rawCounts.orderedBasicEventIds];
  const referenceBitstrings = [...classicalReference.frozenMcsReference.bitstrings];

  const referenceSets = new Map(
    referenceBitstrings.map((bitstring) => [bitstring, eventSet(bitstring, orderedBasicEventIds)]),
  );

  const exactRefCounts: Record<string, number> = Object.fromEntries(
    referenceBitstrings.map((bitstring) => [bitstring, 0]),
  );

  const exactSupportRowsByRef: Record<string, QuantumRecoveryExactSupportRow[]> = Object.fromEntries(
    referenceBitstrings.map((bitstring) => [bitstring, []]),
  );

  let exactMass = 0;
  let supersetMass = 0;
  let neitherMass = 0;

  for (const [rawBitstring, countValue] of Object.entries(rawCounts.counts).sort(([left], [right]) =>
    left.localeCompare(right),
  )) {
    const count = Number(countValue);
    const interpretedBitstring = transformBitstring(rawBitstring, orderName);
    const observedSet = eventSet(interpretedBitstring, orderedBasicEventIds);

    if (referenceSets.has(interpretedBitstring)) {
      exactMass += count;
      exactRefCounts[interpretedBitstring] += count;
      exactSupportRowsByRef[interpretedBitstring].push({
        rawBitstring,
        interpretedBitstring,
        count,
        fraction: shotsTotal > 0 ? count / shotsTotal : 0,
        basicEventIdSet: bitstringToEventIds(interpretedBitstring, orderedBasicEventIds),
      });
      continue;
    }

    const isProperSuperset = [...referenceSets.values()].some(
      (referenceSet) => isSubset(referenceSet, observedSet) && !setsEqual(referenceSet, observedSet),
    );

    if (isProperSuperset) {
      supersetMass += count;
    } else {
      neitherMass += count;
    }
  }

  const missingReferenceBitstrings = referenceBitstrings.filter((bitstring) => exactRefCounts[bitstring] === 0);

  const missingReferenceEventSets = missingReferenceBitstrings.map((bitstring) =>
    bitstringToEventIds(bitstring, orderedBasicEventIds),
  );

  const nearMissAnalysis: Record<string, QuantumRecoveryNearMissRow[]> = {};

  for (const missingBitstring of missingReferenceBitstrings) {
    const missingReferenceSet = referenceSets.get(missingBitstring);
    if (!missingReferenceSet) {
      continue;
    }

    const rows: QuantumRecoveryNearMissRow[] = Object.entries(rawCounts.counts).map(([rawBitstring, countValue]) => {
      const interpretedBitstring = transformBitstring(rawBitstring, orderName);
      const observedSet = eventSet(interpretedBitstring, orderedBasicEventIds);
      const count = Number(countValue);

      return {
        rawBitstring,
        interpretedBitstring,
        count,
        fraction: shotsTotal > 0 ? count / shotsTotal : 0,
        hammingDistance: hammingDistance(interpretedBitstring, missingBitstring),
        relationToMissingReference: relationToReference(observedSet, missingReferenceSet),
        basicEventIdSet: bitstringToEventIds(interpretedBitstring, orderedBasicEventIds),
      };
    });

    rows.sort((left, right) => {
      if (left.hammingDistance !== right.hammingDistance) {
        return left.hammingDistance - right.hammingDistance;
      }

      if (left.count !== right.count) {
        return right.count - left.count;
      }

      return left.rawBitstring.localeCompare(right.rawBitstring);
    });

    nearMissAnalysis[missingBitstring] = rows.slice(0, 20);
  }

  const recoveredBasicEventIdSets = referenceBitstrings
    .filter((bitstring) => exactRefCounts[bitstring] > 0)
    .map((bitstring) => bitstringToEventIds(bitstring, orderedBasicEventIds));

  const exactSupportRows = referenceBitstrings.flatMap((bitstring) => exactSupportRowsByRef[bitstring]);

  return {
    orderName,
    shotsTotal,
    exactFraction: shotsTotal > 0 ? exactMass / shotsTotal : 0,
    supersetFraction: shotsTotal > 0 ? supersetMass / shotsTotal : 0,
    neitherFraction: shotsTotal > 0 ? neitherMass / shotsTotal : 0,
    recoveredExactCutSetCount: referenceBitstrings.filter((bitstring) => exactRefCounts[bitstring] > 0).length,
    exactRefCounts,
    recoveredBasicEventIdSets,
    exactSupportRows,
    missingReferenceBitstrings,
    missingReferenceEventSets,
    nearMissAnalysis,
  };
}

export function buildQuantumRecoveryUnion(
  rawCounts: QuantumRecoveryRawCountsInput,
  classicalReference: QuantumRecoveryClassicalReferenceInput,
  declaredOrder: QuantumRecoveryOrderAudit,
  reversedOrder: QuantumRecoveryOrderAudit,
): QuantumRecoveryUnionAudit {
  const referenceBitstrings = [...classicalReference.frozenMcsReference.bitstrings];
  const orderedBasicEventIds = [...rawCounts.orderedBasicEventIds];

  const declaredRowsByRef = new Map(declaredOrder.exactSupportRows.map((row) => [row.interpretedBitstring, row]));
  const reversedRowsByRef = new Map(reversedOrder.exactSupportRows.map((row) => [row.interpretedBitstring, row]));

  const perReference: QuantumRecoveryUnionReferenceRow[] = [];
  const unionBasicEventIdSets: string[][] = [];
  const unionSupportRows: Array<QuantumRecoveryExactSupportRow & { recoverySource: QuantumRecoveryOrderName }> = [];

  for (const referenceBitstring of referenceBitstrings) {
    const declaredHit = declaredOrder.exactRefCounts[referenceBitstring] > 0;
    const reversedHit = reversedOrder.exactRefCounts[referenceBitstring] > 0;
    const recoveredInUnion = declaredHit || reversedHit;

    perReference.push({
      referenceBitstring,
      referenceBasicEventIdSet: bitstringToEventIds(referenceBitstring, orderedBasicEventIds),
      recoveredInDeclaredOrder: declaredHit,
      recoveredInReversedOrder: reversedHit,
      recoveredInUnion,
      declaredExactCount: declaredOrder.exactRefCounts[referenceBitstring],
      reversedExactCount: reversedOrder.exactRefCounts[referenceBitstring],
    });

    if (!recoveredInUnion) {
      continue;
    }

    unionBasicEventIdSets.push(bitstringToEventIds(referenceBitstring, orderedBasicEventIds));

    if (declaredHit) {
      const row = declaredRowsByRef.get(referenceBitstring);
      if (row) {
        unionSupportRows.push({
          ...row,
          recoverySource: "declared_order",
        });
      }
      continue;
    }

    const reversedRow = reversedRowsByRef.get(referenceBitstring);
    if (reversedRow) {
      unionSupportRows.push({
        ...reversedRow,
        recoverySource: "reversed_order",
      });
    }
  }

  const unionMissing = perReference.filter((row) => !row.recoveredInUnion);

  return {
    unionRecoveredCount: perReference.filter((row) => row.recoveredInUnion).length,
    referenceCount: referenceBitstrings.length,
    allRecoveredInUnion: unionMissing.length === 0,
    perReference,
    unionMissing,
    unionBasicEventIdSets,
    unionSupportRows,
  };
}

export function determineQuantumRecoveryRecommendation(
  referenceCount: number,
  declaredOrder: QuantumRecoveryOrderAudit,
  unionRecovery: QuantumRecoveryUnionAudit,
): QuantumRecoveryIntegrationRecommendation {
  if (declaredOrder.recoveredExactCutSetCount === referenceCount) {
    return {
      primaryMode: "exact_hardware_recovery",
      requiresOperatorAttention: false,
      recommendedBasicEventIdSets: declaredOrder.recoveredBasicEventIdSets,
      recommendedSupportRows: declaredOrder.exactSupportRows,
      summary: "Declared-order exact recovery is complete.",
    };
  }

  if (unionRecovery.allRecoveredInUnion) {
    const supplementalUnionOnlyBasicEventIdSets = unionRecovery.perReference
      .filter((row) => row.recoveredInUnion && !row.recoveredInDeclaredOrder && row.recoveredInReversedOrder)
      .map((row) => row.referenceBasicEventIdSet);

    return {
      primaryMode: "union_sensitivity_recovery",
      requiresOperatorAttention: true,
      recommendedBasicEventIdSets: declaredOrder.recoveredBasicEventIdSets,
      recommendedSupportRows: declaredOrder.exactSupportRows,
      supplementalUnionOnlyBasicEventIdSets,
      summary:
        "Declared-order exact recovery is incomplete, but union across declared and reversed orientations recovers all reference cut sets.",
    };
  }

  return {
    primaryMode: "partial_exact_hardware_recovery",
    requiresOperatorAttention: true,
    recommendedBasicEventIdSets: declaredOrder.recoveredBasicEventIdSets,
    recommendedSupportRows: declaredOrder.exactSupportRows,
    summary: "Declared-order exact recovery is incomplete and union recovery is also incomplete.",
  };
}

export function buildQuantumRecoveryLadderResult(
  rawCounts: QuantumRecoveryRawCountsInput,
  classicalReference: QuantumRecoveryClassicalReferenceInput,
): QuantumRecoveryLadderResult {
  const declaredOrder = auditQuantumRecoveryOrder(rawCounts, classicalReference, "declared_order");

  const reversedOrder = auditQuantumRecoveryOrder(rawCounts, classicalReference, "reversed_order");

  const unionRecovery = buildQuantumRecoveryUnion(rawCounts, classicalReference, declaredOrder, reversedOrder);

  const integrationRecommendation = determineQuantumRecoveryRecommendation(
    classicalReference.frozenMcsReference.minimalCutSetCount,
    declaredOrder,
    unionRecovery,
  );

  return {
    generatedAt: new Date().toISOString(),
    modelId: rawCounts.modelId,
    candidateRootNodeId: rawCounts.candidateRootNodeId,
    topologyClass: rawCounts.topologyClass,
    basicEventCount: rawCounts.basicEventCount,
    requiredQubits: rawCounts.requiredQubits,
    shotsTotal: rawCounts.shotsTotal ?? sumCounts(rawCounts.counts),
    bitstringConventionDeclaredInRawCounts: rawCounts.bitstringConvention,
    orderedBasicEventIds: [...rawCounts.orderedBasicEventIds],
    referenceCutSetCount: classicalReference.frozenMcsReference.minimalCutSetCount,
    referenceBitstrings: [...classicalReference.frozenMcsReference.bitstrings],
    referenceBasicEventIdSets: classicalReference.frozenMcsReference.basicEventIdSets,
    recoveryTier1ExactHardware: declaredOrder,
    recoveryTier2AlternateOrientation: reversedOrder,
    recoveryTier3UnionSensitivity: unionRecovery,
    recoveryTier4NearMissAdvisory: declaredOrder.nearMissAnalysis,
    integrationRecommendation,
    recommendedOpenpraRecoveryLadder: [
      "Exact hardware recovery under declared order",
      "Alternate orientation audit",
      "Union sensitivity recovery",
      "Near miss advisory",
      "Targeted rerun if ambiguity remains material",
    ],
  };
}
