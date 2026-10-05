import { DistributionType } from "interfaces-mef-types/core/events";
import type {
  CcfParameterEstimation,
  DataAnalysis,
  DaCcfMethod,
  DaDataNeeds,
  DaCcfTesting,
  DaSourceEntry,
} from "interfaces-mef-types/da/data-analysis";
import type { CommonCauseFailureGroup } from "interfaces-mef-types/sy/systems-analysis";
import { distributionQuantile } from "./daDistributions";
import type { DaFindingSeverity, DaNeedFinding } from "./daSelectors";

const RANK: Record<DaFindingSeverity, number> = { error: 0, warning: 1, note: 2 };

const MGL_NAMES = ["beta", "gamma", "delta"];

type DaCcfModel = CcfParameterEstimation["modelType"];

interface DaCcfTemplate {
  sourceId: string;
  code: string;
  component: string;
  failureMode: string;
  table: string;
  sizes: number[];
}

interface DaCcfAlpha {
  k: number;
  mean: number;
  p05?: number;
  p95?: number;
  prior?: number;
}

interface DaCcfCombination {
  k: number;
  count: number;
  coefficient: number;
  each?: number;
}

interface DaCcfHandoff {
  modelType: DaCcfModel;
  parameters: Record<string, number>;
}

interface DaCcfResult {
  size?: number;
  testing: DaCcfTesting;
  method?: DaCcfMethod;
  qt?: number;
  qtFrom?: "PARAMETER" | "SY";
  template?: DaCcfTemplate;
  prior?: number[];
  counts?: number[];
  posterior?: number[];
  alphas: DaCcfAlpha[];
  handoff?: DaCcfHandoff;
  combinations: DaCcfCombination[];
  problem?: string;
}

const resultCache = new WeakMap<DataAnalysis, Map<string, DaCcfResult>>();

const findingCache = new WeakMap<DataAnalysis, DaNeedFinding[]>();

function blank(text: string | undefined): boolean {
  return text === undefined || text.trim().length === 0;
}

