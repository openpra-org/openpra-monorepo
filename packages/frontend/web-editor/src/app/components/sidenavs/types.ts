export type ScopedNavScope = "InternalEvents" | "InternalHazards" | "ExternalHazards" | "FullScope";
export interface NavNode {
  id: string;
  name: string;
  path?: string;
  iconType?: string;
  items?: NavNode[];
  expanded?: boolean;
}
