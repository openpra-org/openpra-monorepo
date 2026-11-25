import { NetworkBuilderError, keyError, valueError } from "../core/errors";
import { isClose } from "../core/math-functions";
import {
  floatRepr,
  getValue,
  getValueOr,
  hasKey,
  isMapping,
  isSequence,
  repr,
  sortedText,
  strip,
  text,
  toFloat,
  truthy,
} from "../core/spec-values";
import type { SpecMapping, SpecValue } from "../core/spec-values";
import { FLEX_IDHEAS_ECA_PHASE0 } from "../data/flex-idheas-eca-phase0";
import { floatSum } from "./flex-cpd-generators";

const ALLOWED_AGGREGATION_POLICIES = ["subject_value", "mean", "median", "p95"];
const ALLOWED_TABLE_STATUS = ["complete", "partial_ocr"];
const ALLOWED_ROW_QUALITY = ["clear", "partial_ocr", "ambiguous_ocr"];

const PHASE0_TABLE_KEYS = [
  "table_6_1_base_macro_cognitive_hep",
  "table_6_3_hfe1_base_case",
  "table_6_3a_hfe1_variation_1",
  "table_6_3b_hfe1_variation_2",
  "table_6_4_hfe2_dc_load_shed",
  "table_6_5a_hfe3_task_transport",
  "table_6_5b_hfe3_task_connect_start",
];

const requireItem = (mapping: SpecMapping, key: string): SpecValue => {
  if (!hasKey(mapping, key)) throw keyError(key);
  return mapping[key];
};

const asMapping = (value: SpecValue, label: string): SpecMapping => {
  if (!isMapping(value)) throw valueError(`${label} must be an object.`);
  return value;
};

const asRows = (table: SpecMapping, tableLabel: string): SpecMapping[] => {
  const rows = getValue(table, "rows");
  if (!isSequence(rows) || rows.length === 0) throw valueError(`${tableLabel}.rows must be a non-empty list.`);
  const output: SpecMapping[] = [];
  rows.forEach((row, index) => {
    if (!isMapping(row)) throw valueError(`${tableLabel}.rows[${index}] must be an object.`);
    output.push(row);
  });
  return output;
};

const asTextList = (value: SpecValue, label: string): string[] => {
  if (!isSequence(value)) throw valueError(`${label} must be a list.`);
  const output: string[] = [];
  value.forEach((item, index) => {
    const cleaned = strip(text(item));
    if (cleaned.length === 0) throw valueError(`${label}[${index}] must be non-empty.`);
    output.push(cleaned);
  });
  return output;
};

const requireKeys = (data: SpecMapping, keys: readonly string[], label: string): void => {
  const missing = keys.filter((key) => !hasKey(data, key));
  if (missing.length > 0) throw valueError(`${label} missing required keys: ${repr(missing)}.`);
};

const assertProbability = (value: SpecValue, label: string): number => {
  let output: number;
  try {
    output = toFloat(value);
  } catch (error) {
    if (error instanceof NetworkBuilderError && (error.kind === "TypeError" || error.kind === "ValueError")) {
      throw valueError(`${label} must be numeric.`);
    }
    throw error;
  }
  if (!(output >= 0 && output <= 1)) {
    throw valueError(`${label} must be within [0,1], got ${floatRepr(output)}.`);
  }
  return output;
};

const sortedNumbers = (values: readonly number[]): number[] => Array.from(values).sort((left, right) => left - right);

const median = (values: readonly number[]): number => {
  const data = sortedNumbers(values);
  const count = data.length;
  if (count === 0) throw new NetworkBuilderError("StatisticsError", "no median for empty data");
  const middle = Math.floor(count / 2);
  if (count % 2 === 1) return data[middle];
  return (data[middle - 1] + data[middle]) / 2;
};

const percentile = (values: readonly number[], quantile: number): number => {
  if (values.length === 0) throw valueError("Cannot compute percentile of empty values.");
  const sorted = sortedNumbers(values);
  if (sorted.length === 1) return sorted[0];
  const rank = (sorted.length - 1) * quantile;
  const low = Math.floor(rank);
  const high = Math.ceil(rank);
  if (low === high) return sorted[low];
  const weight = rank - low;
  return sorted[low] + (sorted[high] - sorted[low]) * weight;
};

