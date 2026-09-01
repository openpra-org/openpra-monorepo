import type { HclEvidenceScenario } from "interfaces-mef-types/modeling";
import type { BayesianNetworkModel } from "interfaces-shared-types/newly-developed-methods/bayesian-network";

interface PortableEvidenceScenario {
  code: string;
  name: string;
  enabled: boolean;
  evidence: Record<string, string>;
}

interface PortableEvidenceScenarioFile {
  schemaVersion: "1.0.0";
  scenarios: PortableEvidenceScenario[];
}

function normalized(value: string): string {
  return value.trim().toUpperCase();
}

function createUniqueCodeMap<T>(
  values: readonly T[],
  codeOf: (value: T) => string,
  label: string,
): Map<string, T> {
  const result = new Map<string, T>();
  for (const value of values) {
    const key = normalized(codeOf(value));
    if (result.has(key)) throw new Error(`${label} code '${codeOf(value)}' is not unique in this Bayesian network.`);
    result.set(key, value);
  }
  return result;
}

function toPortableScenario(
  scenario: HclEvidenceScenario,
  model: BayesianNetworkModel,
): PortableEvidenceScenario {
  const nodesById = new Map(model.nodes.map((node) => [node.id, node]));
  const evidence: Record<string, string> = {};
  for (const observation of scenario.evidence.observations) {
    const node = nodesById.get(observation.nodeId);
    if (node === undefined) throw new Error(`Scenario '${scenario.code}' refers to a missing Bayesian-network node.`);
    const state = node.states.find((candidate) => candidate.id === observation.stateId);
    if (state === undefined) throw new Error(`Scenario '${scenario.code}' refers to a missing state on node '${node.code}'.`);
    evidence[node.code] = state.code;
  }
  return {
    code: scenario.code,
    name: scenario.name,
    enabled: scenario.enabled,
    evidence,
  };
}

function fromPortableScenarios(
  values: readonly unknown[],
  model: BayesianNetworkModel,
): HclEvidenceScenario[] {
  const nodesByCode = createUniqueCodeMap(model.nodes, (node) => node.code, "Node");
  const seenCodes = new Set<string>();
  return values.map((value, index) => {
    const row = index + 1;
    if (value === null || typeof value !== "object" || Array.isArray(value)) {
      throw new Error(`Scenario ${String(row)} must be an object.`);
    }
    const input = value as Record<string, unknown>;
    if (typeof input.code !== "string" || input.code.trim() === "") {
      throw new Error(`Scenario ${String(row)} needs a code.`);
    }
    const code = input.code.trim();
    if (code.length > 64) throw new Error(`Scenario ${String(row)} code must be 64 characters or fewer.`);
    const codeKey = normalized(code);
    if (seenCodes.has(codeKey)) throw new Error(`Scenario code '${code}' appears more than once.`);
    seenCodes.add(codeKey);
    const name = input.name === undefined ? code : input.name;
    if (typeof name !== "string" || name.trim() === "") throw new Error(`Scenario '${code}' needs a name.`);
    if (name.trim().length > 200) throw new Error(`Scenario '${code}' name must be 200 characters or fewer.`);
    const enabled = input.enabled ?? true;
    if (typeof enabled !== "boolean") throw new Error(`Scenario '${code}' has an invalid enabled value.`);
    const evidenceInput = input.evidence ?? {};
    if (evidenceInput === null || typeof evidenceInput !== "object" || Array.isArray(evidenceInput)) {
      throw new Error(`Scenario '${code}' evidence must be an object of node codes and state codes.`);
    }
    const observations = Object.entries(evidenceInput).map(([nodeCode, stateCode]) => {
      if (typeof stateCode !== "string") {
        throw new Error(`Scenario '${code}' has a non-text state for node '${nodeCode}'.`);
      }
      const node = nodesByCode.get(normalized(nodeCode));
      if (node === undefined) throw new Error(`Scenario '${code}' refers to unknown node '${nodeCode}'.`);
      const statesByCode = createUniqueCodeMap(node.states, (state) => state.code, `State on node '${node.code}'`);
      const state = statesByCode.get(normalized(stateCode));
      if (state === undefined) throw new Error(`Scenario '${code}' refers to unknown state '${stateCode}' on node '${node.code}'.`);
      return { nodeId: node.id, stateId: state.id };
    });
    return {
      id: crypto.randomUUID(),
      code,
      name: name.trim(),
      enabled,
      evidence: { observations },
    };
  });
}

