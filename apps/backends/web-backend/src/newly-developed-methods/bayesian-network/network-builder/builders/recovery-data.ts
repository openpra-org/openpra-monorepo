import { keyError, valueError } from "../core/errors";
import {
  getValue,
  getValueOr,
  hasKey,
  isMapping,
  keysOf,
  repr,
  sortedText,
  strip,
  text,
  toFloat,
  toInteger,
  truthy,
} from "../core/spec-values";
import type { SpecMapping, SpecValue } from "../core/spec-values";
import { recoveryDgPhaseR1 } from "../data/recovery-dg-phase-r1";
import { recoveryLoopPhaseR1 } from "../data/recovery-loop-phase-r1";

interface LognormalParameters {
  mu: number;
  sigma: number;
}

interface WeibullParameters {
  alpha: number;
  betaHours: number;
}

const ALLOWED_CATEGORIES = ["PC", "SC", "GR", "WR"];

const item = (mapping: SpecMapping, key: string): SpecValue => {
  if (!hasKey(mapping, key)) throw keyError(key);
  return mapping[key];
};

const requireKeys = (mapping: SpecMapping, keys: readonly string[], label: string): void => {
  const missing = keys.filter((key) => !hasKey(mapping, key));
  if (missing.length > 0) throw valueError(`${label} missing required fields: ${repr(missing)}`);
};

const asMapping = (value: SpecValue, label: string): SpecMapping => {
  if (!isMapping(value)) throw valueError(`${label} must be an object/mapping.`);
  return value;
};

const loadPhaseR1LoopDataset = (path: SpecValue): SpecMapping => {
  if (path !== null) {
    throw valueError("Recovery LOOP dataset path is not supported; only the built-in dataset is available.");
  }
  return recoveryLoopPhaseR1;
};

const loadPhaseR1DgDataset = (path: SpecValue): SpecMapping => {
  if (path !== null) {
    throw valueError("Recovery DG dataset path is not supported; only the built-in dataset is available.");
  }
  return recoveryDgPhaseR1;
};

const validateTable7 = (table: SpecMapping): void => {
  requireKeys(table, ["table_id", "title", "rows"], "table_7_fitted_lognormal");
  const rows = asMapping(item(table, "rows"), "table_7_fitted_lognormal.rows");
  const missing = sortedText(ALLOWED_CATEGORIES.filter((category) => !hasKey(rows, category)));
  if (missing.length > 0) throw valueError(`table_7_fitted_lognormal.rows missing categories: ${repr(missing)}`);
  for (const category of ALLOWED_CATEGORIES) {
    const record = asMapping(item(rows, category), `table_7.rows.${category}`);
    requireKeys(record, ["event_count", "mu", "sigma", "mu_se", "sigma_se"], `table_7.rows.${category}`);
    if (toInteger(item(record, "event_count")) < 1) {
      throw valueError(`table_7.rows.${category}.event_count must be >= 1.`);
    }
    const sigma = toFloat(item(record, "sigma"));
    if (sigma <= 0) throw valueError(`table_7.rows.${category}.sigma must be > 0.`);
  }
};

const validatePhaseR1LoopDataset = (data: SpecMapping): void => {
  requireKeys(data, ["schema_version", "dataset_id", "description", "source", "tables"], "dataset");
  if (strip(text(item(data, "dataset_id"))) !== "recovery_loop_inl_2023_phaseR1") {
    throw valueError("dataset.dataset_id must be 'recovery_loop_inl_2023_phaseR1'.");
  }
  const source = asMapping(item(data, "source"), "dataset.source");
  requireKeys(source, ["type", "path"], "dataset.source");
  const tables = asMapping(item(data, "tables"), "dataset.tables");
  if (!hasKey(tables, "table_7_fitted_lognormal")) {
    throw valueError("dataset.tables must include 'table_7_fitted_lognormal'.");
  }
  validateTable7(asMapping(item(tables, "table_7_fitted_lognormal"), "table_7_fitted_lognormal"));
};