const validateTable61 = (table: SpecMapping): void => {
  requireKeys(table, ["table_id", "title", "values"], "table_6_1_base_macro_cognitive_hep");
  const values = asMapping(table.values, "table_6_1_base_macro_cognitive_hep.values");
  const keys = ["detection", "understanding", "decision_making", "action", "interteam"];
  requireKeys(values, keys, "table_6_1_base_macro_cognitive_hep.values");
  for (const key of keys) {
    assertProbability(values[key], `table_6_1_base_macro_cognitive_hep.values.${key}`);
  }
};

const sameMembers = (left: ReadonlySet<string>, right: ReadonlySet<string>): boolean =>
  left.size === right.size && Array.from(left).every((item) => right.has(item));

const validateSubjectTable = (table: SpecMapping, tableLabel: string): void => {
  requireKeys(
    table,
    ["table_id", "title", "hfe_id", "status", "expected_subjects", "missing_subjects", "rows"],
    tableLabel,
  );

  const status = text(table.status);
  if (!ALLOWED_TABLE_STATUS.includes(status)) {
    throw valueError(`${tableLabel}.status must be one of ${repr(ALLOWED_TABLE_STATUS)}, got '${status}'.`);
  }

  const expectedSubjects = asTextList(table.expected_subjects, `${tableLabel}.expected_subjects`);
  if (expectedSubjects.length !== new Set(expectedSubjects).size) {
    throw valueError(`${tableLabel}.expected_subjects contains duplicates.`);
  }
  const expectedSet = new Set(expectedSubjects);

  const missingSubjects = asTextList(table.missing_subjects, `${tableLabel}.missing_subjects`);
  const missingSet = new Set(missingSubjects);
  if (!Array.from(missingSet).every((subject) => expectedSet.has(subject))) {
    throw valueError(
      `${tableLabel}.missing_subjects must be subset of expected_subjects. ` +
        `missing=${repr(sortedText(missingSet))}, expected=${repr(sortedText(expectedSet))}.`,
    );
  }

  const rows = asRows(table, tableLabel);
  const seenRowIds = new Set<string>();
  const seenSubjects = new Set<string>();
  rows.forEach((row, index) => {
    const rowLabel = `${tableLabel}.rows[${index}]`;
    requireKeys(
      row,
      ["row_id", "subject_id", "hep", "hep_candidates", "cfms", "attribute_codes", "selected_attributes", "quality"],
      rowLabel,
    );

    const rowId = text(row.row_id);
    if (seenRowIds.has(rowId)) throw valueError(`${rowLabel}.row_id '${rowId}' is duplicated.`);
    seenRowIds.add(rowId);

    const subjectId = text(row.subject_id);
    if (!expectedSet.has(subjectId)) {
      throw valueError(
        `${rowLabel}.subject_id '${subjectId}' not in expected_subjects=${repr(sortedText(expectedSet))}.`,
      );
    }
    if (missingSet.has(subjectId)) {
      throw valueError(`${rowLabel}.subject_id '${subjectId}' appears in rows but is listed as missing.`);
    }
    seenSubjects.add(subjectId);

    const hep = assertProbability(row.hep, `${rowLabel}.hep`);
    const candidates = row.hep_candidates;
    if (!isSequence(candidates) || candidates.length === 0) {
      throw valueError(`${rowLabel}.hep_candidates must be a non-empty list.`);
    }
    const candidateValues: number[] = [];
    candidates.forEach((candidate, candidateIndex) => {
      candidateValues.push(assertProbability(candidate, `${rowLabel}.hep_candidates[${candidateIndex}]`));
    });
    if (!candidateValues.some((candidate) => isClose(hep, candidate, 0, 1e-12))) {
      throw valueError(`${rowLabel}.hep must appear in hep_candidates.`);
    }

    const cfms = asTextList(row.cfms, `${rowLabel}.cfms`);
    if (cfms.length === 0) throw valueError(`${rowLabel}.cfms must be non-empty.`);
    asTextList(row.attribute_codes, `${rowLabel}.attribute_codes`);
    const selectedAttributes = asTextList(row.selected_attributes, `${rowLabel}.selected_attributes`);
    if (selectedAttributes.length === 0) throw valueError(`${rowLabel}.selected_attributes must be non-empty.`);

    const quality = text(row.quality);
    if (!ALLOWED_ROW_QUALITY.includes(quality)) {
      throw valueError(`${rowLabel}.quality must be one of ${repr(ALLOWED_ROW_QUALITY)}, got '${quality}'.`);
    }
  });

  if (status === "complete") {
    if (missingSubjects.length > 0) {
      throw valueError(`${tableLabel}.status='complete' requires empty missing_subjects.`);
    }
    if (!sameMembers(seenSubjects, expectedSet)) {
      throw valueError(
        `${tableLabel}.status='complete' requires rows for every expected subject. ` +
          `seen=${repr(sortedText(seenSubjects))}, expected=${repr(sortedText(expectedSet))}.`,
      );
    }
  } else {
    const unresolved = new Set(Array.from(expectedSet).filter((subject) => !seenSubjects.has(subject)));
    if (!sameMembers(unresolved, missingSet)) {
      throw valueError(
        `${tableLabel}.rows/ missing_subjects mismatch for partial table. ` +
          `rows_missing=${repr(sortedText(unresolved))}, declared_missing=${repr(sortedText(missingSet))}.`,
      );
    }
  }
};