function sum(values: readonly number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

function choose(n: number, k: number): number {
  if (k < 0 || k > n) return 0;
  let result = 1;
  for (let i = 1; i <= k; i += 1) result = (result * (n - k + i)) / i;
  return result;
}

function sci(value: number): string {
  return Number(value.toPrecision(3)).toExponential().replace("e+", "E").replace("e", "E");
}

function ccfFactorsOf(group: CommonCauseFailureGroup): { factors: Record<string, number>; total?: number } {
  const parameters = group.modelSpecificParameters;
  if (parameters?.betaFactorParameters !== undefined) {
    return { factors: { beta: parameters.betaFactorParameters.beta }, total: parameters.betaFactorParameters.totalFailureProbability };
  }
  if (parameters?.alphaFactorParameters !== undefined) {
    return { factors: { ...parameters.alphaFactorParameters.alphaFactors }, total: parameters.alphaFactorParameters.totalFailureProbability };
  }
  if (parameters?.mglParameters !== undefined) {
    const mgl = parameters.mglParameters;
    const factors: Record<string, number> = { beta: mgl.beta, ...(mgl.additionalFactors ?? {}) };
    if (typeof mgl.gamma === "number") factors.gamma = mgl.gamma;
    if (typeof mgl.delta === "number") factors.delta = mgl.delta;
    return { factors, total: mgl.totalFailureProbability };
  }
  if (parameters?.phiFactorParameters !== undefined) {
    return { factors: { ...parameters.phiFactorParameters.phiFactors }, total: parameters.phiFactorParameters.totalFailureProbability };
  }
  return { factors: {} };
}

function templateParts(id: string): { code: string; size: number; order: number } | undefined {
  const parts = id.split("-");
  const last = parts[parts.length - 1] ?? "";
  const before = parts[parts.length - 2] ?? "";
  if (parts.length < 3 || !last.startsWith("A") || !before.startsWith("C")) return undefined;
  const order = Number(last.slice(1));
  const size = Number(before.slice(1));
  if (!Number.isInteger(order) || !Number.isInteger(size) || order < 1 || size < 2 || order > size) return undefined;
  return { code: parts.slice(0, -2).join("-"), size, order };
}

function baseFailureMode(text: string): string {
  const cut = text.indexOf(", CCCG");
  return cut === -1 ? text : text.slice(0, cut);
}

function ccfTemplates(sourceId: string, entries: readonly DaSourceEntry[]): DaCcfTemplate[] {
  const found = new Map<string, { template: DaCcfTemplate; orders: Map<number, Set<number>> }>();
  for (const entry of entries) {
    const parts = templateParts(entry.id);
    if (parts === undefined || entry.distribution?.type !== DistributionType.BETA) continue;
    let record = found.get(parts.code);
    if (record === undefined) {
      record = { template: { sourceId, code: parts.code, component: entry.component, failureMode: baseFailureMode(entry.failureMode), table: entry.table ?? "", sizes: [] }, orders: new Map() };
      found.set(parts.code, record);
    }
    const orders = record.orders.get(parts.size) ?? new Set<number>();
    orders.add(parts.order);
    record.orders.set(parts.size, orders);
  }
  return [...found.values()].map(({ template, orders }) => ({
    ...template,
    sizes: [...orders.entries()].filter(([size, seen]) => seen.size === size).map(([size]) => size).sort((a, b) => a - b),
  })).filter((template) => template.sizes.length > 0);
}

function templateEntryIds(code: string, size: number): string[] {
  return Array.from({ length: size }, (_, index) => `${code}-C${size}-A${index + 1}`);
}

function testingOf(estimate: CcfParameterEstimation): DaCcfTesting {
  return estimate.testing ?? "NON_STAGGERED";
}

function methodOf(estimate: CcfParameterEstimation): DaCcfMethod | undefined {
  return estimate.method;
}

function memberParameterIds(needs: DaDataNeeds, memberIds: readonly string[]): string[] {
  const events = new Map(needs.basicEvents.flatMap((need) => [[need.id, need] as const, [need.code, need] as const]));
  return [...new Set(memberIds.flatMap((id) => {
    const need = events.get(id);
    const parameterId = need?.parameterId ?? (need?.valueHeldBy === "DA" ? need.valueHolderId : undefined);
    return parameterId === undefined ? [] : [parameterId];
  }))];
}

function shareFromNeeds(da: DataAnalysis, estimate: CcfParameterEstimation): { members: string[]; parameterIds: string[]; total?: number } | undefined {
  const needs = da.dataNeeds;
  const group = needs?.ccfGroups.find((candidate) => candidate.id === estimate.ccfGroupReference);
  if (needs === undefined || group === undefined) return undefined;
  return { members: group.memberIds, parameterIds: memberParameterIds(needs, group.memberIds), total: group.totalProbability };
}

function qtOf(da: DataAnalysis, estimate: CcfParameterEstimation): { qt?: number; from?: "PARAMETER" | "SY" } {
  const parameterId = estimate.memberParameterId ?? shareFromNeeds(da, estimate)?.parameterIds[0];
  const parameter = parameterId === undefined ? undefined : da.parameters.find((candidate) => candidate.uuid === parameterId);
  if (parameter?.value !== undefined && parameter.parameterType !== "FAILURE_RATE" && parameter.parameterType !== "FREQUENCY" && parameter.value >= 0 && parameter.value <= 1) return { qt: parameter.value, from: "PARAMETER" };
  const total = shareFromNeeds(da, estimate)?.total;
  return total === undefined ? {} : { qt: total, from: "SY" };
}

function mglValues(parameters: Record<string, number>): number[] {
  const named = MGL_NAMES.flatMap((key) => {
    const value = parameters[key];
    return value === undefined ? [] : [value];
  });
  const rest = Object.entries(parameters).filter(([key]) => !MGL_NAMES.includes(key)).sort(([left], [right]) => left.localeCompare(right, undefined, { numeric: true })).map(([, value]) => value);
  return [...named, ...rest];
}

function orderedValues(parameters: Record<string, number>): number[] {
  return Object.entries(parameters).sort(([left], [right]) => left.localeCompare(right, undefined, { numeric: true })).map(([, value]) => value);
}

function expansionCoefficients(modelType: DaCcfModel, parameters: Record<string, number>, size: number): number[] | undefined {
  if (size < 2) return undefined;
  if (modelType === "BETA_FACTOR") {
    const beta = parameters["beta"] ?? orderedValues(parameters)[0];
    if (beta === undefined) return undefined;
    return Array.from({ length: size }, (_, index) => (index === 0 ? 1 - beta : index === size - 1 ? beta : 0));
  }
  if (modelType === "ALPHA_FACTOR") {
    const alphas = orderedValues(parameters);
    if (alphas.length !== size) return undefined;
    const total = sum(alphas.map((alpha, index) => (index + 1) * alpha));
    if (!(total > 0)) return undefined;
    return alphas.map((alpha, index) => ((index + 1) * alpha) / (total * choose(size - 1, index)));
  }
  if (modelType === "MGL") {
    const rho = mglValues(parameters);
    if (rho.length === 0 || rho.length > size - 1) return undefined;
    const top = rho.length + 1;
    return Array.from({ length: size }, (_, index) => {
      const k = index + 1;
      if (k > top) return 0;
      let product = 1;
      for (let i = 0; i < k - 1; i += 1) product *= rho[i] ?? 0;
      const closing = k < top ? 1 - (rho[k - 1] ?? 0) : 1;
      return (product * closing) / choose(size - 1, k - 1);
    });
  }
  return undefined;
}

function schemeCoefficients(alphas: readonly number[], testing: DaCcfTesting): number[] {
  const size = alphas.length;
  const total = sum(alphas.map((alpha, index) => (index + 1) * alpha));
  return alphas.map((alpha, index) => (testing === "STAGGERED" ? alpha / choose(size - 1, index) : ((index + 1) * alpha) / (total * choose(size - 1, index))));
}

function handoffFor(alphas: readonly number[], testing: DaCcfTesting): DaCcfHandoff {
  if (testing === "NON_STAGGERED") return { modelType: "ALPHA_FACTOR", parameters: Object.fromEntries(alphas.map((alpha, index) => [`alpha${index + 1}`, alpha])) };
  const tails = alphas.map((_, index) => sum(alphas.slice(index)));
  const rho = alphas.slice(1).map((_, index) => {
    const above = tails[index] ?? 0;
    return above > 0 ? (tails[index + 1] ?? 0) / above : 0;
  });
  return { modelType: "MGL", parameters: Object.fromEntries(rho.map((value, index) => [MGL_NAMES[index] ?? `factor${index + 1}`, value])) };
}

function templateGamma(da: DataAnalysis, estimate: CcfParameterEstimation, size: number): { gamma?: number[]; template?: DaCcfTemplate; problem?: string } {
  const source = (da.sources ?? []).find((candidate) => candidate.id === estimate.priorSourceId);
  const code = estimate.priorTemplate;
  if (source === undefined || code === undefined || blank(code)) return { problem: "Choose the published factors the estimate starts from." };
  const entries = new Map(source.entries.map((entry) => [entry.id, entry]));
  const rows = templateEntryIds(code, size).map((id) => entries.get(id));
  const first = rows[0];
  if (rows.some((row) => row === undefined) || first === undefined) return { problem: `${code} has no alpha factors stored for a group of ${size}. Pick the template again to store them.` };
  const gamma: number[] = [];
  for (const row of rows) {
    const distribution = row?.distribution;
    if (distribution?.type !== DistributionType.BETA || !(distribution.alpha > 0) || !(distribution.betaParam > 0)) return { problem: `${row?.id ?? code} has no beta distribution to rebuild the factors from.` };
    gamma.push(distribution.alpha);
  }
  return { gamma, template: { sourceId: source.id, code, component: first.component, failureMode: baseFailureMode(first.failureMode), table: first.table ?? "", sizes: [size] } };
}

function evidenceCounts(estimate: CcfParameterEstimation, size: number): { counts: number[]; problem?: string } {
  const counts = Array.from({ length: size }, () => 0);
  for (const evidence of estimate.evidence ?? []) {
    if (!evidence.included) continue;
    const what = blank(evidence.label) ? evidence.id : evidence.label ?? evidence.id;
    if (!(evidence.population > 0)) return { counts, problem: `${what}: enter how many components the population had.` };
    if (!(evidence.independentFailures >= 0)) return { counts, problem: `${what}: the independent failures cannot be negative.` };
    counts[0] = (counts[0] ?? 0) + (evidence.independentFailures * size) / evidence.population;
    for (const event of evidence.events) {
      if (!event.included) continue;
      if (event.impact.length !== size) return { counts, problem: `${what} · ${event.id}: the impact vector needs ${size} values, one for each number of failed components.` };
      if (event.impact.some((value) => !(value >= 0 && value <= 1)) || sum(event.impact) > 1 + 1e-9) return { counts, problem: `${what} · ${event.id}: each impact value lies between 0 and 1, and together they add to at most 1.` };
      event.impact.forEach((value, index) => { counts[index] = (counts[index] ?? 0) + value; });
    }
  }
  return { counts };
}

function betaSummary(a: number, b: number): { p05?: number; p95?: number } {
  const distribution = { type: DistributionType.BETA as const, alpha: a, betaParam: b };
  return { p05: distributionQuantile(distribution, 0.05), p95: distributionQuantile(distribution, 0.95) };
}

function ccfResult(da: DataAnalysis, estimate: CcfParameterEstimation): DaCcfResult {
  let byEstimate = resultCache.get(da);
  if (byEstimate === undefined) {
    byEstimate = new Map();
    resultCache.set(da, byEstimate);
  }
  const cached = byEstimate.get(estimate.uuid);
  if (cached !== undefined) return cached;
  const result = computeResult(da, estimate);
  byEstimate.set(estimate.uuid, result);
  return result;
}

function computeResult(da: DataAnalysis, estimate: CcfParameterEstimation): DaCcfResult {
  const size = estimate.groupSize;
  const testing = testingOf(estimate);
  const method = methodOf(estimate);
  const { qt, from } = qtOf(da, estimate);
  const base: DaCcfResult = { size, testing, method, qt, qtFrom: from, alphas: [], combinations: [] };
  const withCombinations = (coefficients: readonly number[] | undefined, extra: Partial<DaCcfResult>): DaCcfResult => ({
    ...base,
    ...extra,
    combinations: coefficients === undefined || size === undefined ? [] : coefficients.map((coefficient, index) => ({ k: index + 1, count: choose(size, index + 1), coefficient, ...(qt === undefined ? {} : { each: coefficient * qt }) })),
  });
  if (size === undefined || !Number.isInteger(size) || size < 2) return { ...base, problem: "Enter the group size, two or more components." };
  if (method === undefined) return { ...base, problem: "Choose how the factors are found." };
  if (method === "TYPED") {
    const coefficients = expansionCoefficients(estimate.modelType, estimate.parameters, size);
    if (coefficients === undefined) return { ...base, problem: "Type a full set of factors for the model and group size." };
    const alphas = estimate.modelType === "ALPHA_FACTOR" ? orderedValues(estimate.parameters).map((mean, index) => ({ k: index + 1, mean })) : [];
    return withCombinations(coefficients, { alphas, handoff: { modelType: estimate.modelType, parameters: { ...estimate.parameters } } });
  }
  const prior = templateGamma(da, estimate, size);
  if (prior.gamma === undefined) return { ...base, problem: prior.problem };
  const gamma = prior.gamma;
  const evidence = method === "BAYES" ? evidenceCounts(estimate, size) : { counts: Array.from({ length: size }, () => 0) };
  if (evidence.problem !== undefined) return { ...base, template: prior.template, prior: gamma, problem: evidence.problem };
  const posterior = gamma.map((value, index) => value + (evidence.counts[index] ?? 0));
  const priorTotal = sum(gamma);
  const total = sum(posterior);
  const alphas = posterior.map((value, index) => ({ k: index + 1, mean: value / total, ...betaSummary(value, total - value), ...(method === "BAYES" ? { prior: (gamma[index] ?? 0) / priorTotal } : {}) }));
  const handoff = handoffFor(alphas.map((alpha) => alpha.mean), testing);
  return withCombinations(schemeCoefficients(alphas.map((alpha) => alpha.mean), testing), { template: prior.template, prior: gamma, counts: evidence.counts, posterior, alphas, handoff });
}

function sameNumber(a: number | undefined, b: number | undefined): boolean {
  if (a === undefined || b === undefined) return a === b;
  return a === b || Math.abs(a - b) <= 1e-12 + 1e-9 * Math.max(Math.abs(a), Math.abs(b));
}

function sameParameters(a: Record<string, number>, b: Record<string, number>): boolean {
  const left = Object.keys(a);
  return left.length === Object.keys(b).length && left.every((key) => sameNumber(a[key], b[key]));
}

function withCcf(da: DataAnalysis): DataAnalysis {
  const estimates = da.ccfParameterEstimations;
  if (estimates === undefined) return da;
  let changed = false;
  const next = estimates.map((estimate) => {
    if (estimate.method !== "PRIOR" && estimate.method !== "BAYES") return estimate;
    const handoff = ccfResult(da, estimate).handoff;
    if (handoff === undefined) return estimate;
    if (estimate.modelType === handoff.modelType && sameParameters(estimate.parameters, handoff.parameters)) return estimate;
    changed = true;
    return { ...estimate, modelType: handoff.modelType, parameters: handoff.parameters };
  });
  return changed ? { ...da, ccfParameterEstimations: next } : da;
}

function stateModes(da: DataAnalysis): Map<string, string | undefined> {
  return new Map((da.dataNeeds?.states ?? []).map((state) => [state.id, state.mode]));
}

function estimateFindings(da: DataAnalysis, estimate: CcfParameterEstimation, findings: DaNeedFinding[]): void {
  const item = estimate.uuid;
  const group = { kind: "daCcfGroup" as const, id: estimate.uuid };
  const factors = { kind: "daCcfFactors" as const, id: estimate.uuid };
  const events = { kind: "daCcfEvents" as const, id: estimate.uuid };
  const result = ccfResult(da, estimate);
  const size = estimate.groupSize;
  const operating = da.plantStage === "OPERATIONAL";
  const ccTwo = da.capabilityCategory !== "CC-I";
  const needs = da.dataNeeds;
  const share = shareFromNeeds(da, estimate);
  if (blank(estimate.ccfGroupReference)) findings.push({ severity: "error", check: "No group", item, detail: "Name the Systems Analysis group this estimate serves.", target: group });
  else if (needs !== undefined && needs.ccfGroups.length > 0 && share === undefined) findings.push({ severity: "warning", check: "Group not imported", item, detail: `${estimate.ccfGroupReference} is not among the common cause groups imported in Step 02.`, target: group });
  if (share !== undefined && size !== undefined && share.members.length !== size) findings.push({ severity: "error", check: "Size differs", item, detail: `Systems Analysis gives ${estimate.ccfGroupReference} ${share.members.length} members, but the estimate is for a group of ${size}.`, target: group });
  if (share !== undefined && share.parameterIds.length > 1) findings.push({ severity: "error", check: "Members differ", item, detail: `The members map to ${share.parameterIds.join(", ")}. A group shares one independent estimate, its total failure probability (DA-D8).`, target: group });
  if (estimate.memberParameterId !== undefined && share !== undefined && share.parameterIds.length === 1 && share.parameterIds[0] !== estimate.memberParameterId) findings.push({ severity: "warning", check: "Members' parameter", item, detail: `The members map to ${share.parameterIds[0] ?? "?"}, but the estimate takes its total from ${estimate.memberParameterId}.`, target: group });
  if (estimate.memberParameterId === undefined && (share === undefined || share.parameterIds.length === 0)) findings.push({ severity: "warning", check: "No total", item, detail: "Pick the parameter the members share, so each combination can be computed.", target: group });
  if (size !== undefined && size > 4 && blank(estimate.estimateReason)) findings.push({ severity: "warning", check: "Large group", item, detail: `Say why a group of ${size} is modeled. Groups above four rarely have data behind them.`, target: factors });
  if (estimate.testing === undefined) findings.push({ severity: "warning", check: "No testing scheme", item, detail: "Set the testing scheme. Non-staggered is the conservative choice when it is not known.", target: group });
  else if (blank(estimate.testingReason)) findings.push({ severity: "warning", check: "No testing basis", item, detail: "Say which plan or procedure sets the testing scheme.", target: group });
  if (blank(estimate.componentBoundaryConsistencyBasis)) findings.push({ severity: "warning", check: "No boundary basis", item, detail: "Say how the factors' component boundary matches the members' boundary (DA-D8).", target: group });
  const memberId = estimate.memberParameterId ?? share?.parameterIds[0];
  const member = memberId === undefined ? undefined : da.parameters.find((candidate) => candidate.uuid === memberId);
  if (memberId !== undefined && member === undefined) findings.push({ severity: "error", check: "Parameter missing", item, detail: `${memberId} does not exist.`, target: group });
  const modes = stateModes(da);
  const shutdown = (member?.stateIds ?? []).filter((state) => {
    const mode = modes.get(state);
    return mode !== undefined && mode !== "POWER" && mode !== "STARTUP";
  });
  if (shutdown.length > 0) findings.push({ severity: "note", check: "Shutdown states", item, detail: `The members hold in ${shutdown.join(", ")}. Full-power common cause data may need adjusting there (DA-N-29).`, target: group });
  const method = result.method;
  if (method === undefined) {
    findings.push({ severity: "error", check: "No method", item, detail: "Choose the published factors as they are, an update with events, or typed factors.", target: factors });
    return;
  }
  if (method === "TYPED") {
    if (result.problem !== undefined) findings.push({ severity: "error", check: "Cannot use", item, detail: result.problem, target: factors });
    const values = Object.values(estimate.parameters);
    if (values.some((value) => !(value >= 0 && value <= 1))) findings.push({ severity: "error", check: "Out of range", item, detail: "Each factor lies between 0 and 1.", target: factors });
    if (estimate.modelType === "ALPHA_FACTOR" && values.length > 0 && Math.abs(sum(values) - 1) > 1e-6) findings.push({ severity: "error", check: "Alphas do not add up", item, detail: `The alpha factors add to ${Number(sum(values).toPrecision(6))}, not 1.`, target: factors });
    if (estimate.modelType === "ALPHA_FACTOR" && estimate.testing === "STAGGERED") findings.push({ severity: "warning", check: "Staggered alphas", item, detail: "Systems Analysis expands alpha factors as non-staggered. Type MGL values to keep the staggered combinations.", target: factors });
    if (estimate.modelType === "BETA_FACTOR" && ccTwo && estimate.isRiskSignificant === true && size !== undefined && size > 2) findings.push({ severity: "error", check: "Model too coarse", item, detail: "A risk-significant group of more than two needs alpha factors, MGL or another multi-parameter model at Capability Category II (DA-D7).", target: factors });
    if (blank(estimate.estimateReason)) findings.push({ severity: "warning", check: "No basis", item, detail: "Say where the typed factors come from.", target: factors });
    return;
  }
  if (result.problem !== undefined) findings.push({ severity: "error", check: "Cannot estimate", item, detail: result.problem, target: result.prior === undefined ? factors : events });
  if (blank(estimate.priorReason)) findings.push({ severity: "warning", check: "No template reason", item, detail: "Say why the template's component and failure mode fit the members (DA-D8).", target: factors });
  const code = estimate.priorTemplate ?? "";
  const rateMember = member?.quantificationModel === "RUNNING_RATE" || member?.quantificationModel === "STANDBY_RATE" || member?.quantificationModel === "MISSION_PROBABILITY";
  const demandMember = member?.quantificationModel === "DEMAND_PROBABILITY";
  if (blank(estimate.priorReason) && ((code === "CCF-DEM" && rateMember) || (code === "CCF-RATE" && demandMember))) findings.push({ severity: "warning", check: "Failure type differs", item, detail: `The members fail ${demandMember ? "on demand" : "over time"}, but ${code} pools ${code === "CCF-DEM" ? "demand" : "rate"} failures.`, target: factors });
  const prior = result.prior;
  if (prior !== undefined && size !== undefined) {
    const source = (da.sources ?? []).find((candidate) => candidate.id === estimate.priorSourceId);
    const totals = templateEntryIds(code, size).flatMap((id) => {
      const distribution = source?.entries.find((entry) => entry.id === id)?.distribution;
      return distribution?.type === DistributionType.BETA ? [distribution.alpha + distribution.betaParam] : [];
    });
    const spread = totals.length > 0 ? (Math.max(...totals) - Math.min(...totals)) / Math.max(...totals) : 0;
    if (spread > 0.02) findings.push({ severity: "note", check: "Marginals disagree", item, detail: `The printed marginals imply totals that differ by ${Math.round(spread * 100)}%, so the rebuilt factors are approximate.`, target: factors });
  }
  const included = (estimate.evidence ?? []).filter((evidence) => evidence.included);
  if (method === "PRIOR" && included.length > 0) findings.push({ severity: ccTwo ? "error" : "warning", check: "Events not used", item, detail: "Events are in the update but the published factors are used as they are. Update them (DA-D8).", target: factors });
  if (method === "BAYES" && included.length === 0) findings.push({ severity: "note", check: "Nothing to update", item, detail: "No events are in the update, so the factors equal the published ones.", target: events });
  const records = new Map((da.recordSets ?? []).map((set) => [set.id, set]));
  for (const evidence of estimate.evidence ?? []) {
    const what = blank(evidence.label) ? evidence.id : evidence.label ?? evidence.id;
    if (blank(evidence.reason)) findings.push({ severity: "error", check: "No reason", item, detail: `Say why ${what} applies to this group.`, target: events });
    if (!evidence.included && blank(evidence.exclusionReason)) findings.push({ severity: "error", check: "No exclusion reason", item, detail: `Say why ${what} is left out.`, target: events });
    if (evidence.included && evidence.boundary === "DIFFERENT") findings.push({ severity: "error", check: "Boundary differs", item, detail: `${what} covers a different boundary. Leave it out or adjust it (DA-D8).`, target: events });
    if (evidence.included && !operating && evidence.origin === "PLANT_RECORDS") findings.push({ severity: "warning", check: "Plant records before operation", item, detail: `${what} is marked as plant records, but the plant does not operate yet.`, target: events });
    const set = evidence.recordSetId === undefined ? undefined : records.get(evidence.recordSetId);
    if (evidence.recordSetId !== undefined && set === undefined) findings.push({ severity: "error", check: "Record set missing", item, detail: `${what} points at record set ${evidence.recordSetId}, which does not exist.`, target: events });
    for (const event of evidence.events) {
      if (blank(event.reason)) findings.push({ severity: "error", check: "No reason", item, detail: `Say how the impact of ${event.id} was judged, or why it is left out.`, target: events });
      if (event.recordId === undefined || set === undefined) continue;
      const record = set.records.find((candidate) => candidate.id === event.recordId);
      if (record === undefined) {
        findings.push({ severity: "error", check: "Record missing", item, detail: `${event.id} points at ${event.recordId}, which is not in ${set.id}.`, target: events });
        continue;
      }
      const counted = record.judgment === "FAILURE";
      if (evidence.included && event.included && !counted) findings.push({ severity: "warning", check: "Exclusions differ", item, detail: `${record.id} is left out of the independent data in Step 05, but counts here as a common cause event (DA-D9).`, target: events });
      if (evidence.included && !event.included && counted) findings.push({ severity: "warning", check: "Exclusions differ", item, detail: `${record.id} counts as a failure in Step 05, but is left out of the common cause events here (DA-D9).`, target: events });
    }
    if (set !== undefined && evidence.included && memberId !== undefined) {
      const linked = new Set(evidence.events.filter((event) => event.included && event.recordId !== undefined).map((event) => event.recordId));
      const independent = set.records.filter((record) => record.judgment === "FAILURE" && record.parameterId === memberId && !linked.has(record.id)).length;
      if (independent !== evidence.independentFailures) findings.push({ severity: "note", check: "Independent count", item, detail: `${set.id} counts ${independent} independent ${independent === 1 ? "failure" : "failures"} of ${memberId}, but ${what} uses ${Number(evidence.independentFailures.toPrecision(4))}.`, target: events });
    }
  }
  if (included.length > 0 && estimate.genericExclusionConsistencyConfirmed !== true) findings.push({ severity: "warning", check: "Exclusions not confirmed", item, detail: "Confirm that every event left out of the independent data is left out of the common cause events too (DA-D9).", target: factors });
  if (included.length > 0 && estimate.genericExclusionConsistencyConfirmed === true && blank(estimate.genericExclusionConsistencyBasis)) findings.push({ severity: "warning", check: "No exclusion basis", item, detail: "Say how the exclusions were matched (DA-D9).", target: factors });
  if (ccTwo && operating && included.length === 0) findings.push({ severity: "note", check: "Plant experience", item, detail: "At Capability Category II, update the published factors with plant experience where it exists (DA-D8).", target: events });
  const handoff = result.handoff;
  const syGroup = needs?.ccfGroups.find((candidate) => candidate.id === estimate.ccfGroupReference);
  if (handoff !== undefined && syGroup?.factors !== undefined && syGroup.modelType !== undefined) {
    const syValues = syGroup.modelType === "MGL" ? mglValues(syGroup.factors) : orderedValues(syGroup.factors);
    const ours = handoff.modelType === "MGL" ? mglValues(handoff.parameters) : orderedValues(handoff.parameters);
    const same = syGroup.modelType === handoff.modelType && syValues.length === ours.length && syValues.every((value, index) => sameNumber(value, ours[index]));
    if (!same) findings.push({ severity: "warning", check: "SY differs", item, detail: `Systems Analysis holds ${syGroup.modelType.toLowerCase().split("_").join(" ")} ${syValues.map((value) => sci(value)).join(", ")}. Apply the DA values in SY Step 04.`, target: factors });
  }
}

function ccfFindings(da: DataAnalysis): DaNeedFinding[] {
  const cached = findingCache.get(da);
  if (cached !== undefined) return cached;
  const findings: DaNeedFinding[] = [];
  const estimates = da.ccfParameterEstimations ?? [];
  const seen = new Set<string>();
  for (const estimate of estimates) {
    if (seen.has(estimate.uuid)) findings.push({ severity: "error", check: "Duplicate ID", item: estimate.uuid, detail: "Two estimates share this ID.", target: { kind: "daCcfGroup", id: estimate.uuid } });
    seen.add(estimate.uuid);
    estimateFindings(da, estimate, findings);
  }
  const needs = da.dataNeeds;
  if (needs !== undefined) {
    const byGroup = new Set(estimates.map((estimate) => estimate.ccfGroupReference));
    const byId = new Set(estimates.map((estimate) => estimate.uuid));
    for (const need of needs.ccfGroups) {
      if (!need.included) continue;
      if (!byGroup.has(need.id) && (need.estimateRef === undefined || !byId.has(need.estimateRef))) findings.push({ severity: "error", check: "No estimate", item: need.id, detail: "This Systems Analysis group has no common cause estimate.", target: { kind: "needCcf", id: need.id } });
    }
    const groups = estimates.filter((estimate) => estimates.filter((other) => other.ccfGroupReference === estimate.ccfGroupReference).length > 1);
    for (const estimate of groups) findings.push({ severity: "warning", check: "Group estimated twice", item: estimate.uuid, detail: `More than one estimate serves ${estimate.ccfGroupReference}.`, target: { kind: "daCcfGroup", id: estimate.uuid } });
  }
  const sorted = findings
    .map((finding, index) => ({ finding, index }))
    .sort((a, b) => RANK[a.finding.severity] - RANK[b.finding.severity] || a.index - b.index)
    .map(({ finding }) => finding);
  findingCache.set(da, sorted);
  return sorted;
}

function ccfComplete(da: DataAnalysis): boolean {
  const decision = (da.scopeDecisions ?? []).find((candidate) => candidate.kind === "COMMON_CAUSE");
  if (decision !== undefined && !decision.included) return true;
  const estimates = da.ccfParameterEstimations ?? [];
  if (estimates.length === 0) return false;
  if (estimates.some((estimate) => Object.keys(estimate.parameters).length === 0)) return false;
  return !ccfFindings(da).some((finding) => finding.severity === "error");
}

function ccfEventCount(estimate: CcfParameterEstimation): number {
  return (estimate.evidence ?? []).reduce((total, evidence) => total + evidence.events.length, 0);
}

export {
  ccfComplete,
  ccfFactorsOf,
  ccfEventCount,
  ccfFindings,
  ccfResult,
  ccfTemplates,
  choose,
  expansionCoefficients,
  handoffFor,
  memberParameterIds,
  mglValues,
  orderedValues,
  schemeCoefficients,
  shareFromNeeds,
  templateEntryIds,
  templateParts,
  withCcf,
  type DaCcfAlpha,
  type DaCcfCombination,
  type DaCcfHandoff,
  type DaCcfResult,
  type DaCcfTemplate,
};
