import { withBasicEventExpression } from "interfaces-mef-types/modeling/quantitative-semantics";
import { FaultTreeBasicEventSchema } from "interfaces-mef-types/zod/modeling/fault-tree";
import { WorkbookFaultTreeCatalogueSchema } from "interfaces-mef-types/zod/modeling/workbook-models";
import { stripNulls } from "../pos-workbooks/mef-normalize";
import {
  field,
  jsonOf,
  numberField,
  present,
  recordField,
  withArray,
  withRecord,
  type JsonRecord,
} from "./uncertainty-migration-json";
import { pointExpression } from "./uncertainty-migration-laws";

function convertBasicEvent(event: JsonRecord): JsonRecord {
  const parsed = FaultTreeBasicEventSchema.safeParse(stripNulls(event));
  if (!parsed.success || parsed.data.probability.expression !== undefined) return event;
  const converted = withBasicEventExpression(parsed.data);
  return converted === parsed.data ? event : { ...event, probability: jsonOf(converted.probability) };
}

function convertHazardFaultTrees(mef: JsonRecord): JsonRecord {
  return withRecord(mef, "hazardConditionedModels", (models) => withRecord(models, "faultTreeCatalogue", (catalogue) => withArray(catalogue, "basicEvents", convertBasicEvent)));
}

function convertFrequencyNode(node: JsonRecord): JsonRecord {
  if (field(node, "nodeType") !== "BASIC" || present(node, "expression")) return node;
  const probability = numberField(node, "probability");
  return probability === undefined ? node : { ...node, expression: jsonOf(pointExpression("PROBABILITY", probability)) };
}

function convertFrequencyFaultTree(source: JsonRecord): JsonRecord {
  return withArray(source, "faultTree", convertFrequencyNode);
}

function hazardCatalogueIssue(mef: JsonRecord): string | undefined {
  const catalogue = recordField(recordField(mef, "hazardConditionedModels") ?? {}, "faultTreeCatalogue");
  if (catalogue === undefined) return undefined;
  const parsed = WorkbookFaultTreeCatalogueSchema.safeParse(stripNulls(catalogue));
  if (parsed.success) return undefined;
  const issue = parsed.error.issues[0];
  return `Fault tree catalogue. ${issue === undefined ? "It does not parse." : `${issue.path.map(String).join(".")}: ${issue.message}`}`;
}

export { convertFrequencyFaultTree, convertHazardFaultTrees, hazardCatalogueIssue };