const validatePhase0Dataset = (data: SpecMapping): void => {
  requireKeys(
    data,
    ["schema_version", "dataset_id", "description", "source", "aggregation_policies_supported", "tables"],
    "dataset",
  );

  if (strip(text(data.dataset_id)) !== "flex_idheas_eca_phase0") {
    throw valueError("dataset.dataset_id must be 'flex_idheas_eca_phase0'.");
  }

  const source = asMapping(data.source, "dataset.source");
  requireKeys(source, ["type", "path"], "dataset.source");

  const policies = asTextList(data.aggregation_policies_supported, "dataset.aggregation_policies_supported");
  if (policies.length === 0) throw valueError("dataset.aggregation_policies_supported must be non-empty.");
  const unsupported = sortedText(new Set(policies.filter((policy) => !ALLOWED_AGGREGATION_POLICIES.includes(policy))));
  if (unsupported.length > 0) throw valueError(`Unsupported aggregation policies: ${repr(unsupported)}.`);

  const tables = asMapping(data.tables, "dataset.tables");
  const missing = sortedText(new Set(PHASE0_TABLE_KEYS.filter((key) => !hasKey(tables, key))));
  if (missing.length > 0) throw valueError(`dataset.tables missing required tables: ${repr(missing)}.`);

  validateTable61(asMapping(tables.table_6_1_base_macro_cognitive_hep, "table_6_1"));
  validateSubjectTable(asMapping(tables.table_6_3_hfe1_base_case, "table_6_3"), "table_6_3_hfe1_base_case");
  validateSubjectTable(asMapping(tables.table_6_3a_hfe1_variation_1, "table_6_3a"), "table_6_3a_hfe1_variation_1");
  validateSubjectTable(asMapping(tables.table_6_3b_hfe1_variation_2, "table_6_3b"), "table_6_3b_hfe1_variation_2");
  validateSubjectTable(asMapping(tables.table_6_4_hfe2_dc_load_shed, "table_6_4"), "table_6_4_hfe2_dc_load_shed");
  validateSubjectTable(
    asMapping(tables.table_6_5a_hfe3_task_transport, "table_6_5a"),
    "table_6_5a_hfe3_task_transport",
  );
  validateSubjectTable(
    asMapping(tables.table_6_5b_hfe3_task_connect_start, "table_6_5b"),
    "table_6_5b_hfe3_task_connect_start",
  );
};