function exportHclEvidenceScenariosJson(
  scenarios: readonly HclEvidenceScenario[],
  model: BayesianNetworkModel,
): string {
  const file: PortableEvidenceScenarioFile = {
    schemaVersion: "1.0.0",
    scenarios: scenarios.map((scenario) => toPortableScenario(scenario, model)),
  };
  return `${JSON.stringify(file, null, 2)}\n`;
}

function importHclEvidenceScenariosJson(
  text: string,
  model: BayesianNetworkModel,
): HclEvidenceScenario[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text) as unknown;
  } catch {
    throw new Error("The selected file is not valid JSON.");
  }
  const scenarios = Array.isArray(parsed)
    ? parsed
    : parsed !== null && typeof parsed === "object" && Array.isArray((parsed as { scenarios?: unknown }).scenarios)
      ? (parsed as { scenarios: unknown[] }).scenarios
      : null;
  if (scenarios === null) throw new Error("The JSON file must contain a scenarios array.");
  return fromPortableScenarios(scenarios, model);
}

function quoteCsv(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.split('"').join('""')}"` : value;
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index]!;
    if (quoted) {
      if (character === '"' && text[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
      } else {
        field += character;
      }
    } else if (character === '"' && field === "") {
      quoted = true;
    } else if (character === ",") {
      row.push(field);
      field = "";
    } else if (character === "\n") {
      row.push(field.replace(/\r$/, ""));
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += character;
    }
  }
  if (quoted) throw new Error("The CSV file contains an unterminated quoted field.");
  if (field !== "" || row.length > 0) {
    row.push(field.replace(/\r$/, ""));
    rows.push(row);
  }
  return rows.filter((candidate) => candidate.some((cell) => cell.trim() !== ""));
}

function exportHclEvidenceScenariosCsv(
  scenarios: readonly HclEvidenceScenario[],
  model: BayesianNetworkModel,
): string {
  const header = ["code", "name", "enabled", "evidence"];
  const rows = scenarios.map((scenario) => {
    const portable = toPortableScenario(scenario, model);
    return [portable.code, portable.name, String(portable.enabled), JSON.stringify(portable.evidence)];
  });
  return `${[header, ...rows].map((row) => row.map(quoteCsv).join(",")).join("\r\n")}\r\n`;
}

function importHclEvidenceScenariosCsv(
  text: string,
  model: BayesianNetworkModel,
): HclEvidenceScenario[] {
  const rows = parseCsv(text.replace(/^\uFEFF/, ""));
  if (rows.length === 0) throw new Error("The CSV file is empty.");
  const headers = rows[0]!.map((header) => header.trim().toLowerCase());
  const column = (name: string): number => headers.indexOf(name);
  const codeColumn = column("code");
  const nameColumn = column("name");
  const enabledColumn = column("enabled");
  const evidenceColumn = Math.max(column("evidence"), column("evidence_json"));
  if (codeColumn < 0 || evidenceColumn < 0) {
    throw new Error("The CSV file needs code and evidence columns.");
  }
  const portable = rows.slice(1).map((row, index): PortableEvidenceScenario => {
    const code = row[codeColumn]?.trim() ?? "";
    const enabledText = row[enabledColumn]?.trim().toLowerCase() ?? "true";
    if (!["true", "false", "1", "0", "yes", "no"].includes(enabledText)) {
      throw new Error(`CSV row ${String(index + 2)} has an invalid enabled value.`);
    }
    let evidence: unknown;
    try {
      evidence = JSON.parse(row[evidenceColumn] ?? "{}") as unknown;
    } catch {
      throw new Error(`CSV row ${String(index + 2)} has invalid evidence JSON.`);
    }
    return {
      code,
      name: row[nameColumn]?.trim() || code,
      enabled: ["true", "1", "yes"].includes(enabledText),
      evidence: evidence as Record<string, string>,
    };
  });
  return fromPortableScenarios(portable, model);
}

function mergeHclEvidenceScenarios(
  current: readonly HclEvidenceScenario[],
  imported: readonly HclEvidenceScenario[],
): HclEvidenceScenario[] {
  const importedCodes = new Set(imported.map((scenario) => normalized(scenario.code)));
  const idsByCode = new Map(current.map((scenario) => [normalized(scenario.code), scenario.id]));
  return [
    ...current.filter((scenario) => !importedCodes.has(normalized(scenario.code))),
    ...imported.map((scenario) => ({
      ...scenario,
      id: idsByCode.get(normalized(scenario.code)) ?? scenario.id,
    })),
  ];
}

export {
  exportHclEvidenceScenariosCsv,
  exportHclEvidenceScenariosJson,
  importHclEvidenceScenariosCsv,
  importHclEvidenceScenariosJson,
  mergeHclEvidenceScenarios,
};
