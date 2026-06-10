import { z } from "zod";
import { BooleanNodeIdSchema, BasicEventIdSchema } from "./boolean-logic";
import type { SymbolTable } from "../symbol-table";

export const BasicEventLabelSchema = z.object({
  basicEventId: BasicEventIdSchema,
  name: z.string(),
  dataAnalysisParameterRef: z.string().optional(),
});

export const NodeLabelSchema = z.object({
  nodeId: BooleanNodeIdSchema,
  name: z.string(),
});

export const SymbolTableSchema = z.object({
  id: z.number(),
  booleanModelRef: z.number(),
  basicEventLabels: z.array(BasicEventLabelSchema).optional(),
  nodeLabels: z.array(NodeLabelSchema).optional(),
});

type Expect<T extends true> = T;
type Equal<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;

type _AssertSymbolTableMirrorsType = Expect<
  Equal<z.infer<typeof SymbolTableSchema>, SymbolTable>
>;
