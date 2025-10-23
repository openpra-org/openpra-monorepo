export type ScopedNavScope = "InternalEvents" | "InternalHazards" | "ExternalHazards" | "FullScope";

export interface NavNode {
  /** Stable id, e.g., systems.analysis or fault-trees */
  id: string;
  /** Display name */
  name: string;
  /** Relative route path (joined by parent router base) */
  path?: string;
  /** EUI iconType string (token or icon) */
  iconType?: string;
  /** Child nodes */
  items?: NavNode[];
  /** Whether the section should be expanded by default */
  expanded?: boolean;
}