const validatePhaseR1DgDataset = (data: SpecMapping): void => {
  requireKeys(data, ["schema_version", "dataset_id", "description", "source", "curves", "default_curve_id"], "dataset");
  if (strip(text(item(data, "dataset_id"))) !== "recovery_dg_edg_2022_phaseR1") {
    throw valueError("dataset.dataset_id must be 'recovery_dg_edg_2022_phaseR1'.");
  }
  const source = asMapping(item(data, "source"), "dataset.source");
  requireKeys(source, ["type", "path"], "dataset.source");
  const curves = asMapping(item(data, "curves"), "dataset.curves");
  if (!truthy(curves)) throw valueError("dataset.curves must include at least one curve.");
  for (const curveId of keysOf(curves)) {
    const record = asMapping(curves[curveId], `dataset.curves.${curveId}`);
    requireKeys(record, ["alpha", "beta_hours"], `dataset.curves.${curveId}`);
    const alpha = toFloat(item(record, "alpha"));
    const beta = toFloat(item(record, "beta_hours"));
    if (alpha <= 0) throw valueError(`dataset.curves.${curveId}.alpha must be > 0.`);
    if (beta <= 0) throw valueError(`dataset.curves.${curveId}.beta_hours must be > 0.`);
  }
  const defaultCurveId = strip(text(item(data, "default_curve_id")));
  if (!hasKey(curves, defaultCurveId)) {
    throw valueError(`dataset.default_curve_id '${defaultCurveId}' not found in dataset.curves.`);
  }
};

const loadAndValidatePhaseR1LoopDataset = (path: SpecValue): SpecMapping => {
  const data = loadPhaseR1LoopDataset(path);
  validatePhaseR1LoopDataset(data);
  return data;
};

const loadAndValidatePhaseR1DgDataset = (path: SpecValue): SpecMapping => {
  const data = loadPhaseR1DgDataset(path);
  validatePhaseR1DgDataset(data);
  return data;
};

const getTable7Params = (data: SpecMapping, categories: readonly string[] | null): Map<string, LognormalParameters> => {
  const tables = asMapping(getValue(data, "tables"), "dataset.tables");
  const table = asMapping(getValue(tables, "table_7_fitted_lognormal"), "dataset.tables.table_7_fitted_lognormal");
  const rows = asMapping(getValue(table, "rows"), "dataset.tables.table_7_fitted_lognormal.rows");
  const selected = categories !== null && categories.length > 0 ? categories : keysOf(rows);
  const requested = selected.map((category) => strip(category).toUpperCase());
  const output = new Map<string, LognormalParameters>();
  for (const category of requested) {
    if (!hasKey(rows, category)) throw valueError(`Category '${category}' not found in table_7_fitted_lognormal.`);
    const record = asMapping(rows[category], `table_7.rows.${category}`);
    const mu = toFloat(item(record, "mu"));
    const sigma = toFloat(item(record, "sigma"));
    if (sigma <= 0) throw valueError(`table_7.rows.${category}.sigma must be > 0.`);
    output.set(category, { mu, sigma });
  }
  return output;
};

const getDefaultDgWeibullParams = (data: SpecMapping, curveId: string | null): WeibullParameters => {
  const curves = asMapping(getValue(data, "curves"), "dataset.curves");
  const selected = strip(
    curveId !== null && curveId.length > 0 ? curveId : text(getValueOr(data, "default_curve_id", "")),
  );
  if (selected.length === 0) throw valueError("DG dataset missing default_curve_id.");
  if (!hasKey(curves, selected)) throw valueError(`DG curve_id '${selected}' not found in dataset.curves.`);
  const record = asMapping(curves[selected], `dataset.curves.${selected}`);
  const alpha = toFloat(item(record, "alpha"));
  const beta = toFloat(item(record, "beta_hours"));
  if (alpha <= 0) throw valueError(`dataset.curves.${selected}.alpha must be > 0.`);
  if (beta <= 0) throw valueError(`dataset.curves.${selected}.beta_hours must be > 0.`);
  return { alpha, betaHours: beta };
};

export type { LognormalParameters, WeibullParameters };
export {
  getDefaultDgWeibullParams,
  getTable7Params,
  loadAndValidatePhaseR1DgDataset,
  loadAndValidatePhaseR1LoopDataset,
  loadPhaseR1DgDataset,
  loadPhaseR1LoopDataset,
  validatePhaseR1DgDataset,
  validatePhaseR1LoopDataset,
};
