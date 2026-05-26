import { z } from "zod";
import type { IncludedCode } from "../projects";

const ToolIdSchema = z.enum(["event-tree", "fault-tree", "bayesian-network"]);
type ToolId = z.infer<typeof ToolIdSchema>;

interface ToolDefinition {
  id: ToolId;
  name: string;
  elementCode: IncludedCode;
}

const TOOLS: readonly ToolDefinition[] = [
  { id: "event-tree", name: "Event trees", elementCode: "ES" },
  { id: "fault-tree", name: "Fault trees", elementCode: "SY" },
  { id: "bayesian-network", name: "Bayesian networks", elementCode: "SY" },
];

function toolsForElement(code: string): ToolDefinition[] {
  return TOOLS.filter((t) => t.elementCode === code);
}

function findTool(id: string): ToolDefinition | undefined {
  return TOOLS.find((t) => t.id === id);
}

function toolBelongsToElement(toolId: string, elementCode: string): boolean {
  const tool = findTool(toolId);
  return tool !== undefined && tool.elementCode === elementCode;
}

export { ToolIdSchema, TOOLS, toolsForElement, findTool, toolBelongsToElement };
export type { ToolId, ToolDefinition };