const loadPhase0Dataset = (path: string | null = null): SpecMapping => {
  if (path !== null) {
    throw valueError("Only the built-in FLEX IDHEAS dataset is supported; a custom dataset path cannot be loaded.");
  }
  return FLEX_IDHEAS_ECA_PHASE0;
};

const loadAndValidatePhase0Dataset = (path: string | null = null): SpecMapping => {
  const data = loadPhase0Dataset(path);
  validatePhase0Dataset(data);
  return data;
};

const aggregateTableHep = (
  data: SpecMapping,
  tableKey: string,
  policy: string,
  subjectId: string | null = null,
): number => {
  const tables = asMapping(getValue(data, "tables"), "dataset.tables");
  if (!hasKey(tables, tableKey)) throw valueError(`Unknown table key: '${tableKey}'.`);
  const table = asMapping(tables[tableKey], `dataset.tables.${tableKey}`);
  const rows = asRows(table, `dataset.tables.${tableKey}`);

  const values = rows.map((row) => toFloat(requireItem(row, "hep")));
  if (values.length === 0) throw valueError(`Table '${tableKey}' has no rows to aggregate.`);

  if (policy === "subject_value") {
    if (subjectId === null || subjectId.length === 0) {
      throw valueError("policy='subject_value' requires subject_id.");
    }
    for (const row of rows) {
      if (text(getValue(row, "subject_id")) === subjectId) return toFloat(requireItem(row, "hep"));
    }
    throw valueError(`Subject '${subjectId}' not found in table '${tableKey}'.`);
  }

  if (policy === "mean") return floatSum(values) / values.length;
  if (policy === "median") return median(values);
  if (policy === "p95") return percentile(values, 0.95);
  throw valueError(`Unsupported aggregation policy '${policy}'. Supported: ${repr(ALLOWED_AGGREGATION_POLICIES)}.`);
};

const getTable = (data: SpecMapping, tableKey: string): SpecMapping => {
  const tables = asMapping(getValue(data, "tables"), "dataset.tables");
  if (!hasKey(tables, tableKey)) throw valueError(`Unknown table key: '${tableKey}'.`);
  const table = asMapping(tables[tableKey], `dataset.tables.${tableKey}`);
  asRows(table, `dataset.tables.${tableKey}`);
  return table;
};

const getTableRows = (data: SpecMapping, tableKey: string): SpecMapping[] => {
  const table = getTable(data, tableKey);
  return asRows(table, `dataset.tables.${tableKey}`);
};

const getRowById = (data: SpecMapping, tableKey: string, rowId: string): SpecMapping => {
  const target = strip(rowId);
  if (target.length === 0) throw valueError("row_id must be non-empty.");
  for (const row of getTableRows(data, tableKey)) {
    if (strip(text(getValueOr(row, "row_id", ""))) === target) return row;
  }
  throw valueError(`Row '${target}' not found in table '${tableKey}'.`);
};

const getRowBySubject = (data: SpecMapping, tableKey: string, subjectId: string): SpecMapping => {
  const target = strip(subjectId);
  if (target.length === 0) throw valueError("subject_id must be non-empty.");
  for (const row of getTableRows(data, tableKey)) {
    if (strip(text(getValueOr(row, "subject_id", ""))) === target) return row;
  }
  throw valueError(`Subject '${target}' not found in table '${tableKey}'.`);
};

const getRowHep = (
  data: SpecMapping,
  tableKey: string,
  rowId: string | null = null,
  subjectId: string | null = null,
): number => {
  if (truthy(rowId) === truthy(subjectId)) {
    throw valueError("Provide exactly one of row_id or subject_id to get_row_hep().");
  }
  const row = rowId !== null ? getRowById(data, tableKey, rowId) : getRowBySubject(data, tableKey, text(subjectId));
  return toFloat(requireItem(row, "hep"));
};

export {
  aggregateTableHep,
  getRowById,
  getRowBySubject,
  getRowHep,
  getTable,
  getTableRows,
  loadAndValidatePhase0Dataset,
  loadPhase0Dataset,
  validatePhase0Dataset,
};
